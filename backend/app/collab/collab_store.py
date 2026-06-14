"""In-memory state and deterministic merge math for SplitCart."""

from __future__ import annotations

import math
import random
import string
import uuid
from typing import Optional

from app.collab.models import (
    BudgetSplit,
    CollabCartItem,
    CollabDemand,
    CollabRole,
    CollabSession,
    Contributor,
    ContributorStatus,
)

_sessions: dict[str, CollabSession] = {}
_share_codes: dict[str, str] = {}


def generate_share_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(chars) for _ in range(length))
        if code not in _share_codes:
            return code


def create_session(
    name: str, host_name: str, total_budget_inr: float
) -> tuple[CollabSession, Contributor]:
    session_id = str(uuid.uuid4())
    share_code = generate_share_code()
    host = Contributor(
        id=str(uuid.uuid4()),
        name=host_name,
        role=CollabRole.HOST,
        status=ContributorStatus.ACTIVE,
    )
    session = CollabSession(
        session_id=session_id,
        name=name,
        host_id=host.id,
        host_name=host_name,
        total_budget_inr=total_budget_inr,
        share_code=share_code,
        contributors=[host],
    )
    _sessions[session_id] = session
    _share_codes[share_code] = session_id
    return session, host


def get_session(session_id: str) -> Optional[CollabSession]:
    return _sessions.get(session_id)


def resolve_share_code(share_code: str) -> Optional[str]:
    return _share_codes.get(share_code.upper())


def join_session(session_id: str, contributor_name: str) -> Optional[Contributor]:
    session = _sessions.get(session_id)
    if not session or not session.is_active:
        return None

    contributor = Contributor(id=str(uuid.uuid4()), name=contributor_name)
    session.contributors.append(contributor)
    return contributor


def _compatible_demand_amount(item: CollabCartItem, demand: CollabDemand) -> float:
    if demand.requested_base_unit == item.unit:
        return demand.requested_base_amount
    if {demand.requested_base_unit, item.unit} == {"g", "ml"}:
        return demand.requested_base_amount
    return 0.0


def _demand_weight(item: CollabCartItem, demand: CollabDemand) -> float:
    compatible_amount = _compatible_demand_amount(item, demand)
    if compatible_amount > 0:
        return compatible_amount
    return float(demand.standalone_quantity_units)


def _recalculate_item(item: CollabCartItem) -> None:
    compatible_amounts = [
        _compatible_demand_amount(item, demand) for demand in item.demands
    ]
    if compatible_amounts and all(amount > 0 for amount in compatible_amounts):
        total_needed = sum(compatible_amounts)
        item.quantity = max(1, math.ceil(total_needed / item.unit_quantity))
    else:
        item.quantity = max(
            1, sum(demand.standalone_quantity_units for demand in item.demands)
        )

    standalone_units = sum(
        demand.standalone_quantity_units for demand in item.demands
    )
    item.merge_savings_inr = max(
        0.0, (standalone_units - item.quantity) * item.estimated_price_inr
    )
    item.matched_from = [
        (
            f"{demand.contributor_name}: {demand.requested_quantity:g} "
            f"{demand.requested_unit} {demand.requested_name}"
        )
        for demand in item.demands
    ]


def _refresh_contributor_stats(session: CollabSession) -> None:
    splits = _calculate_budget_splits(session)
    split_by_id = {split.contributor_id: split for split in splits}
    for contributor in session.contributors:
        contributor.items_added = sum(
            1
            for item in session.items
            for demand in item.demands
            if demand.contributor_id == contributor.id
        )
        split = split_by_id.get(contributor.id)
        contributor.budget_contribution_inr = split.amount_owed if split else 0.0


def merge_resolved_item(
    session_id: str,
    contributor_id: str,
    resolved_item: CollabCartItem,
) -> Optional[CollabCartItem]:
    """Merge a resolved demand into its SKU row and recalculate package count."""

    session = _sessions.get(session_id)
    if not session:
        return None
    contributor = next(
        (entry for entry in session.contributors if entry.id == contributor_id), None
    )
    if not contributor or not resolved_item.demands:
        return None

    existing = next(
        (item for item in session.items if item.sku == resolved_item.sku), None
    )
    incoming = resolved_item.demands[0]
    if existing:
        contributor_demand = next(
            (
                demand
                for demand in existing.demands
                if demand.contributor_id == contributor_id
                and demand.requested_unit == incoming.requested_unit
            ),
            None,
        )
        if contributor_demand:
            contributor_demand.requested_quantity += incoming.requested_quantity
            contributor_demand.requested_base_amount += incoming.requested_base_amount
            contributor_demand.standalone_quantity_units += (
                incoming.standalone_quantity_units
            )
            if incoming.notes:
                contributor_demand.notes = incoming.notes
        else:
            existing.demands.append(incoming)
        if not existing.pending_substitution and resolved_item.pending_substitution:
            existing.pending_substitution = resolved_item.pending_substitution
        _recalculate_item(existing)
        merged_item = existing
    else:
        _recalculate_item(resolved_item)
        session.items.append(resolved_item)
        merged_item = resolved_item

    _refresh_contributor_stats(session)
    return merged_item


