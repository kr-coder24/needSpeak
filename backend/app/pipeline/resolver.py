"""
SKU Resolution — Retrieval + Ranking Engine

V2 Architecture:
1. Extract item from LLM output
2. Build ProductQuery from extracted item
3. Retrieve top N candidates via LocalRetriever (BM25 scoring)
4. Rank candidates using weighted scoring (relevance, price, rating, preferences)
5. Select top-ranked product + alternatives
6. Calculate quantities via unit normalization
7. Handle budget optimization with pending substitutions

This replaces the legacy keyword-only matching with a proper retrieval+ranking pipeline.
"""

from __future__ import annotations

import logging
import math
from typing import Optional

from app.models import ExtractedItem, CartItem, UnavailableItem, UnavailableReason
from app.unit_conversions import normalize_to_base_unit
from app.db.dynamo import get_all_products
from app.db.s3 import store_failed_match_log
import os

# New V2 imports
from app.catalog.models import ProductQuery, RankedProduct
from app.search.local_retrieval import LocalRetriever
from app.search.ranker import rank_candidates, RankingContext

logger = logging.getLogger(__name__)

# Singleton retriever instance (lazy-loaded)
from app.search.retrieval import ProductRetriever
_retriever: Optional[ProductRetriever] = None


def _get_retriever(mock_mode: bool = False) -> ProductRetriever:
    """
    Get or create the retriever singleton.
    
    Priority:
    1. SEARCH_PROVIDER=opensearch -> OpenSearchRetriever (if explicitly set)
    2. SEARCH_PROVIDER=hybrid (default) -> HybridRetriever (BM25 + synonyms + fuzzy)
    3. SEARCH_PROVIDER=local -> LocalVectorRetriever (vector-only fallback)
    """
    global _retriever
    if _retriever is None:
        provider = os.getenv("SEARCH_PROVIDER", "hybrid").strip().lower()
        
        if provider == "opensearch":
            from app.search.opensearch_retrieval import OpenSearchRetriever
            host = os.getenv("OPENSEARCH_HOST", "")
            _retriever = OpenSearchRetriever(host=host, mock_mode=mock_mode)
        elif provider == "local":
            # Legacy local vector retrieval
            from app.search.local_vector_retrieval import LocalVectorRetriever
            _retriever = LocalVectorRetriever(mock_mode=mock_mode)
        else:
            # Default: hybrid retriever (BM25 + synonyms + fuzzy matching)
            from app.search.hybrid_retrieval import HybridRetriever
            _retriever = HybridRetriever(mock_mode=mock_mode)
            
    return _retriever


# ---------------------------------------------------------------------------
# V2 Retrieval + Ranking
# ---------------------------------------------------------------------------
def _match_product_v2(
    item: ExtractedItem,
    context: RankingContext,
    mock_mode: bool = False,
) -> tuple[Optional[RankedProduct], list[RankedProduct]]:
    """
    V2 matching using retrieval + ranking pipeline.
    
    Returns:
        (best_match, alternatives) - best_match is None if no candidates found
    """
    retriever = _get_retriever(mock_mode=mock_mode)
    
    # Build query from extracted item
    query = ProductQuery(
        query_text=item.name,
        category=item.category if item.category != "general" else None,
        dietary_filter=context.dietary_pref,
        max_price=context.remaining_budget,
        preferred_brands=context.preferred_brands,
        avoided_brands=context.avoided_brands,
    )
    
    # Retrieve candidates (top 20 for ranking)
    candidates = retriever.retrieve(query, limit=20)
    
    if not candidates:
        logger.warning(f"No candidates found for: '{item.name}' (category: {item.category})")
        return None, []
    
    # Rank candidates
    ranked = rank_candidates(candidates, context)
    
    if not ranked:
        logger.warning(f"Ranking returned empty for: '{item.name}'")
        return None, []
    
    # Best match is top-ranked, alternatives are next 3
    best = ranked[0]
    alternatives = ranked[1:4] if len(ranked) > 1 else []
    
    logger.debug(
        f"V2 match: '{item.name}' -> {best.title} ({best.brand}) "
        f"score={best.score:.3f} reasons={best.reason_codes}"
    )
    
    return best, alternatives


