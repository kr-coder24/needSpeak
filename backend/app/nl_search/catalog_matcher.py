"""
Lightweight Catalog Matcher for Natural Language Search

Applies parsed query filters to the demo catalog.
Simple heuristic matching designed for hackathon demo.
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from dataclasses import dataclass, field

from app.nl_search.query_parser import ParsedQuery
from app.nl_search.demo_catalog import get_unified_catalog

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Matched Product Schema
# ---------------------------------------------------------------------------

@dataclass
class MatchedProduct:
    """A product matched from the catalog with relevance info."""
    
    sku: str
    name: str
    brand: str
    category: str
    price_inr: int
    specs: dict[str, Any]
    features: list[str]
    tags: list[str]
    rating: float
    review_count: int
    in_stock: bool
    image_url: str
    
    # Match scoring
    relevance_score: float = 0.0
    match_reasons: list[str] = field(default_factory=list)
    missing_requirements: list[str] = field(default_factory=list)
    
    # Why this product was selected
    explanation: str = ""


# ---------------------------------------------------------------------------
# Scoring Weights
# ---------------------------------------------------------------------------

SCORE_WEIGHTS = {
    "required_spec_match": 30.0,      # Each required spec that matches
    "required_spec_miss": -50.0,      # Each required spec that's missing
    "preferred_feature_match": 10.0,  # Each preferred feature found
    "use_case_match": 8.0,            # Each matching use case tag
    "brand_match": 15.0,              # Preferred brand
    "brand_avoid": -100.0,            # Avoided brand (heavy penalty)
    "budget_under": 5.0,              # Within budget
    "budget_over": -20.0,             # Over budget (per 10% over)
    "rating_bonus": 3.0,              # Per 0.1 rating above 4.0
    "popularity_bonus": 0.001,        # Per review count
}


# ---------------------------------------------------------------------------
# Spec Matching Logic
# ---------------------------------------------------------------------------

def _check_spec(spec_name: str, requirement: Any, product_specs: dict) -> tuple[bool, str]:
    """
    Check if a product spec meets the requirement.
    
    Returns:
        (matches, reason_string)
    """
    actual_value = product_specs.get(spec_name)
    
    if actual_value is None:
        return False, f"Missing {spec_name}"
    
    # Boolean check
    if isinstance(requirement, bool):
        matches = actual_value == requirement
        return matches, f"{spec_name}: {'✓' if matches else '✗'}"
    
    # Range check (min/max)
    if isinstance(requirement, dict):
        min_val = requirement.get("min")
        max_val = requirement.get("max")
        
        if min_val is not None and actual_value < min_val:
            return False, f"{spec_name}: {actual_value} (need ≥{min_val})"
        if max_val is not None and actual_value > max_val:
            return False, f"{spec_name}: {actual_value} (need ≤{max_val})"
        
        return True, f"{spec_name}: {actual_value} ✓"
    
    # Exact match
    if actual_value == requirement:
        return True, f"{spec_name}: {actual_value} ✓"
    
    return False, f"{spec_name}: {actual_value} (need {requirement})"


def _calculate_feature_match(
    preferred_features: list[str],
    product_features: list[str],
    product_tags: list[str],
) -> tuple[int, list[str]]:
    """Calculate how many preferred features match."""
    matches = 0
    reasons = []
    
    product_text = " ".join(product_features + product_tags).lower()
    
    for feature in preferred_features:
        feature_lower = feature.lower()
        # Check direct match or partial match
        if feature_lower in product_text:
            matches += 1
            reasons.append(f"Has: {feature}")
        # Check common synonyms
        elif _feature_synonym_match(feature_lower, product_text):
            matches += 1
            reasons.append(f"Has: {feature}")
    
    return matches, reasons


def _feature_synonym_match(feature: str, product_text: str) -> bool:
    """Check for synonym/related term matches."""
    synonyms = {
        "good battery": ["long battery", "all-day", "5000mah", "4500mah", "big battery"],
        "fast charging": ["quick charge", "turbo charge", "rapid charge", "100w", "67w", "45w"],
        "gaming": ["game", "esports", "high performance", "rtx", "gpu"],
        "coding": ["programming", "developer", "office", "productivity"],
        "camera": ["photo", "mp", "zoom", "portrait"],
        "lightweight": ["light", "portable", "thin", "slim", "ultrabook"],
        "noise cancellation": ["anc", "noise cancel", "noise reduction"],
        "running": ["jogging", "marathon", "runner", "cushion"],
        "budget": ["affordable", "value", "cheap", "entry"],
        "premium": ["flagship", "high-end", "best", "top"],
    }
    
    for key, syns in synonyms.items():
        if feature in key or key in feature:
            for syn in syns:
                if syn in product_text:
                    return True
    
    return False


# ---------------------------------------------------------------------------
# Main Matching Function
# ---------------------------------------------------------------------------

def match_products(
    parsed_query: ParsedQuery,
    catalog: list[dict] | None = None,
    limit: int = 10,
) -> list[MatchedProduct]:
    """
    Match products from catalog against parsed query.
    
    Args:
        parsed_query: Structured query from LLM
        catalog: Product catalog (defaults to unified catalog with 587+ products)
        limit: Maximum number of results
    
    Returns:
        List of MatchedProduct sorted by relevance
    """
    if catalog is None:
        catalog = get_unified_catalog()
    
    logger.info(
        f"[NL Search] Matching: category={parsed_query.category}, "
        f"specs={parsed_query.required_specs}, "
        f"features={parsed_query.preferred_features}, "
        f"budget={parsed_query.max_budget_inr}, "
        f"catalog_size={len(catalog)}"
    )
    
    matched: list[MatchedProduct] = []
    
    # Build a text-based search from the original query for fuzzy matching
    query_tokens = set(parsed_query.original_query.lower().split())
    
    for product in catalog:
        # Category filter (if specified and not "general")
        if parsed_query.category and parsed_query.category != "general":
            if product["category"].lower() != parsed_query.category.lower():
                continue
        
        # Check for avoided brands (hard filter)
        if parsed_query.avoided_brands:
            if product["brand"].lower() in [b.lower() for b in parsed_query.avoided_brands]:
                continue
        
        # Start scoring
        score = 0.0
        match_reasons = []
        missing_requirements = []
        
        # 1. Required specs matching (for electronics with specs dict)
        for spec_name, requirement in parsed_query.required_specs.items():
            # Check in product specs
            matches, reason = _check_spec(spec_name, requirement, product.get("specs", {}))
            if matches:
                score += SCORE_WEIGHTS["required_spec_match"]
                match_reasons.append(reason)
            else:
                # For grocery items, check dietary tags
                if spec_name == "dietary" and isinstance(requirement, str):
                    dietary_tags = product.get("dietary_tags", [])
                    if requirement.lower() in [d.lower() for d in dietary_tags]:
                        score += SCORE_WEIGHTS["required_spec_match"]
                        match_reasons.append(f"Dietary: {requirement} ✓")
                    else:
                        score += SCORE_WEIGHTS["required_spec_miss"]
                        missing_requirements.append(f"Not {requirement}")
                else:
                    score += SCORE_WEIGHTS["required_spec_miss"]
                    missing_requirements.append(reason)
        
        # 2. Preferred features matching
        feature_matches, feature_reasons = _calculate_feature_match(
            parsed_query.preferred_features,
            product.get("features", []),
            product.get("tags", []),
        )
        score += feature_matches * SCORE_WEIGHTS["preferred_feature_match"]
        match_reasons.extend(feature_reasons)
        
        # 3. Use case matching
        for use_case in parsed_query.use_cases:
            use_case_lower = use_case.lower()
            product_text = " ".join(
                product.get("tags", []) + 
                product.get("features", []) + 
                product.get("keywords", []) +
                product.get("occasion_tags", [])
            ).lower()
            if use_case_lower in product_text:
                score += SCORE_WEIGHTS["use_case_match"]
                match_reasons.append(f"Good for: {use_case}")
        
        # 4. Text-based name/keyword matching (important for grocery items)
        product_searchable = " ".join([
            product.get("name", ""),
            " ".join(product.get("keywords", [])),
            " ".join(product.get("synonyms", [])),
            product.get("subcategory", ""),
        ]).lower()
        
        text_overlap = query_tokens & set(product_searchable.split())
        # Remove common stop words from overlap
        stop_words = {"a", "an", "the", "for", "with", "and", "or", "in", "on", "to", "of", "under", "below"}
        text_overlap -= stop_words
        if text_overlap:
            text_score = len(text_overlap) * 5.0
            score += text_score
            if len(text_overlap) >= 2:
                match_reasons.append(f"Name match: {', '.join(list(text_overlap)[:3])}")
        
        # 5. Brand preference
        if parsed_query.preferred_brands:
            if product["brand"].lower() in [b.lower() for b in parsed_query.preferred_brands]:
                score += SCORE_WEIGHTS["brand_match"]
                match_reasons.append(f"Preferred brand: {product['brand']}")
        
        # 6. Budget scoring
        if parsed_query.max_budget_inr:
            if product["price_inr"] <= parsed_query.max_budget_inr:
                score += SCORE_WEIGHTS["budget_under"]
                match_reasons.append(f"Within budget (₹{product['price_inr']:,})")
            else:
                # Penalty for being over budget
                over_percent = (product["price_inr"] - parsed_query.max_budget_inr) / parsed_query.max_budget_inr
                penalty = over_percent * 10 * SCORE_WEIGHTS["budget_over"]
                score += penalty
                missing_requirements.append(f"Over budget by ₹{product['price_inr'] - parsed_query.max_budget_inr:,}")
        
        # 7. Budget preference (value vs premium) — stronger penalty/boost
        if parsed_query.budget_preference == "budget":
            # Hard cap: heavy penalty for items over 1.2× median category price
            cat_prices = [p["price_inr"] for p in catalog if p["category"] == product["category"] and p.get("price_inr", 0) > 0]
            if cat_prices:
                median_price = sorted(cat_prices)[len(cat_prices) // 2]
                if product["price_inr"] > median_price * 1.2:
                    score -= 40  # heavy penalty for expensive items in budget mode
                elif product["price_inr"] < median_price * 0.7:
                    score += 20  # strong boost for genuinely cheap items
            # Also apply max-price normalised boost
            max_price_cat = max((p["price_inr"] for p in catalog if p["category"] == product["category"]), default=200000)
            if max_price_cat > 0:
                score += (1 - (product["price_inr"] / max_price_cat)) * 20
        elif parsed_query.budget_preference == "premium":
            if any(t in product.get("tags", []) for t in ["premium", "flagship", "best"]):
                score += 10
                match_reasons.append("Premium product")
        
        # 8. Rating and popularity bonus
        rating = product.get("rating", 0)
        if rating > 4.0:
            rating_bonus = (rating - 4.0) * 10 * SCORE_WEIGHTS["rating_bonus"]
            score += rating_bonus
            if rating >= 4.5:
                match_reasons.append(f"Highly rated: {rating}★")
        
        review_count = product.get("review_count", 0)
        score += review_count * SCORE_WEIGHTS["popularity_bonus"]
        
        # Skip products with very low scores (not relevant at all)
        if score <= -30 and not match_reasons:
            continue
        
        # Build explanation
        explanation = _build_explanation(
            product, parsed_query, match_reasons, missing_requirements
        )
        
        matched.append(MatchedProduct(
            sku=product["sku"],
            name=product["name"],
            brand=product["brand"],
            category=product["category"],
            price_inr=product["price_inr"],
            specs=product.get("specs", {}),
            features=product.get("features", []),
            tags=product.get("tags", []),
            rating=product.get("rating", 0),
            review_count=product.get("review_count", 0),
            in_stock=product.get("in_stock", True),
            image_url=product.get("image_url", ""),
            relevance_score=score,
            match_reasons=match_reasons,
            missing_requirements=missing_requirements,
            explanation=explanation,
        ))
    
    # Sort by relevance score (highest first)
    matched.sort(key=lambda x: x.relevance_score, reverse=True)
    
    # Log results
    logger.info(f"[NL Search] Found {len(matched)} products, returning top {limit}")
    for i, m in enumerate(matched[:3]):
        logger.debug(f"  #{i+1}: {m.name} (score={m.relevance_score:.1f})")
    
    return matched[:limit]


def _build_explanation(
    product: dict,
    query: ParsedQuery,
    match_reasons: list[str],
    missing_requirements: list[str],
) -> str:
    """Build a human-readable explanation of why this product was selected."""
    parts = []
    
    # Product intro
    parts.append(f"{product['brand']} {product['name']}")
    
    # Key matches
    if match_reasons:
        top_reasons = match_reasons[:3]
        parts.append(f" matches your requirements: {', '.join(top_reasons)}")
    
    # Price context
    if query.max_budget_inr:
        if product["price_inr"] <= query.max_budget_inr:
            parts.append(f". Priced at ₹{product['price_inr']:,}, within your budget of ₹{query.max_budget_inr:,}")
        else:
            over = product["price_inr"] - query.max_budget_inr
            parts.append(f". At ₹{product['price_inr']:,}, it's ₹{over:,} over your budget of ₹{query.max_budget_inr:,}")
    else:
        parts.append(f". Priced at ₹{product['price_inr']:,}")
    
    # Rating
    if product.get("rating", 0) >= 4.5:
        parts.append(f" with excellent ratings ({product['rating']}★)")
    elif product.get("rating", 0) >= 4.0:
        parts.append(f" with good ratings ({product['rating']}★)")
    
    # Missing requirements
    if missing_requirements and not any("budget" in r.lower() for r in missing_requirements):
        parts.append(f". Note: {', '.join(missing_requirements[:2])}")
    
    return "".join(parts) + "."


# ---------------------------------------------------------------------------
# Convenience Functions
# ---------------------------------------------------------------------------

def search_products(
    query: str,
    mock_mode: bool = False,
    limit: int = 5,
) -> tuple[ParsedQuery, list[MatchedProduct]]:
    """
    End-to-end natural language product search.
    
    Args:
        query: Natural language search query
        mock_mode: If True, use mock LLM responses
        limit: Maximum results to return
    
    Returns:
        (parsed_query, matched_products)
    """
    from app.nl_search.query_parser import parse_product_query
    
    # Parse the query
    parsed = parse_product_query(query, mock_mode=mock_mode)
    
    # Match products
    results = match_products(parsed, limit=limit)
    
    return parsed, results