def remove_item(session_id: str, item_id: str, contributor_id: str) -> bool:
    """Remove the caller's demand; host can remove an unowned row entirely."""

    session = _sessions.get(session_id)
    if not session:
        return False
    item = next((entry for entry in session.items if entry.id == item_id), None)
    if not item:
        return False

    own_demands = [
        demand for demand in item.demands if demand.contributor_id == contributor_id
    ]
    if own_demands:
        item.demands = [
            demand
            for demand in item.demands
            if demand.contributor_id != contributor_id
        ]
        if item.demands:
            _recalculate_item(item)
        else:
            session.items.remove(item)
    elif session.host_id == contributor_id:
        session.items.remove(item)
    else:
        return False

    _refresh_contributor_stats(session)
    return True


def update_demand_quantity(
    session_id: str, item_id: str, contributor_id: str, new_quantity: float
) -> bool:
    session = _sessions.get(session_id)
    if not session or new_quantity <= 0:
        return False
    item = next((entry for entry in session.items if entry.id == item_id), None)
    if not item:
        return False
    demand = next(
        (
            entry
            for entry in item.demands
            if entry.contributor_id == contributor_id
        ),
        None,
    )
    if not demand:
        return False

    ratio = new_quantity / demand.requested_quantity
    demand.requested_quantity = new_quantity
    demand.requested_base_amount *= ratio
    compatible_amount = _compatible_demand_amount(item, demand)
    if compatible_amount > 0:
        demand.standalone_quantity_units = max(
            1, math.ceil(compatible_amount / item.unit_quantity)
        )
    else:
        demand.standalone_quantity_units = max(
            1, math.ceil(demand.standalone_quantity_units * ratio)
        )
    _recalculate_item(item)
    _refresh_contributor_stats(session)
    return True


def apply_substitution(
    session_id: str, item_id: str, contributor_id: str
) -> bool:
    session = _sessions.get(session_id)
    if not session or session.host_id != contributor_id:
        return False
    item = next((entry for entry in session.items if entry.id == item_id), None)
    if not item or not item.pending_substitution:
        return False

    substitute = item.pending_substitution
    item.sku = substitute["sku"]
    item.name = substitute["name"]
    item.brand = substitute.get("brand", "")
    item.unit = substitute["unit"]
    item.unit_quantity = float(substitute["unit_quantity"])
    item.estimated_price_inr = float(substitute["price_per_unit_inr"])
    item.substitution_reason = substitute["reason"]
    item.pending_substitution = None
    duplicate = next(
        (
            entry
            for entry in session.items
            if entry.id != item.id and entry.sku == item.sku
        ),
        None,
    )
    if duplicate:
        duplicate.demands.extend(item.demands)
        duplicate.substitution_reason = item.substitution_reason
        session.items.remove(item)
        _recalculate_item(duplicate)
    else:
        _recalculate_item(item)
    _refresh_contributor_stats(session)
    return True


def reject_substitution(
    session_id: str, item_id: str, contributor_id: str
) -> bool:
    session = _sessions.get(session_id)
    if not session:
        return False
    item = next((entry for entry in session.items if entry.id == item_id), None)
    if not item:
        return False
    owns_demand = any(
        demand.contributor_id == contributor_id for demand in item.demands
    )
    if not owns_demand and session.host_id != contributor_id:
        return False
    item.pending_substitution = None
    return True


def update_budget(session_id: str, new_budget: float, contributor_id: str) -> bool:
    session = _sessions.get(session_id)
    if not session or session.host_id != contributor_id:
        return False
    session.total_budget_inr = new_budget
    return True


def leave_session(session_id: str, contributor_id: str) -> bool:
    session = _sessions.get(session_id)
    if not session:
        return False
    contributor = next(
        (entry for entry in session.contributors if entry.id == contributor_id), None
    )
    if not contributor:
        return False
    contributor.status = ContributorStatus.LEFT
    return True


def _calculate_budget_splits(session: CollabSession) -> list[BudgetSplit]:
    active = [
        contributor
        for contributor in session.contributors
        if contributor.status == ContributorStatus.ACTIVE
    ]
    if not active:
        return []

    total = session.total_estimated_cost
    equal_share = total / len(active) if active else 0.0
    owed_by_contributor = {contributor.id: 0.0 for contributor in active}
    savings_by_contributor = {contributor.id: 0.0 for contributor in active}

    for item in session.items:
        total_weight = sum(_demand_weight(item, demand) for demand in item.demands)
        if total_weight <= 0:
            continue
        for demand in item.demands:
            if demand.contributor_id not in owed_by_contributor:
                continue
            share = _demand_weight(item, demand) / total_weight
            owed_by_contributor[demand.contributor_id] += item.total_price_inr * share
            savings_by_contributor[demand.contributor_id] += (
                item.merge_savings_inr * share
            )

    splits = []
    for contributor in active:
        amount_owed = owed_by_contributor[contributor.id]
        splits.append(
            BudgetSplit(
                contributor_id=contributor.id,
                name=contributor.name,
                items_added=sum(
                    1
                    for item in session.items
                    for demand in item.demands
                    if demand.contributor_id == contributor.id
                ),
                amount_spent=amount_owed,
                fair_share=equal_share,
                owes=amount_owed,
                amount_owed=amount_owed,
                percent_of_total=(amount_owed / total * 100) if total else 0.0,
                merge_savings_inr=savings_by_contributor[contributor.id],
            )
        )
    return splits


def get_budget_split(session_id: str) -> Optional[list[BudgetSplit]]:
    session = _sessions.get(session_id)
    if not session:
        return None
    return _calculate_budget_splits(session)


def clear_sessions_for_tests() -> None:
    _sessions.clear()
    _share_codes.clear()