# ---------------------------------------------------------------------------
# Quantity Calculation (unchanged from V1)
# ---------------------------------------------------------------------------
def _calculate_quantity_units(
    recipe_quantity: float,
    recipe_unit: str,
    product_unit: str,
    product_unit_quantity: float,
    item_name: str = "",
) -> int:
    """
    Calculate how many product units to purchase.

    Example: recipe needs 300g, product is 1000g bag -> ceil(300/1000) = 1 bag
    Example: recipe needs 2.5L, product is 1000ml bottle -> ceil(2500/1000) = 3 bottles
    """
    # Normalize recipe quantity to base unit
    recipe_base_amount, recipe_base_unit = normalize_to_base_unit(
        recipe_quantity, recipe_unit, item_name
    )

    # If units are compatible (both g, both ml, etc.)
    product_base_unit = product_unit.lower().strip()

    # Direct comparison if same base unit
    if recipe_base_unit == product_base_unit:
        return max(1, math.ceil(recipe_base_amount / product_unit_quantity))

    # Handle ml <-> g cross-conversion (approximately 1:1 for most food items)
    if (recipe_base_unit == "ml" and product_base_unit == "g") or \
       (recipe_base_unit == "g" and product_base_unit == "ml"):
        return max(1, math.ceil(recipe_base_amount / product_unit_quantity))

    # Handle piece/pack — just use the quantity directly
    if recipe_base_unit in ("piece", "pack") or product_base_unit in ("piece", "pack"):
        return max(1, math.ceil(recipe_quantity))

    # Cross-unit — can't reliably convert, default to 1
    logger.warning(
        f"Cannot convert {recipe_quantity}{recipe_unit} ({recipe_base_unit}) "
        f"to product unit {product_unit} for '{item_name}'. Defaulting to 1."
    )
    return 1


# ---------------------------------------------------------------------------
# Build CartItem from RankedProduct
# ---------------------------------------------------------------------------
def _build_cart_item(
    item: ExtractedItem,
    product: RankedProduct,
    alternatives: list[RankedProduct],
) -> CartItem:
    """Convert a RankedProduct to a CartItem with quantity calculation."""
    
    quantity_units = _calculate_quantity_units(
        recipe_quantity=item.quantity,
        recipe_unit=item.unit,
        product_unit=product.unit,
        product_unit_quantity=product.unit_quantity,
        item_name=item.name,
    )
    
    price_per_unit = product.price_inr
    total_price = price_per_unit * quantity_units
    
    # Build alternatives list for frontend
    alt_list = []
    for alt in alternatives:
        alt_qty = _calculate_quantity_units(
            recipe_quantity=item.quantity,
            recipe_unit=item.unit,
            product_unit=alt.unit,
            product_unit_quantity=alt.unit_quantity,
            item_name=item.name,
        )
        alt_total = alt.price_inr * alt_qty
        savings = total_price - alt_total
        
        alt_list.append({
            "sku": alt.sku,
            "name": alt.title,
            "brand": alt.brand,
            "price_per_unit": alt.price_inr,
            "price_per_unit_inr": alt.price_inr,
            "quantity_units": alt_qty,
            "total_price_inr": alt_total,
            "unit": alt.unit,
            "unit_quantity": alt.unit_quantity,
            "rating": alt.rating,
            "reason": f"Save ₹{savings:.0f}" if savings > 0 else (
                f"Higher rated ({alt.rating}★)" if alt.rating > product.rating else "Alternative"
            ),
        })
    
    return CartItem(
        sku=product.sku,
        name=product.title,
        brand=product.brand,
        quantity_units=quantity_units,
        unit=product.unit,
        unit_quantity=product.unit_quantity,
        price_per_unit_inr=price_per_unit,
        total_price_inr=total_price,
        optional=item.optional,
        substituted=False,
        substitution_reason=None,
        matched_from=[f"{item.name} ({item.quantity} {item.unit})"],
        # V2 additions
        alternatives=alt_list,
        reason_codes=product.reason_codes,
        display_reason=product.display_reason,
        stock_status="available" if product.in_stock else "low_stock",
    )


