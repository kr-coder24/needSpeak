"""
Deterministic product ranker V1.
Scores retrieved candidates using a weighted combination of signals.

Score formula:
  0.45 * retrieval_relevance
  0.15 * availability
  0.12 * price_fit
  0.13 * rating_quality
  0.08 * brand_preference
  0.04 * category_preference
  0.03 * occasion_match

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
    preferred_categories: list[str] = field(default_factory=list)
    avoided_categories: list[str] = field(default_factory=list)
    quality_preference: str = "balanced"  # value, balanced, quality
    pack_size_preference: str = "balanced"  # small, balanced, bulk
    occasion: Optional[str] = None
    remaining_budget: Optional[float] = None


# Weights for V1 ranker
WEIGHTS = {
    "retrieval_relevance": 0.45,
    "availability": 0.15,
    "price_fit": 0.12,
    "rating_quality": 0.13,
    "brand_preference": 0.08,
    "category_preference": 0.04,
    "occasion_match": 0.03,
}


def _normalize_score(score: float, max_score: float) -> float:
    """Normalize a retrieval score to [0, 1]."""
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
        penalty = min(0.5, over_ratio * 0.5)
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


def _quality_preference_score(base_quality: float, quality_preference: str) -> float:
    """Adjust quality signal for users who explicitly prefer quality."""
    if quality_preference == "quality":
        return min(1.0, base_quality + 0.15)
    if quality_preference == "value":
        return max(0.0, base_quality - 0.05)
    return base_quality


def _brand_preference_score(
    brand: str,
    preferred_brands: list[str],
    avoided_brands: list[str],
) -> float:
    """
    1.0 if preferred brand, 0.0 if avoided brand, 0.5 otherwise.
    """
    brand_lower = brand.lower()
    if any(b.lower() == brand_lower for b in preferred_brands):
        return 1.0
    if any(b.lower() == brand_lower for b in avoided_brands):
        return 0.0
    return 0.5


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


def _category_preference_score(
    candidate: ProductCandidate,
    preferred_categories: list[str],
    avoided_categories: list[str],
) -> float:
    """Score category/subcategory alignment from the user's profile."""
    category = candidate.category.lower()
    subcategory = candidate.subcategory.lower()

    if any(c.lower() in (category, subcategory) for c in avoided_categories):
        return 0.0
    if any(c.lower() in (category, subcategory) for c in preferred_categories):
        return 1.0
    return 0.5


def _pack_size_score(candidate: ProductCandidate, pack_size_preference: str) -> float:
    """Light preference nudge for small packs vs bulk packs."""
    qty = max(candidate.unit_quantity, 1.0)
    if pack_size_preference == "bulk":
        return 1.0 if qty >= 1000 or candidate.unit == "pack" else 0.6
    if pack_size_preference == "small":
        return 1.0 if qty <= 500 or candidate.unit == "piece" else 0.6
    return 0.8


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

    # Get max retrieval scores for normalization. Lexical relevance dominates;
    # semantic score is only a fallback for real vector providers.
    max_text_score = max(c.text_score for c in candidates) if candidates else 0.0
    max_semantic_score = max(c.semantic_score for c in candidates) if candidates else 0.0
    all_prices = [c.price_inr for c in candidates]

    ranked: list[RankedProduct] = []

    for candidate in candidates:
        # Calculate each signal
        text_rel = _normalize_score(candidate.text_score, max_text_score)
        semantic_rel = _normalize_score(candidate.semantic_score, max_semantic_score)
        retrieval_rel = text_rel if candidate.text_score > 0 else semantic_rel
        availability = _availability_score(candidate)
        price_fit = _price_fit_score(
            candidate.price_inr,
            context.budget_mode,
            context.remaining_budget,
            all_prices,
        )
        rating_quality = _quality_preference_score(
            _rating_quality_score(candidate.rating, candidate.review_count),
            context.quality_preference,
        )
        brand_pref = _brand_preference_score(
            candidate.brand,
            context.preferred_brands,
            context.avoided_brands,
        )
        category_pref = _category_preference_score(
            candidate,
            context.preferred_categories,
            context.avoided_categories,
        )
        occasion = _occasion_match_score(candidate, context.occasion)
        pack_size = _pack_size_score(candidate, context.pack_size_preference)

        # Weighted sum
        score = (
            WEIGHTS["retrieval_relevance"] * retrieval_rel
            + WEIGHTS["availability"] * availability
            + WEIGHTS["price_fit"] * price_fit
            + WEIGHTS["rating_quality"] * rating_quality
            + WEIGHTS["brand_preference"] * brand_pref
            + WEIGHTS["category_preference"] * category_pref
            + WEIGHTS["occasion_match"] * occasion
        )
        # Small deterministic behavior nudge. It should never overpower
        # relevance, so keep it outside the main weights and very small.
        score = min(1.0, score + 0.02 * pack_size)
        purchase_likelihood = max(0.0, min(1.0, score))

        # Build reason codes
        reason_codes: list[str] = []
        if retrieval_rel > 0.7:
            reason_codes.append("keyword_match")
        if brand_pref == 1.0:
            reason_codes.append("preferred_brand")
        if price_fit > 0.7:
            reason_codes.append("budget_friendly")
        if rating_quality > 0.7:
            reason_codes.append("high_rating")
        if availability == 1.0:
            reason_codes.append("in_stock")
        if category_pref == 1.0:
            reason_codes.append("profile_category")
        if occasion > 0.7:
            reason_codes.append("occasion_match")
        if purchase_likelihood > 0.75:
            reason_codes.append("likely_choice")

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
                "retrieval_relevance": round(retrieval_rel, 3),
                "keyword_relevance": round(text_rel, 3),
                "semantic_relevance": round(semantic_rel, 3),
                "availability": round(availability, 3),
                "price_fit": round(price_fit, 3),
                "rating_quality": round(rating_quality, 3),
                "brand_preference": round(brand_pref, 3),
                "category_preference": round(category_pref, 3),
                "occasion_match": round(occasion, 3),
                "pack_size": round(pack_size, 3),
            },
            reason_codes=reason_codes,
            display_reason=display_reason,
            purchase_likelihood=round(purchase_likelihood, 4),
            likely_rating=round(purchase_likelihood * 100, 1),
        ))

    # Sort by score descending
    ranked.sort(key=lambda r: r.score, reverse=True)

    logger.debug(f"Ranked {len(ranked)} candidates, top={ranked[0].title if ranked else 'none'}")
    return ranked


def _build_display_reason(reason_codes: list[str], candidate: ProductCandidate) -> str:
    """Build a concise human-readable reason for product selection."""
    parts: list[str] = []

    if "preferred_brand" in reason_codes:
        parts.append(f"Your preferred brand ({candidate.brand})")
    if "keyword_match" in reason_codes:
        parts.append("Matched your request")
    if "high_rating" in reason_codes:
        parts.append(f"Rated {candidate.rating} star")
    if "budget_friendly" in reason_codes:
        parts.append("Fits your budget")
    if "profile_category" in reason_codes:
        parts.append("Matches your profile")
    if "occasion_match" in reason_codes:
        parts.append("Great for this occasion")
    if "likely_choice" in reason_codes and not parts:
        parts.append("Likely good fit")

    if not parts:
        parts.append("Best available match")

    return " | ".join(parts)
