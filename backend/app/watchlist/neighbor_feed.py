from __future__ import annotations

import hashlib

from app.watchlist.models import NeighborMatch, WatchEvent, WatchedItem


def _seed(sku: str, day: int) -> int:
    return int(hashlib.sha256(f"neighbor:{sku}:{day}".encode("utf-8")).hexdigest()[:8], 16)


def generate_neighbor_match(item: WatchedItem, day: int) -> NeighborMatch | None:
    seed = _seed(item.sku, day)
    if day < 2 or seed % 4 != 0:
        return None
    distance = round(2 + (seed % 1300) / 100, 1)
    original = item.price_history[0].price if item.price_history else item.current_price_inr
    logistics = round(original * 0.25, 2)
    return NeighborMatch(
        product_id=item.sku,
        distance_km=distance,
        original_price_inr=round(original, 2),
        logistics_cost_saved_inr=logistics,
        neighbor_price_inr=round(max(1.0, original - logistics), 2),
        co2_saved_kg=round(distance * 2 * 0.00021, 3),
        day_appeared=day,
    )


def check_neighbor_matches(watches: list[WatchedItem], day: int) -> tuple[list[WatchEvent], list[WatchedItem]]:
    events: list[WatchEvent] = []
    updated: list[WatchedItem] = []

    for item in watches:
        if item.neighbor_match:
            updated.append(item)
            continue

        match = generate_neighbor_match(item, day)
        if not match:
            updated.append(item)
            continue

        new_item = item.model_copy(
            update={
                "status": "neighbor_match",
                "neighbor_match": match,
                "co2_saved_kg": match.co2_saved_kg,
                "logistics_saved_inr": match.logistics_cost_saved_inr,
            }
        )
        updated.append(new_item)
        events.append(
            WatchEvent(
                id=f"{item.watch_id}-{day}-neighbor",
                type="neighbor_match",
                watch_id=item.watch_id,
                sku=item.sku,
                name=item.name,
                message=f"Nearby return found for {item.name}: Rs {match.neighbor_price_inr:.0f}, {match.distance_km:.1f} km away.",
                day=day,
                savings_inr=match.logistics_cost_saved_inr,
                co2_saved_kg=match.co2_saved_kg,
                email_sent=bool(item.email),
            )
        )

    return events, updated