# ---------------------------------------------------------------------------
# Budget Optimization (updated to use V2 alternatives)
# ---------------------------------------------------------------------------
def _optimize_for_budget(
    cart_items: list[CartItem],
    budget_inr: int,
) -> tuple[list[CartItem], bool]:
    """
    Budget optimization using V2 alternatives.
    If cart exceeds budget, suggest cheaper alternatives as pending_substitution.
    """
    total = sum(item.total_price_inr for item in cart_items)
    if total <= budget_inr:
        return cart_items, False

    logger.info(f"Cart total Rs.{total} exceeds budget Rs.{budget_inr}. Optimizing...")

    optimized = []
    for item in cart_items:
        if item.optional:
            optimized.append(item)
            continue

        # Check if any alternative is cheaper
        cheaper_alts = [
            alt for alt in item.alternatives
            if alt.get("total_price_inr", float("inf")) < item.total_price_inr
        ]
        
        if cheaper_alts:
            # Pick the cheapest alternative
            cheapest = min(cheaper_alts, key=lambda a: a.get("total_price_inr", float("inf")))
            savings = item.total_price_inr - cheapest["total_price_inr"]
            
            updated_item = item.model_copy(update={
                "pending_substitution": {
                    "name": cheapest["name"],
                    "sku": cheapest["sku"],
                    "brand": cheapest["brand"],
                    "price_per_unit_inr": cheapest["price_per_unit_inr"],
                    "quantity_units": cheapest["quantity_units"],
                    "unit": item.unit,
                    "unit_quantity": item.unit_quantity,
                    "total_price_inr": cheapest["total_price_inr"],
                    "reason": f"Save ₹{savings:.0f}",
                },
            })
            optimized.append(updated_item)
            logger.info(
                f"Pending substitution for '{item.name}' -> '{cheapest['name']}' "
                f"(potential saving ₹{savings:.0f})"
            )
        else:
            optimized.append(item)

    new_total = sum(i.total_price_inr for i in optimized)
    budget_exceeded = new_total > budget_inr

    return optimized, budget_exceeded


# ---------------------------------------------------------------------------
# Main Resolution Entry Point (V2)
# ---------------------------------------------------------------------------
def resolve_cart(
    items: list[ExtractedItem],
    budget_inr: Optional[int] = None,
    session_id: str = "",
    mock_mode: bool = False,
    # V2 preference params
    dietary_pref: Optional[str] = None,
    preferred_brands: Optional[list[str]] = None,
    avoided_brands: Optional[list[str]] = None,
    budget_mode: str = "balanced",
    occasion: Optional[str] = None,
) -> tuple[list[CartItem], list[UnavailableItem], float, bool]:
    """
    Resolve extracted items to real products using retrieval + ranking.

    V2 adds:
    - dietary_pref: "veg", "vegan", "jain", or None for any
    - preferred_brands: list of brand names to boost
    - avoided_brands: list of brand names to filter out
    - budget_mode: "value", "balanced", or "premium"
    - occasion: occasion tag for relevance boosting

    Returns:
        (cart_items, unavailable_items, total_price, budget_exceeded)
    """
    cart_items: list[CartItem] = []
    unavailable_items: list[UnavailableItem] = []
    
    # Track remaining budget for progressive allocation
    remaining_budget = float(budget_inr) if budget_inr else None
    
    # Build ranking context
    context = RankingContext(
        budget_inr=float(budget_inr) if budget_inr else None,
        budget_mode=budget_mode,
        dietary_pref=dietary_pref,
        preferred_brands=preferred_brands or [],
        avoided_brands=avoided_brands or [],
        occasion=occasion,
        remaining_budget=remaining_budget,
    )

    for item in items:
        # Use V2 retrieval + ranking
        best_match, alternatives = _match_product_v2(item, context, mock_mode=mock_mode)

        if best_match is None:
            unavailable_items.append(UnavailableItem(
                name=item.name,
                reason=UnavailableReason.NOT_IN_CATALOG,
            ))
            # Log failed match for catalog improvement
            store_failed_match_log(item.name, session_id)
            continue

        if not best_match.in_stock:
            # Try first alternative that's in stock
            in_stock_alt = next((a for a in alternatives if a.in_stock), None)
            if in_stock_alt:
                best_match = in_stock_alt
                alternatives = [a for a in alternatives if a.sku != in_stock_alt.sku]
            else:
                unavailable_items.append(UnavailableItem(
                    name=item.name,
                    reason=UnavailableReason.OUT_OF_STOCK,
                ))
                continue

        # Build cart item with alternatives
        cart_item = _build_cart_item(item, best_match, alternatives)
        cart_items.append(cart_item)
        
        # Update remaining budget
        if remaining_budget is not None:
            remaining_budget = max(0, remaining_budget - cart_item.total_price_inr)
            context.remaining_budget = remaining_budget

    # SKU Deduplication & Quantity Merging
    merged_items: dict[str, CartItem] = {}
    for item in cart_items:
        if item.sku in merged_items:
            existing = merged_items[item.sku]
            merged_qty = existing.quantity_units + item.quantity_units
            # Merge alternatives (deduplicate by SKU)
            existing_alt_skus = {a["sku"] for a in existing.alternatives}
            new_alts = [a for a in item.alternatives if a["sku"] not in existing_alt_skus]
            merged_alts = existing.alternatives + new_alts
            
            merged_items[item.sku] = existing.model_copy(update={
                "quantity_units": merged_qty,
                "total_price_inr": existing.price_per_unit_inr * merged_qty,
                "optional": existing.optional and item.optional,
                "matched_from": existing.matched_from + item.matched_from,
                "alternatives": merged_alts[:5],  # Keep top 5 alternatives
            })
        else:
            merged_items[item.sku] = item
    cart_items = list(merged_items.values())

    # Budget optimization
    budget_exceeded = False
    if budget_inr and cart_items:
        cart_items, budget_exceeded = _optimize_for_budget(cart_items, budget_inr)

    total_price = sum(item.total_price_inr for item in cart_items)

    logger.info(
        f"Resolution complete: {len(cart_items)} items in cart, "
        f"{len(unavailable_items)} unavailable, total Rs.{total_price:.0f}"
    )

    return cart_items, unavailable_items, total_price, budget_exceeded


