from __future__ import annotations

from copy import deepcopy
from uuid import uuid4

from app.watchlist.models import NeighborMatch, PricePoint, WatchCreateRequest, WatchEvent, WatchedItem, WatchStats
from app.watchlist.price_status import get_price_status_for_item

_watches: dict[str, list[WatchedItem]] = {}
_seeded_users: set[str] = set()


def _history(sku: str, base_price: float, current_price: float, days: int = 30) -> list[PricePoint]:
    """Deterministic, demo-friendly history that always ends at current_price."""
    points: list[PricePoint] = []
    for index in range(days):
        day = index - (days - 1)
        wave = ((sum(ord(ch) for ch in f"{sku}:{day}") % 19) - 9) / 100
        promo = -0.08 if index in {6, 13, 22} else 0.0
        price = round(max(1.0, base_price * (1 + wave + promo)), 2)
        points.append(PricePoint(day=day, price=price))
    points[-1] = PricePoint(day=0, price=round(float(current_price), 2))
    return points


def _demo_items() -> list[WatchedItem]:
    headphones_history = _history("DEMO-SONY-XM5", 29990, 21990)
    rice_history = _history("DEMO-RICE-10KG", 1450, 1199)
    air_fryer_history = _history("DEMO-AIR-FRYER", 8990, 6740)
    washer_history = _history("DEMO-WASHER", 32990, 34120)
    diaper_history = _history("DEMO-DIAPERS", 1899, 1510)
    purifier_history = _history("DEMO-PURIFIER", 15499, 13249)

    items = [
        WatchedItem(
            watch_id="demo-watch-sony-xm5",
            sku="DEMO-SONY-XM5",
            name="Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
            brand="Sony",
            current_price_inr=21990,
            target_price_inr=22990,
            competitor_price_inr=23490,
            competitor_source="Croma",
            status="price_dropped",
            price_history=headphones_history,
            email="demo@example.com",
            email_sent=True,
        ),
        WatchedItem(
            watch_id="demo-watch-rice",
            sku="DEMO-RICE-10KG",
            name="Daawat Rozana Super Basmati Rice 10 kg",
            brand="Daawat",
            current_price_inr=1199,
            target_price_inr=1250,
            competitor_price_inr=1299,
            competitor_source="BigBasket",
            status="already_cheaper",
            price_history=rice_history,
            email="demo@example.com",
            email_sent=True,
        ),
        WatchedItem(
            watch_id="demo-watch-air-fryer",
            sku="DEMO-AIR-FRYER",
            name="Philips Digital Air Fryer 4.1L with Rapid Air Technology",
            brand="Philips",
            current_price_inr=6740,
            target_price_inr=6999,
            status="neighbor_match",
            price_history=air_fryer_history,
            neighbor_match=NeighborMatch(
                product_id="DEMO-AIR-FRYER",
                distance_km=4.8,
                original_price_inr=8990,
                logistics_cost_saved_inr=2247.5,
                neighbor_price_inr=6742.5,
                co2_saved_kg=0.002,
                day_appeared=-1,
            ),
            co2_saved_kg=0.002,
            logistics_saved_inr=2247.5,
            email="demo@example.com",
            email_sent=True,
        ),
        WatchedItem(
            watch_id="demo-watch-washer",
            sku="DEMO-WASHER",
            name="LG 7 kg 5 Star Fully Automatic Front Load Washing Machine",
            brand="LG",
            current_price_inr=34120,
            target_price_inr=30990,
            competitor_price_inr=32990,
            competitor_source="Reliance Digital",
            status="watching",
            price_history=washer_history,
        ),
        WatchedItem(
            watch_id="demo-watch-diapers",
            sku="DEMO-DIAPERS",
            name="Pampers Active Baby Diapers Monthly Pack XL 96 Count",
            brand="Pampers",
            current_price_inr=1510,
            target_price_inr=1499,
            competitor_price_inr=1599,
            competitor_source="FirstCry",
            status="watching",
            price_history=diaper_history,
        ),
        WatchedItem(
            watch_id="demo-watch-purifier",
            sku="DEMO-PURIFIER",
            name="Kent Supreme RO + UV Water Purifier 8L",
            brand="Kent",
            current_price_inr=13249,
            target_price_inr=13499,
            competitor_price_inr=13790,
            competitor_source="Flipkart",
            status="price_dropped",
            price_history=purifier_history,
            email="demo@example.com",
            email_sent=True,
        ),
    ]
    return [_with_price_status(item) for item in items]


def _with_price_status(item: WatchedItem) -> WatchedItem:
    return item.model_copy(
        update={
            "price_status": get_price_status_for_item(
                sku=item.sku,
                current_price_inr=item.current_price_inr,
                history=item.price_history,
            )
        }
    )


def seed_demo_data(user_id: str = "demo_user") -> None:
    if user_id in _seeded_users:
        return
    existing = _watches.get(user_id, [])
    existing_skus = {item.sku for item in existing}
    seeded = [item.model_copy(deep=True) for item in _demo_items() if item.sku not in existing_skus]
    _watches[user_id] = [*seeded, *existing]
    _seeded_users.add(user_id)


