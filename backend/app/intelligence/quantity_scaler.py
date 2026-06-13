"""
Quantity Scaler — Post-process extracted items to scale quantities.

Handles scaling based on attendees, family size, and trip duration.
Called after LLM extraction but before SKU resolution.

Person C owns this file.
"""

from __future__ import annotations

import logging
import math
from typing import Optional

from app.models import ExtractedItem, ExtractedIntent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Per-category scaling factors (how much does a single person consume)
# ---------------------------------------------------------------------------
# These are rough multipliers: quantity_per_person relative to a base serving of 1.
# For items where the base recipe serves 4, we divide by 4 and multiply by attendees.
CATEGORY_SCALE_CAPS = {
    "spices": 2.0,       # Spices don't scale linearly — cap at 2x
    "oils": 2.0,         # Oil usage doesn't scale linearly
    "cleaning": 1.5,     # Cleaning supplies barely scale with people
    "stationery": 1.0,   # Stationery doesn't scale
}

# Items that should scale linearly with attendees
LINEAR_CATEGORIES = {
    "snacks", "beverages", "fruits", "vegetables", "dairy",
    "grains", "bakery", "disposables", "instant_food",
}


def scale_quantities(
    items: list[ExtractedItem],
    target_attendees: int,
    base_servings: int = 4,
) -> list[ExtractedItem]:
    """
    Scale item quantities from base_servings to target_attendees.

    Args:
        items: List of extracted items with their default quantities.
        target_attendees: Number of people the items should serve.
        base_servings: The number of servings the original quantities target.

    Returns:
        The same list with adjusted quantities.
    """
    if target_attendees <= 0 or base_servings <= 0:
        return items

    ratio = target_attendees / base_servings
    if abs(ratio - 1.0) < 0.05:
        # Ratio is close to 1 — no scaling needed
        return items

    logger.info(f"Scaling quantities: {base_servings} servings → {target_attendees} attendees (ratio {ratio:.2f})")

    for item in items:
        category = item.category.lower()

        # Check for capped categories
        if category in CATEGORY_SCALE_CAPS:
            capped_ratio = min(ratio, CATEGORY_SCALE_CAPS[category])
            item.quantity = _smart_round(item.quantity * capped_ratio, item.unit)
        elif category in LINEAR_CATEGORIES:
            item.quantity = _smart_round(item.quantity * ratio, item.unit)
        else:
            # Default: scale linearly but cap at 3x for safety
            safe_ratio = min(ratio, 3.0)
            item.quantity = _smart_round(item.quantity * safe_ratio, item.unit)

    return items


def scale_for_duration(
    items: list[ExtractedItem],
    duration_days: int,
    base_days: int = 1,
) -> list[ExtractedItem]:
    """
    Scale item quantities based on trip/event duration.

    Args:
        items: List of extracted items.
        duration_days: How many days the items should last.
        base_days: The number of days the original quantities target.

    Returns:
        The same list with adjusted quantities.
    """
    if duration_days <= 0 or base_days <= 0:
        return items

    ratio = duration_days / base_days
    if abs(ratio - 1.0) < 0.05:
        return items

    logger.info(f"Scaling for duration: {base_days} day(s) → {duration_days} day(s) (ratio {ratio:.2f})")

    # For duration scaling, consumables scale linearly; durables don't
    consumable_categories = {
        "snacks", "beverages", "fruits", "vegetables", "dairy",
        "grains", "bakery", "instant_food",
    }

    for item in items:
        if item.category.lower() in consumable_categories:
            item.quantity = _smart_round(item.quantity * ratio, item.unit)

    return items


def _smart_round(value: float, unit: str) -> float:
    """
    Round quantities smartly based on their unit type.
    Countable items → ceil to nearest int.
    Weight/volume → round to sensible increments.
    """
    unit_lower = unit.lower()

    if unit_lower in ("piece", "pack", "bunch", "clove"):
        return float(max(1, math.ceil(value)))

    if unit_lower in ("kg", "litre"):
        # Round to nearest 0.25
        return max(0.25, round(value * 4) / 4)

    if unit_lower in ("g", "ml"):
        # Round to nearest 50
        return float(max(50, round(value / 50) * 50))

    if unit_lower in ("cup", "tbsp", "tsp"):
        # Round to nearest 0.5
        return max(0.5, round(value * 2) / 2)

    # Default: round to 1 decimal
    return round(value, 1)
