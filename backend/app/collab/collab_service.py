"""Catalog resolution and recommendation helpers for SplitCart."""

from __future__ import annotations

import re
import uuid
from difflib import SequenceMatcher
from typing import Optional

from app.collab.models import (
    CollabCartItem,
    CollabDemand,
    CollabItemInput,
    Contributor,
    ProductSuggestion,
)
from app.catalog.models import ProductQuery
from app.db.dynamo import get_all_products
from app.models import ExtractedItem
from app.pipeline.resolver import _calculate_quantity_units, _exact_match, _keyword_overlap_match
from app.search.local_retrieval import LocalRetriever
from app.search.ranker import RankingContext, rank_candidates
from app.unit_conversions import normalize_to_base_unit

_ALTERNATIVE_FAMILIES = [
    {"bread", "bun", "buns"},
]

COUNT_UNITS = {"piece", "pieces", "pack", "packs"}
WEIGHT_UNITS = {"g", "kg"}
VOLUME_UNITS = {"ml", "l", "litre", "liter"}
_SEARCH_RETRIEVER = LocalRetriever(mock_mode=False)


def _product_by_sku(products: list[dict], sku: str) -> Optional[dict]:
    return next((product for product in products if product.get("sku") == sku), None)


def _search_engine_match(extracted: ExtractedItem) -> tuple[Optional[dict], str]:
    """Resolve through Pillar 1 retrieval and ranking."""

    products = get_all_products()
    query = ProductQuery(
        query_text=extracted.name,
        category=None if extracted.category == "general" else extracted.category,
    )
    candidates = _SEARCH_RETRIEVER.retrieve(query, limit=12)
    ranked = rank_candidates(
        candidates,
        RankingContext(
            budget_mode="balanced",
            quality_preference="balanced",
            pack_size_preference="balanced",
        ),
    )
    if not ranked:
        return None, ""

    best = ranked[0]
    # Avoid turning gibberish into a random SKU. Typos with no retrieval hit are
    # handled by find_close_suggestions below.
    retrieval_relevance = best.score_breakdown.get("retrieval_relevance", 0.0)
    if retrieval_relevance < 0.35 and best.score < 0.45:
        return None, ""

    product = _product_by_sku(products, best.sku)
    if not product:
        return None, ""
    return product, best.display_reason or "Resolved by Pillar 1 search ranking"


def _normalize_request_unit_for_product(
    quantity: float,
    unit: str,
    product: dict,
) -> tuple[float, str, Optional[str]]:
    """Convert count-style demand into the SKU's measurable selling unit.

    Example: "1 piece milk" becomes "500 ml milk" when the chosen SKU is a
    500 ml milk pouch. This keeps the UI and split math honest while still
    letting a rushed demo click recover gracefully.
    """

    requested_unit = unit.strip().lower()
    product_unit = str(product.get("unit", "piece")).strip().lower()
    product_unit_quantity = float(product.get("unit_quantity", 1))

    if requested_unit in COUNT_UNITS and product_unit in WEIGHT_UNITS | VOLUME_UNITS:
        return (
            quantity * product_unit_quantity,
            product_unit,
            (
                f"Interpreted {quantity:g} {requested_unit} as "
                f"{quantity * product_unit_quantity:g} {product_unit}, "
                f"because {product.get('name', 'this item')} is sold by {product_unit}."
            ),
        )

    if requested_unit == "l":
        return quantity, "litre", None
    if requested_unit == "liter":
        return quantity, "litre", None
    if requested_unit == "pieces":
        return quantity, "piece", None
    if requested_unit == "packs":
        return quantity, "pack", None
    return quantity, requested_unit, None