# ---------------------------------------------------------------------------
# Legacy V1 Functions (kept for backward compatibility / fallback)
# ---------------------------------------------------------------------------
def _tokenize(text: str) -> set[str]:
    """Split text into lowercase word tokens for matching."""
    return set(text.lower().replace("-", " ").replace("_", " ").split())


STOP_WORDS = {
    "fresh", "organic", "large", "small", "medium", "raw", "whole", "pure", "natural", 
    "best", "good", "with", "and", "or", "of", "for", "in", "to", "a", "an", "the"
}


def _exact_match(item_name: str, products: list[dict]) -> Optional[dict]:
    """Try exact case-insensitive match on product name."""
    name_lower = item_name.lower().strip()
    for p in products:
        if p["name"].lower() == name_lower:
            if p.get("in_stock", True):
                return p
    return None


def _keyword_overlap_match(item_name: str, products: list[dict], category: Optional[str] = None) -> Optional[dict]:
    """Legacy keyword overlap matching."""
    item_tokens = _tokenize(item_name) - STOP_WORDS
    if not item_tokens:
        item_tokens = _tokenize(item_name)
        
    best_product = None
    best_score = 0

    for p in products:
        if not p.get("in_stock", True):
            continue

        product_keywords = set()
        kw_raw = p.get("keywords", [])
        if isinstance(kw_raw, (set, list)):
            for kw in kw_raw:
                product_keywords.update(_tokenize(str(kw)))
        elif isinstance(kw_raw, str):
            product_keywords.update(_tokenize(kw_raw))

        product_keywords.update(_tokenize(p.get("name", "")))
        product_keywords = product_keywords - STOP_WORDS

        overlap_tokens = item_tokens & product_keywords
        overlap = len(overlap_tokens)

        category_boost = 0.0
        if category and p.get("category", "").lower() == category.lower():
            category_boost = 0.5

        score = overlap + category_boost

        if overlap > 0 and score > best_score:
            if len(item_tokens) > 1:
                ratio = overlap / len(item_tokens)
                if overlap < 2 and ratio < 0.4:
                    continue
            best_score = score
            best_product = p

    return best_product


def _category_fallback(category: str, products: list[dict]) -> Optional[dict]:
    """Pick the highest-rated in-stock product in the given category."""
    candidates = [
        p for p in products
        if p.get("category", "").lower() == category.lower()
        and p.get("in_stock", True)
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.get("rating", 0))
