"""
Cart Summary Generator — Fast template-based (no LLM call).

Produces a concise, friendly message for the chat UI.
Handles all edge cases: empty cart, partial matches, substitutions, budget status.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.models import IntentGroup

logger = logging.getLogger(__name__)


def generate_summary(
    intent_groups: list[IntentGroup],
    total_price: float,
    budget_inr: Optional[int] = None,
    budget_exceeded: bool = False,
    mock_mode: Optional[bool] = None,
) -> str:
    """
    Generate a concise cart summary message.
    
    Cases handled:
    1. All items unavailable (0 matched)
    2. Single item added
    3. Multiple items added
    4. Some items unavailable (partial match)
    5. Substitutions made
    6. Under budget
    7. Over budget
    8. No budget set
    """
    total_items = sum(len(g.cart) for g in intent_groups)
    total_unavailable = sum(len(g.unavailable_items) for g in intent_groups)
    total_substitutions = sum(1 for g in intent_groups for i in g.cart if i.substituted)
    unavailable_names = [i.name for g in intent_groups for i in g.unavailable_items]

    # ── Case 1: Nothing found at all ──
    if total_items == 0 and total_unavailable == 0:
        return "I couldn't extract any items from that. Could you try rephrasing?"

    # ── Case 2: All items unavailable ──
    if total_items == 0 and total_unavailable > 0:
        names = ", ".join(unavailable_names[:3])
        suffix = f" and {total_unavailable - 3} more" if total_unavailable > 3 else ""
        return f"Sorry, couldn't find {names}{suffix} in our catalog. Try a different name or ask for alternatives!"

    # ── Case 3+: At least some items matched ──
    parts = []

    # Main message
    if total_items == 1:
        item_name = intent_groups[0].cart[0].name if intent_groups and intent_groups[0].cart else "your item"
        parts.append(f"Added {item_name} to your cart — ₹{total_price:.0f}.")
    else:
        parts.append(f"Added {total_items} items to your cart — ₹{total_price:.0f} total.")

    # Substitutions
    if total_substitutions == 1:
        sub_item = next(i for g in intent_groups for i in g.cart if i.substituted)
        reason = sub_item.substitution_reason or "better value"
        parts.append(f" Swapped 1 item ({reason}).")
    elif total_substitutions > 1:
        parts.append(f" Swapped {total_substitutions} items for better value.")

    # Unavailable items (partial match)
    if total_unavailable == 1:
        parts.append(f" Note: {unavailable_names[0]} wasn't available.")
    elif total_unavailable > 1:
        names = ", ".join(unavailable_names[:2])
        extra = f" +{total_unavailable - 2} more" if total_unavailable > 2 else ""
        parts.append(f" Couldn't find: {names}{extra}.")

    # Budget status
    if budget_inr:
        if budget_exceeded:
            over = total_price - budget_inr
            parts.append(f" ₹{over:.0f} over budget — check alternatives to save.")
        else:
            remaining = budget_inr - total_price
            if remaining > 0:
                parts.append(f" ₹{remaining:.0f} left in your ₹{budget_inr} budget ✓")

    return "".join(parts)
