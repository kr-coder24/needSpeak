from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_seed_demo_data_for_new_user():
    response = client.get("/api/watchlist/test-hero-user")
    assert response.status_code == 200
    watches = response.json()
    assert len(watches) >= 6
    assert all(len(item["price_history"]) >= 30 for item in watches)
    assert all(item["price_status"]["deal_color"] in {"green", "yellow", "red"} for item in watches)


def test_create_watch_has_30_day_history_and_is_idempotent():
    user_id = "test-idempotent-user"
    payload = {
        "sku": "HERO-IDEMPOTENT-1",
        "name": "Hero Idempotent Product",
        "brand": "Demo",
        "current_price_inr": 12990,
        "target_price_inr": 13499,
        "competitor_text": "Flipkart - Rs 13990",
        "user_id": user_id,
        "email": "demo@example.com",
    }

    first = client.post("/api/watchlist/watch", json=payload)
    second = client.post("/api/watchlist/watch", json={**payload, "target_price_inr": 12000})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["watch_id"] == second.json()["watch_id"]
    assert len(second.json()["price_history"]) == 30

    watches = client.get(f"/api/watchlist/{user_id}").json()
    matching = [item for item in watches if item["sku"] == payload["sku"]]
    assert len(matching) == 1


def test_price_status_unknown_sku_and_batch():
    single = client.post(
        "/api/watchlist/price-status",
        json={"sku": "UNKNOWN-SKU-1", "current_price_inr": 999, "user_id": "status-user"},
    )
    assert single.status_code == 200
    assert single.json()["deal_color"] in {"green", "yellow", "red"}

    batch = client.post(
        "/api/watchlist/price-status/batch",
        json={
            "user_id": "status-user",
            "items": [
                {"sku": "UNKNOWN-SKU-1", "current_price_inr": 999},
                {"sku": "UNKNOWN-SKU-2", "current_price_inr": 1999},
            ],
        },
    )
    assert batch.status_code == 200
    assert len(batch.json()["items"]) == 2


def test_simulate_appends_history_and_demo_events_are_stable():
    user_id = "simulate-user"
    before = client.get(f"/api/watchlist/{user_id}").json()
    before_len = len(before[0]["price_history"])
    simulated = client.post(f"/api/watchlist/{user_id}/simulate")
    assert simulated.status_code == 200
    after = simulated.json()["watches"]
    assert len(after[0]["price_history"]) == before_len + 1

    events = client.get("/api/watchlist/demo-events")
    assert events.status_code == 200
    ids = [event["id"] for event in events.json()]
    assert len(ids) == len(set(ids)) == 3
