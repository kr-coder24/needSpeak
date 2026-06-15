from __future__ import annotations

import hashlib

from app.watchlist.models import PricePoint, WatchEvent, WatchedItem

_current_day = 0


def get_current_day() -> int:
    return _current_day


def advance_day() -> int:
    global _current_day
    _current_day += 1
    return _current_day


def generate_price_for_day(sku: str, base_price: float, day: int) -> float:
    digest = hashlib.sha256(f"{sku}:{day}".encode("utf-8")).hexdigest()
    seed = int(digest[:8], 16)
    wave = ((seed % 31) - 15) / 100
    if day % 5 == 0:
        wave -= 0.12
    if day % 9 == 0:
        wave += 0.08
    return round(max(1.0, base_price * (1 + wave)), 2)


def check_price_alerts(watches: list[WatchedItem], day: int) -> tuple[list[WatchEvent], list[WatchedItem]]:
    events: list[WatchEvent] = []
    updated: list[WatchedItem] = []

    for item in watches:
        simulated_price = generate_price_for_day(item.sku, item.price_history[0].price if item.price_history else item.current_price_inr, day)
        history = [*item.price_history, PricePoint(day=day, price=simulated_price)]
        status = item.status
        message = ""
        savings = max(0.0, item.current_price_inr - simulated_price)

        if item.competitor_price_inr and simulated_price <= item.competitor_price_inr:
            status = "already_cheaper"
            message = f"{item.name} is now cheaper than {item.competitor_source or 'the competitor'} at Rs {simulated_price:.0f}."
        elif simulated_price <= item.target_price_inr:
            status = "price_dropped"
            message = f"{item.name} dropped to Rs {simulated_price:.0f}, meeting your Rs {item.target_price_inr:.0f} target."

        new_item = item.model_copy(update={"current_price_inr": simulated_price, "price_history": history, "status": status})
        updated.append(new_item)

        if message and item.status == "watching":
            events.append(
                WatchEvent(
                    id=f"{item.watch_id}-{day}-{status}",
                    type=status,
                    watch_id=item.watch_id,
                    sku=item.sku,
                    name=item.name,
                    message=message,
                    day=day,
                    savings_inr=round(savings, 2),
                    email_sent=bool(item.email),
                )
            )

    return events, updated
