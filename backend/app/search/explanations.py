"""
Explanation utilities for search/ranking results.
Converts reason codes and score breakdowns into user-facing text.
"""

from __future__ import annotations

from app.catalog.models import RankedProduct


def explain_selection(product: RankedProduct) -> str:
    """Generate a short user-facing explanation for why this product was selected."""
    return product.display_reason or "Best available match"


def explain_alternative(product: RankedProduct, selected: RankedProduct) -> str:
    """Generate explanation for why this product is an alternative."""
    parts: list[str] = []

    price_diff = selected.price_inr - product.price_inr
    if price_diff > 0:
        parts.append(f"Save ₹{price_diff:.0f}")
    elif price_diff < 0:
        parts.append(f"Premium option (+₹{abs(price_diff):.0f})")

    if product.rating > selected.rating:
        parts.append(f"Higher rated ({product.rating}★)")

    if "preferred_brand" in product.reason_codes:
        parts.append(f"Your preferred brand")

    if not parts:
        parts.append("Similar alternative")

    return " · ".join(parts)
