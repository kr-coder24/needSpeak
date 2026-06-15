import pytest
from app.watchlist.models import CreateWatchRequest, PriceStatusBatchRequest, PriceStatusBatchRequestItem
from app.watchlist.watch_store import (
    get_user_watchlist,
    create_watch,
    simulate_next_day,
    _WATCH_STORE,
    _SEEDED_USERS
)
from app.watchlist.price_status import get_price_status_for_item, get_price_status_batch

@pytest.fixture(autouse=True)
def clear_store():
    # Clear store before each test
    _WATCH_STORE.clear()
    _SEEDED_USERS.clear()

def test_seed_demo_data_for_new_user():
    user_id = "test_user_1"
    watches = get_user_watchlist(user_id)
    assert len(watches) >= 6, "Seed should provide at least 6 demo watches"
    for w in watches:
        assert len(w.price_history) >= 30, "Each seeded watch should have at least 30 history points"

def test_create_watch_has_30_day_history():
    user_id = "test_user_2"
    req = CreateWatchRequest(sku="NEW-SKU", name="New Product", current_price_inr=100.0)
    watch = create_watch(user_id, req)
    
    assert watch.sku == "NEW-SKU"
    assert len(watch.price_history) >= 30, "Newly created watch should have a 30-day history immediately"
    assert watch.price_status is not None, "Watch must have an initialized price status"

def test_create_watch_is_idempotent_by_user_and_sku():
    user_id = "test_user_3"
    req1 = CreateWatchRequest(sku="SAME-SKU", name="Prod", current_price_inr=50.0)
    w1 = create_watch(user_id, req1)
    
    req2 = CreateWatchRequest(sku="SAME-SKU", name="Prod", current_price_inr=50.0, email="test@example.com")
    w2 = create_watch(user_id, req2)
    
    assert w1.watch_id == w2.watch_id, "Watch ID must remain the same for repeated adds"
    assert w2.email == "test@example.com", "Optional fields should update on idempotent adds"
    
    watches = get_user_watchlist(user_id)
    sku_matches = [w for w in watches if w.sku == "SAME-SKU"]
    assert len(sku_matches) == 1, "There should be no duplicate watches for the same SKU"

def test_price_status_unknown_sku_returns_status():
    status = get_price_status_for_item("UNKNOWN-SKU", 150.0)
    assert status.status in ["best", "fair", "high"]
    assert status.thirty_day_low_inr > 0
    assert status.thirty_day_high_inr >= status.thirty_day_low_inr

def test_price_status_batch_returns_all_items():
    items = [
        {"sku": "SKU-A", "current_price_inr": 100},
        {"sku": "SKU-B", "current_price_inr": 200}
    ]
    results = get_price_status_batch(items)
    assert len(results) == 2
    assert results[0]["sku"] == "SKU-A"
    assert results[1]["sku"] == "SKU-B"
    assert "price_status" in results[0]

def test_simulate_appends_history():
    user_id = "test_user_4"
    req = CreateWatchRequest(sku="SIM-SKU", name="Sim Prod", current_price_inr=100.0)
    w = create_watch(user_id, req)
    
    initial_history_len = len(w.price_history)
    initial_last_date = w.price_history[-1].date
    
    simulate_next_day(user_id)
    
    # After simulation, length should be bounded, but definitely the latest date should advance
    assert w.price_history[-1].date > initial_last_date

def test_demo_events_are_stable():
    user_id = "test_user_5"
    req = CreateWatchRequest(sku="EVENT-SKU", name="Evt Prod", current_price_inr=100.0, target_price_inr=200.0)
    create_watch(user_id, req)
    
    events = simulate_next_day(user_id)
    assert len(events) >= 1
    
    # Event ID should have a stable format
    assert "id" in events[0]
    assert events[0]["id"].startswith("evt_")
