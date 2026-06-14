"""Community bulk-buy matching for collaborative cart sessions."""

from __future__ import annotations

from app.collab.collab_store import get_session
from app.collab.community_store import get_community_sessions
from app.collab.models import BulkDealMatch, BulkDealSession

BULK_CATEGORIES = {
    "grains",
    "oils",
    "dairy",
    "beverages",
    "snacks",
    "spices",
    "pulses",
    "cleaning",
    "general",
}

DISCOUNT_TIERS = [
    {"min_carts": 5, "discount_pct": 15},
    {"min_carts": 3, "discount_pct": 10},
    {"min_carts": 2, "discount_pct": 5},
]

_accepted_deals: dict[tuple[str, str], set[str]] = {}


def _category_key(category: str) -> str:
    normalized = (category or "general").strip().lower()
    if normalized in {"food", "grocery", "groceries"}:
        return "general"
    return normalized


def _discount_for_cart_count(count: int) -> float:
    for tier in DISCOUNT_TIERS:
        if count >= tier["min_carts"]:
            return float(tier["discount_pct"])
    return 0.0


def find_bulk_matches(session_id: str, community_code: str) -> list[BulkDealMatch]:
    session_ids = get_community_sessions(community_code)
    if session_id not in session_ids:
        session_ids.append(session_id)

    buckets: dict[str, list[BulkDealSession]] = {}
    for current_id in session_ids:
        session = get_session(current_id)
        if not session or not session.is_active:
            continue

        grouped_items: dict[str, list[dict]] = {}
        for item in session.items:
            category = _category_key(item.category)
            if category not in BULK_CATEGORIES:
                continue
            grouped_items.setdefault(category, []).append(
                {
                    "sku": item.sku,
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "subtotal_inr": item.total_price_inr,
                }
            )

        for category, items in grouped_items.items():
            subtotal = sum(float(item["subtotal_inr"]) for item in items)
            buckets.setdefault(category, []).append(
                BulkDealSession(
                    session_id=session.session_id,
                    session_name=session.name,
                    items=items,
                    subtotal_inr=round(subtotal, 2),
                )
            )

    deals: list[BulkDealMatch] = []
    for category, matching_sessions in buckets.items():
        if len(matching_sessions) < 2:
            continue

        discount_pct = _discount_for_cart_count(len(matching_sessions))
        total_quantity = sum(
            float(item["quantity"])
            for deal_session in matching_sessions
            for item in deal_session.items
        )
        estimated_savings = 0.0
        for deal_session in matching_sessions:
            savings = deal_session.subtotal_inr * discount_pct / 100
            deal_session.estimated_savings_inr = round(savings, 2)
            deal_session.discounted_total_inr = round(deal_session.subtotal_inr - savings, 2)
            estimated_savings += savings

        accepted = sorted(_accepted_deals.get((community_code, category), set()))
        deals.append(
            BulkDealMatch(
                category=category,
                matching_sessions=matching_sessions,
                total_quantity=round(total_quantity, 2),
                discount_pct=discount_pct,
                estimated_savings_inr=round(estimated_savings, 2),
                accepted_session_ids=accepted,
            )
        )

    return sorted(deals, key=lambda deal: deal.estimated_savings_inr, reverse=True)


def accept_bulk_deal(session_id: str, community_code: str, category: str) -> bool:
    normalized_category = _category_key(category)
    deal_key = (community_code, normalized_category)
    _accepted_deals.setdefault(deal_key, set()).add(session_id)
    return True


def clear_bulk_deals_for_tests() -> None:
    _accepted_deals.clear()
