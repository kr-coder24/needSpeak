"""
Deterministic product ranker V2.
Scores retrieved candidates using a weighted combination of signals.

V2 improvements over V1:
- Brand preference boosted (20% → from 10%)
- New popularity signal based on review_count (10%)
- Dynamic weight adjustment by budget_mode
- Category-level popularity tiebreaker

Base weights (adjusted dynamically by budget_mode):
  0.25 * text_relevance
  0.15 * availability
  0.15 * price_fit
  0.15 * rating_quality
  0.20 * brand_preference
  0.10 * popularity

Each signal is normalized to [0, 1].
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Optional

from app.catalog.models import ProductCandidate, RankedProduct

logger = logging.getLogger(__name__)


@dataclass
class RankingContext:
    """Context passed to the ranker for scoring."""

    budget_inr: Optional[float] = None
    budget_mode: str = "balanced"  # value, balanced, premium
    dietary_pref: Optional[str] = None
    preferred_brands: list[str] = field(default_factory=list)
    avoided_brands: list[str] = field(default_factory=list)
    occasion: Optional[str] = None
    remaining_budget: Optional[float] = None
    favorite_skus: list[str] = field(default_factory=list)


def _get_weights(budget_mode: str) -> dict[str, float]:
    """
    Dynamic weight adjustment based on budget mode.
    - value: price_fit becomes dominant signal
    - premium: rating_quality and brand_preference dominate
    - balanced: even distribution
    """
    if budget_mode == "value":
        return {
            "text_relevance": 0.25,
            "availability": 0.10,
            "price_fit": 0.25,       # boosted
            "rating_quality": 0.10,   # reduced
            "brand_preference": 0.15, # slightly reduced
            "popularity": 0.10,
            "occasion_match": 0.05,
        }
    elif budget_mode == "premium":
        return {
            "text_relevance": 0.20,
            "availability": 0.10,
            "price_fit": 0.05,       # almost ignored
            "rating_quality": 0.25,   # boosted
            "brand_preference": 0.25, # boosted
            "popularity": 0.10,
            "occasion_match": 0.05,
        }
    else:  # balanced
        return {
            "text_relevance": 0.25,
            "availability": 0.10,
            "price_fit": 0.15,
            "rating_quality": 0.15,
            "brand_preference": 0.20,
            "popularity": 0.10,
            "occasion_match": 0.05,
        }


def _normalize_text_score(score: float, max_score: float) -> float:
    """Normalize BM25/text score to [0, 1]."""
    if max_score <= 0:
        return 0.0
    return min(1.0, score / max_score)


def _availability_score(candidate: ProductCandidate) -> float:
    """1.0 if in stock, 0.0 if not."""
    return 1.0 if candidate.in_stock else 0.0


def _price_fit_score(
    price: float,
    budget_mode: str,
    remaining_budget: Optional[float],
    all_prices: list[float],
) -> float:
    """
    Score how well the price fits the user's budget mode and remaining budget.
    - value mode: cheaper is better
    - premium mode: moderate-to-high price is acceptable
    - balanced: middle range is best
    """
    if not all_prices:
        return 0.5

    min_price = min(all_prices)
    max_price = max(all_prices)
    price_range = max_price - min_price

    if price_range == 0:
        return 1.0

    normalized = (price - min_price) / price_range  # 0 = cheapest, 1 = most expensive

    if budget_mode == "value":
        # Cheaper is better
        score = 1.0 - normalized
    elif budget_mode == "premium":
        # Higher quality/price acceptable; slight penalty for very cheap
        score = 0.3 + 0.7 * normalized
    else:
        # Balanced: middle range is best (bell curve around 0.4)
        score = 1.0 - abs(normalized - 0.4) * 1.5
        score = max(0.0, min(1.0, score))

    # Penalty if price exceeds remaining budget
    if remaining_budget is not None and price > remaining_budget:
        over_ratio = (price - remaining_budget) / max(remaining_budget, 1)
        penalty = min(0.3, over_ratio * 0.2)
        score = max(0.0, score - penalty)

    return score


def _rating_quality_score(rating: float, review_count: int) -> float:
    """
    Combine rating and review count into a quality signal.
    Uses log(review_count) to not over-weight popular items.
    """
    if rating <= 0:
        return 0.0

    # Normalize rating: assume 1-5 scale
    rating_norm = (rating - 1.0) / 4.0  # [0, 1]

    # Review count confidence: log scale, cap at 1.0
    review_confidence = min(1.0, math.log(max(review_count, 1) + 1) / math.log(1000))

    # Weighted combination: rating matters more, reviews add confidence
    return 0.7 * rating_norm + 0.3 * review_confidence


def _popularity_score(review_count: int, max_review_count: int) -> float:
    """
    Standalone popularity signal based on review_count as a proxy for market share.
    Products with more reviews = more widely purchased = safer default choice.
    Uses log scale to prevent extreme dominance.
    """
    if max_review_count <= 0 or review_count <= 0:
        return 0.0
    # Log-normalized: log(count)/log(max) — caps at 1.0
    return min(1.0, math.log(review_count + 1) / math.log(max_review_count + 1))


def _brand_preference_score(
    brand: str,
    preferred_brands: list[str],
    avoided_brands: list[str],
) -> float:
    """
    1.0 if preferred brand, 0.0 if avoided brand, 0.4 otherwise.
    Partial match supported (e.g., "Tata" matches "Tata Sampann").
    """
    brand_lower = brand.lower()

    # Exact or partial match for preferred brands
    for b in preferred_brands:
        b_lower = b.lower()
        if b_lower == brand_lower or b_lower in brand_lower or brand_lower in b_lower:
            return 1.0

    # Exact or partial match for avoided brands
    for b in avoided_brands:
        b_lower = b.lower()
        if b_lower == brand_lower or b_lower in brand_lower or brand_lower in b_lower:
            return 0.0

    return 0.4


def _occasion_match_score(
    candidate: ProductCandidate,
    occasion: Optional[str],
) -> float:
    """1.0 if product is tagged for the occasion, 0.3 otherwise."""
    if not occasion:
        return 0.5

    occasion_lower = occasion.lower()
    if any(occasion_lower in str(t).lower() for t in candidate.occasion_tags):
        return 1.0

    # Partial match on keywords
    if any(occasion_lower in str(k).lower() for k in candidate.keywords):
        return 0.7

    return 0.3


def rank_candidates(
    candidates: list[ProductCandidate],
    context: RankingContext,
) -> list[RankedProduct]:
    """
    Rank retrieved candidates using weighted scoring.
    Returns sorted list of RankedProduct with score breakdowns.
    """
    if not candidates:
        return []

    # Get max values for normalization
    max_text_score = max(c.text_score for c in candidates) if candidates else 1.0
    max_review_count = max(c.review_count for c in candidates) if candidates else 1
    all_prices = [c.price_inr for c in candidates]

    # Get dynamic weights based on budget mode
    weights = _get_weights(context.budget_mode)

    ranked: list[RankedProduct] = []

    for candidate in candidates:
        # Calculate each signal
        text_rel = _normalize_text_score(candidate.text_score, max_text_score)
        availability = _availability_score(candidate)
        price_fit = _price_fit_score(
            candidate.price_inr,
            context.budget_mode,
            context.remaining_budget,
            all_prices,
        )
        rating_quality = _rating_quality_score(candidate.rating, candidate.review_count)
        brand_pref = _brand_preference_score(
            candidate.brand,
            context.preferred_brands,
            context.avoided_brands,
        )
        popularity = _popularity_score(candidate.review_count, max_review_count)
        occasion = _occasion_match_score(candidate, context.occasion)
        
        is_favorite = candidate.sku in context.favorite_skus

        # Weighted sum
        score = (
            weights["text_relevance"] * text_rel
            + weights["availability"] * availability
            + weights["price_fit"] * price_fit
            + weights["rating_quality"] * rating_quality
            + weights["brand_preference"] * brand_pref
            + weights["popularity"] * popularity
            + weights["occasion_match"] * occasion
        )
        
        if is_favorite:
            score += 2.0  # Massive boost to ensure it ranks #1

        # Build reason codes
        reason_codes: list[str] = []
        if is_favorite:
            reason_codes.append("favorite")
        if text_rel > 0.7:
            reason_codes.append("keyword_match")
        if brand_pref == 1.0:
            reason_codes.append("preferred_brand")
        if price_fit > 0.7:
            reason_codes.append("budget_friendly")
        if rating_quality > 0.7:
            reason_codes.append("high_rating")
        if popularity > 0.7:
            reason_codes.append("popular_choice")
        if availability == 1.0:
            reason_codes.append("in_stock")
        if occasion > 0.7:
            reason_codes.append("occasion_match")

        # Build human-readable reason
        display_reason = _build_display_reason(reason_codes, candidate)

        ranked.append(RankedProduct(
            sku=candidate.sku,
            title=candidate.title,
            brand=candidate.brand,
            category=candidate.category,
            price_inr=candidate.price_inr,
            unit=candidate.unit,
            unit_quantity=candidate.unit_quantity,
            rating=candidate.rating,
            review_count=candidate.review_count,
            in_stock=candidate.in_stock,
            dietary_tags=candidate.dietary_tags,
            image_url=candidate.image_url,
            score=round(score, 4),
            score_breakdown={
                "text_relevance": round(text_rel, 3),
                "availability": round(availability, 3),
                "price_fit": round(price_fit, 3),
                "rating_quality": round(rating_quality, 3),
                "brand_preference": round(brand_pref, 3),
                "popularity": round(popularity, 3),
                "occasion_match": round(occasion, 3),
            },
            reason_codes=reason_codes,
            display_reason=display_reason,
        ))

    # Sort by score descending
    ranked.sort(key=lambda r: r.score, reverse=True)

    logger.debug(f"Ranked {len(ranked)} candidates, top={ranked[0].title if ranked else 'none'} (score={ranked[0].score if ranked else 0})")
    return ranked


def _build_display_reason(reason_codes: list[str], candidate: ProductCandidate) -> str:
    """Build a concise human-readable reason for product selection."""
    parts: list[str] = []

    if "favorite" in reason_codes:
        parts.append("Your favourite")
    elif "preferred_brand" in reason_codes:
        parts.append(f"Your preferred brand ({candidate.brand})")
    if "popular_choice" in reason_codes and "preferred_brand" not in reason_codes and "favorite" not in reason_codes:
        parts.append("Most popular in category")
    if "keyword_match" in reason_codes:
        parts.append("Matched your request")
    if "high_rating" in reason_codes:
        parts.append(f"Rated {candidate.rating}★")
    if "budget_friendly" in reason_codes:
        parts.append("Fits your budget")
    if "occasion_match" in reason_codes:
        parts.append("Great for this occasion")

    if not parts:
        parts.append("Best available match")

    return " · ".join(parts)
