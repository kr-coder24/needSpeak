"""
Explainer — Generate human-readable reasoning for each cart item.

Provides "explainable shopping" by generating a short reason string
explaining why each item was added to the cart and how its quantity
was determined.

Person C owns this file.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.models import ExtractedItem, ExtractedIntent, IntentType

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Intent-type descriptions (human-readable)
# ---------------------------------------------------------------------------
INTENT_LABELS = {
    IntentType.RECIPE: "recipe",
    IntentType.DIY: "DIY project",
    IntentType.SUPPLIES: "supplies list",
    IntentType.MEDICAL: "medical/health need",
    IntentType.GENERAL: "shopping request",
}


def explain_item(
    item: ExtractedItem,
    intent: ExtractedIntent,
    servings: Optional[int] = None,
) -> str:
    """
    Generate a human-readable explanation for why an item is in the cart.

    Examples:
      - "From recipe: Butter Chicken (serves 4)"
      - "Added for: IPL watch party for 10 people"
      - "Staple ingredient for weekly grocery shopping"

    Args:
        item: The extracted item being explained.
        intent: The intent group this item belongs to.
        servings: Number of servings/attendees if available.

    Returns:
        A short explanation string.
    """
    intent_label = INTENT_LABELS.get(intent.intent_type, "shopping request")
    context = intent.context_summary.strip()

    # Build the reason
    parts = []

    # Main context
    if context:
        parts.append(f"From {intent_label}: {context}")
    else:
        parts.append(f"Part of your {intent_label}")

    # Quantity reasoning
    qty_reason = _explain_quantity(item, servings)
    if qty_reason:
        parts.append(qty_reason)

    # Optional flag
    if item.optional:
        parts.append("(optional — can be removed)")

    # Item-specific notes
    if item.notes:
        parts.append(f"Note: {item.notes}")

    return ". ".join(parts)


def explain_substitution(
    original_name: str,
    substitute_name: str,
    reason: str,
) -> str:
    """
    Generate a human-readable explanation for a product substitution.

    Args:
        original_name: The item the user originally requested.
        substitute_name: The product it was replaced with.
        reason: Why the substitution happened.

    Returns:
        A short explanation string.
    """
    return f"'{original_name}' → '{substitute_name}': {reason}"


def explain_budget_optimization(
    original_name: str,
    alternative_name: str,
    savings_inr: float,
) -> str:
    """
    Generate an explanation for a budget optimization suggestion.

    Args:
        original_name: Current product.
        alternative_name: Cheaper alternative.
        savings_inr: How much the user would save.

    Returns:
        A short suggestion string.
    """
    return f"Switch {original_name} → {alternative_name} to save ₹{savings_inr:.0f}"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _explain_quantity(item: ExtractedItem, servings: Optional[int]) -> str:
    """Generate a short explanation for why this quantity was chosen."""
    qty = item.quantity
    unit = item.unit

    if servings and servings > 1:
        return f"Quantity scaled for {servings} people: {qty} {unit}"

    # For default quantities, only explain if they're non-obvious
    if qty == 1 and unit == "piece":
        return ""  # Default — nothing to explain

    if unit in ("g", "ml", "kg", "litre"):
        return f"Estimated: {qty} {unit}"

    return ""