def _normalize_text(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def _product_phrases(product: dict) -> list[str]:
    phrases = [_normalize_text(product.get("name", ""))]
    raw_keywords = product.get("keywords", [])
    if isinstance(raw_keywords, str):
        raw_keywords = [raw_keywords]
    phrases.extend(_normalize_text(str(keyword)) for keyword in raw_keywords)
    return [phrase for phrase in phrases if phrase]


def _alias_match(name: str, products: list[dict]) -> Optional[dict]:
    query = _normalize_text(name)
    query_tokens = set(query.split())
    if not query:
        return None

    candidates = []
    for product in products:
        if not product.get("in_stock", True):
            continue
        phrases = _product_phrases(product)
        if query in phrases:
            candidates.append(product)
            continue
        if len(query_tokens) > 1 and any(
            query_tokens.issubset(set(phrase.split())) for phrase in phrases
        ):
            candidates.append(product)

    if not candidates:
        return None
    return max(candidates, key=lambda product: float(product.get("rating", 0)))


def _close_match_score(query: str, product: dict) -> float:
    normalized_query = _normalize_text(query)
    if not normalized_query:
        return 0.0

    query_tokens = set(normalized_query.split())
    best = 0.0
    for phrase in _product_phrases(product):
        phrase_tokens = set(phrase.split())
        sequence_score = SequenceMatcher(None, normalized_query, phrase).ratio()
        token_score = (
            len(query_tokens & phrase_tokens) / len(query_tokens)
            if query_tokens
            else 0.0
        )
        containment_score = (
            0.92
            if normalized_query in phrase or phrase in normalized_query
            else 0.0
        )
        best = max(best, sequence_score, token_score, containment_score)
    return best


def find_close_suggestions(
    name: str, products: list[dict], limit: int = 3
) -> list[ProductSuggestion]:
    scored = []
    for product in products:
        if not product.get("in_stock", True):
            continue
        score = _close_match_score(name, product)
        if score >= 0.62:
            scored.append((score, product))

    scored.sort(
        key=lambda entry: (
            entry[0],
            float(entry[1].get("rating", 0)),
        ),
        reverse=True,
    )
    return [
        ProductSuggestion(
            sku=product["sku"],
            name=product["name"],
            brand=product.get("brand", ""),
            price_per_unit_inr=float(product.get("price_inr", 0)),
            unit=product.get("unit", "piece"),
            unit_quantity=float(product.get("unit_quantity", 1)),
            reason=f"Closest catalog match to '{name}'",
            confidence=round(score, 2),
        )
        for score, product in scored[:limit]
    ]


def _family_tokens(product: dict) -> set[str]:
    tokens = set()
    for phrase in _product_phrases(product):
        tokens.update(phrase.split())
    return tokens


def _same_alternative_family(current: dict, candidate: dict) -> bool:
    current_tokens = _family_tokens(current)
    candidate_tokens = _family_tokens(candidate)
    if current_tokens & candidate_tokens:
        return True
    return any(
        current_tokens & family and candidate_tokens & family
        for family in _ALTERNATIVE_FAMILIES
    )


def find_better_deal(product: dict, products: list[dict]) -> Optional[dict]:
    """Return a cheaper, closely related catalog product when one exists."""

    subcategory = product.get("subcategory", "").lower()
    product_unit_quantity = float(product.get("unit_quantity", 1))
    product_price = float(product.get("price_inr", 0))
    product_unit_price = product_price / max(product_unit_quantity, 1)
    candidates = [
        candidate
        for candidate in products
        if candidate.get("sku") != product.get("sku")
        and candidate.get("in_stock", True)
        and candidate.get("subcategory", "").lower() == subcategory
        and candidate.get("unit", "piece") == product.get("unit", "piece")
        and (
            float(candidate.get("price_inr", 0))
            / max(float(candidate.get("unit_quantity", 1)), 1)
        )
        < product_unit_price
        and _same_alternative_family(product, candidate)
    ]
    if not candidates:
        return None

    alternative = min(
        candidates,
        key=lambda candidate: (
            float(candidate.get("price_inr", float("inf")))
            / max(float(candidate.get("unit_quantity", 1)), 1)
        ),
    )
    alternative_unit_price = float(alternative["price_inr"]) / max(
        float(alternative.get("unit_quantity", 1)), 1
    )
    savings = (product_unit_price - alternative_unit_price) * product_unit_quantity
    return {
        "sku": alternative["sku"],
        "name": alternative["name"],
        "brand": alternative.get("brand", ""),
        "price_per_unit_inr": float(alternative["price_inr"]),
        "unit": alternative.get("unit", "piece"),
        "unit_quantity": float(alternative.get("unit_quantity", 1)),
        "reason": f"Save Rs {savings:.0f} per equivalent pack with a similar option",
        "savings_per_unit_inr": savings,
    }


def resolve_collab_input(
    item_input: CollabItemInput,
    contributor: Contributor,
) -> tuple[Optional[CollabCartItem], list[ProductSuggestion]]:
    """Resolve one typed request using the main catalog matcher and quantity engine."""

    products = get_all_products()
    extracted = ExtractedItem(
        name=item_input.name.strip(),
        quantity=item_input.quantity,
        unit=item_input.unit.strip().lower(),
        category=item_input.category,
        notes=item_input.notes,
    )

    product, match_reason = _search_engine_match(extracted)
    if product is None:
        product = _exact_match(extracted.name, products)
        match_reason = "Matched by product name"
    if product is None:
        product = _keyword_overlap_match(extracted.name, products, extracted.category)
        match_reason = "Matched by keyword overlap"
    if product is None:
        product = _alias_match(extracted.name, products)
        match_reason = "Matched from a catalog alias"
    if product is None:
        return None, find_close_suggestions(extracted.name, products)

    normalized_quantity, normalized_unit, unit_note = _normalize_request_unit_for_product(
        extracted.quantity, extracted.unit, product
    )
    extracted = extracted.model_copy(
        update={"quantity": normalized_quantity, "unit": normalized_unit}
    )

    requested_base_amount, requested_base_unit = normalize_to_base_unit(
        extracted.quantity, extracted.unit, extracted.name
    )
    standalone_units = _calculate_quantity_units(
        recipe_quantity=extracted.quantity,
        recipe_unit=extracted.unit,
        product_unit=product.get("unit", "piece"),
        product_unit_quantity=float(product.get("unit_quantity", 1)),
        item_name=extracted.name,
    )
    demand = CollabDemand(
        contributor_id=contributor.id,
        contributor_name=contributor.name,
        requested_name=extracted.name,
        requested_quantity=extracted.quantity,
        requested_unit=extracted.unit,
        requested_base_amount=requested_base_amount,
        requested_base_unit=requested_base_unit,
        standalone_quantity_units=standalone_units,
        notes=unit_note or extracted.notes,
    )
    alternative = find_better_deal(product, products)
    resolved = CollabCartItem(
        id=str(uuid.uuid4()),
        sku=product["sku"],
        name=product["name"],
        brand=product.get("brand", ""),
        quantity=standalone_units,
        unit=product.get("unit", "piece"),
        unit_quantity=float(product.get("unit_quantity", 1)),
        category=product.get("category", "general"),
        estimated_price_inr=float(product.get("price_inr", 0)),
        added_by=contributor.id,
        added_by_name=contributor.name,
        notes=unit_note or item_input.notes,
        matched_from=[
            (
                f"{contributor.name}: {extracted.quantity:g} "
                f"{extracted.unit} {extracted.name}"
            )
        ],
        demands=[demand],
        pending_substitution=alternative,
        substitution_reason=unit_note or match_reason,
    )
    return resolved, []