def get_demo_events() -> list[WatchEvent]:
    return [
        WatchEvent(
            id="demo-event-sony-drop",
            type="price_dropped",
            watch_id="demo-watch-sony-xm5",
            sku="DEMO-SONY-XM5",
            name="Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
            message="Sony WH-1000XM5 dropped to Rs 21,990, the lowest point in its 30-day history.",
            day=0,
            savings_inr=3000,
            email_sent=True,
        ),
        WatchEvent(
            id="demo-event-air-fryer-neighbor",
            type="neighbor_match",
            watch_id="demo-watch-air-fryer",
            sku="DEMO-AIR-FRYER",
            name="Philips Digital Air Fryer 4.1L",
            message="Neighbor return found for Philips Air Fryer at Rs 6,742, only 4.8 km away.",
            day=0,
            savings_inr=2247.5,
            co2_saved_kg=0.002,
            email_sent=True,
        ),
        WatchEvent(
            id="demo-event-rice-cheaper",
            type="already_cheaper",
            watch_id="demo-watch-rice",
            sku="DEMO-RICE-10KG",
            name="Daawat Rozana Super Basmati Rice 10 kg",
            message="Daawat Basmati is already cheaper than BigBasket by Rs 100.",
            day=0,
            savings_inr=100,
            email_sent=True,
        ),
    ]


def create_watch(user_id: str, data: WatchCreateRequest, competitor: tuple[str | None, float | None]) -> WatchedItem:
    seed_demo_data(user_id)
    source, price = competitor
    current_price = round(float(data.current_price_inr), 2)
    target_price = round(float(data.target_price_inr or data.current_price_inr), 2)
    competitor_price = round(float(price), 2) if price is not None else None
    existing = find_watch_by_sku(user_id, data.sku)
    if existing:
        updates = {
            "name": data.name or existing.name,
            "brand": data.brand or existing.brand,
            "current_price_inr": current_price,
            "target_price_inr": target_price,
            "email": data.email or existing.email,
            "competitor_source": source or existing.competitor_source,
            "competitor_price_inr": competitor_price if competitor_price is not None else existing.competitor_price_inr,
        }
        updated = existing.model_copy(update=updates)
        if updated.competitor_price_inr is not None and updated.current_price_inr <= updated.competitor_price_inr:
            updated = updated.model_copy(update={"status": "already_cheaper"})
        elif updated.current_price_inr <= updated.target_price_inr:
            updated = updated.model_copy(update={"status": "price_dropped"})
        updated = _with_price_status(updated)
        _watches[user_id] = [updated if item.watch_id == existing.watch_id else item for item in _watches.get(user_id, [])]
        return updated.model_copy(deep=True)

    status = "watching"
    if competitor_price is not None and current_price <= competitor_price:
        status = "already_cheaper"
    elif current_price <= target_price:
        status = "price_dropped"

    item = _with_price_status(WatchedItem(
        watch_id=str(uuid4()),
        sku=data.sku,
        name=data.name,
        brand=data.brand,
        current_price_inr=current_price,
        target_price_inr=target_price,
        competitor_source=source,
        competitor_price_inr=competitor_price,
        status=status,
        price_history=_history(data.sku, current_price, current_price),
        email=data.email,
    ))
    _watches.setdefault(user_id, []).insert(0, item)
    return item.model_copy(deep=True)


def get_watches(user_id: str) -> list[WatchedItem]:
    seed_demo_data(user_id)
    watches = [_with_price_status(item) for item in _watches.get(user_id, [])]
    _watches[user_id] = watches
    return deepcopy(watches)


def find_watch_by_sku(user_id: str, sku: str) -> WatchedItem | None:
    normalized = sku.strip().lower()
    for item in _watches.get(user_id, []):
        if item.sku.strip().lower() == normalized:
            return item
    return None


def get_watch(user_id: str, watch_id: str) -> WatchedItem | None:
    for item in _watches.get(user_id, []):
        if item.watch_id == watch_id:
            return item
    return None


def remove_watch(user_id: str, watch_id: str) -> bool:
    items = _watches.get(user_id, [])
    next_items = [item for item in items if item.watch_id != watch_id]
    _watches[user_id] = next_items
    return len(next_items) != len(items)


def update_watch(user_id: str, watch_id: str, updates: dict) -> WatchedItem | None:
    item = get_watch(user_id, watch_id)
    if item is None:
        return None
    updated = item.model_copy(update=updates)
    _watches[user_id] = [updated if existing.watch_id == watch_id else existing for existing in _watches.get(user_id, [])]
    return updated.model_copy(deep=True)


def replace_watches(user_id: str, watches: list[WatchedItem]) -> list[WatchedItem]:
    _watches[user_id] = [_with_price_status(item.model_copy(deep=True)) for item in watches]
    _seeded_users.add(user_id)
    return get_watches(user_id)


def get_aggregate_stats(user_id: str) -> WatchStats:
    watches = get_watches(user_id)
    total_saved = sum(max(0.0, item.price_history[0].price - item.current_price_inr) for item in watches if item.status in {"price_dropped", "already_cheaper"} and item.price_history)
    total_saved += sum(item.logistics_saved_inr for item in watches if item.neighbor_match)
    total_co2 = sum(item.co2_saved_kg for item in watches)
    alerts = sum(1 for item in watches if item.status != "watching")
    return WatchStats(
        total_saved_inr=round(total_saved, 2),
        total_co2_saved_kg=round(total_co2, 3),
        count=len(watches),
        alerts=alerts,
    )
