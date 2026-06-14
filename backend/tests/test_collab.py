import pytest
from fastapi.testclient import TestClient

from app.collab.collab_service import resolve_collab_input
from app.collab.collab_store import (
    clear_sessions_for_tests,
    create_session,
    get_budget_split,
    join_session,
    merge_resolved_item,
)
from app.collab.models import CollabItemInput
from app.main import app


@pytest.fixture(autouse=True)
def clean_collab_store():
    clear_sessions_for_tests()
    yield
    clear_sessions_for_tests()


def test_collab_merges_demand_and_splits_actual_cost():
    session, host = create_session("Milk run", "Host", 500)
    guest = join_session(session.session_id, "Guest")

    for contributor in (host, guest):
        resolved, suggestions = resolve_collab_input(
            CollabItemInput(name="amul milk", quantity=600, unit="ml"),
            contributor,
        )
        assert suggestions == []
        assert resolved is not None
        merge_resolved_item(session.session_id, contributor.id, resolved)

    merged = session.items[0]
    assert "amul" in merged.name.lower()
    assert merged.quantity > 0
    assert merged.total_price_inr > 0
    assert len(merged.demands) == 2

    splits = get_budget_split(session.session_id)
    assert splits is not None


def test_collab_suggests_close_match_but_rejects_gibberish():
    _, host = create_session("Stationery", "Host", 500)

    resolved, suggestions = resolve_collab_input(
        CollabItemInput(name="notebok", quantity=2, unit="piece"),
        host,
    )
    assert resolved is None
    assert suggestions[0].name == "classmate long notebook 180 pages"

    resolved, suggestions = resolve_collab_input(
        CollabItemInput(name="asdfghjkl", quantity=1, unit="piece"),
        host,
    )
    assert resolved is None
    assert suggestions == []


def test_collab_normalizes_count_unit_for_measured_product():
    _, host = create_session("Milk unit fix", "Host", 500)

    resolved, suggestions = resolve_collab_input(
        CollabItemInput(name="milk", quantity=1, unit="piece"),
        host,
    )

    assert suggestions == []
    assert resolved is not None
    demand = resolved.demands[0]
    assert resolved.name == "amul taaza fresh milk"
    assert resolved.quantity == 1
    assert demand.requested_quantity == 500
    assert demand.requested_unit == "ml"
    assert "sold by ml" in demand.notes


def test_websocket_resolves_product_and_returns_live_state():
    with TestClient(app) as client:
        created = client.post(
            "/api/collab/create",
            json={
                "name": "Demo cart",
                "host_name": "Aman",
                "total_budget_inr": 500,
            },
        )
        assert created.status_code == 200
        payload = created.json()
        session_id = payload["session"]["session_id"]
        contributor_id = payload["contributor"]["id"]

        with client.websocket_connect(
            f"/api/collab/{session_id}/ws?contributor_id={contributor_id}"
        ) as websocket:
            initial = websocket.receive_json()
            assert initial["type"] == "session_state"
            assert initial["data"]["session"]["items"] == []

            websocket.send_json(
                {
                    "type": "add_items",
                    "data": {
                        "items": [
                            {
                                "name": "milk",
                                "quantity": 600,
                                "unit": "ml",
                                "category": "general",
                            }
                        ]
                    },
                }
            )
            update = websocket.receive_json()
            assert update["type"] == "items_added"
            item = update["data"]["session"]["items"][0]
            assert item["sku"] == "SKU-BAK-V266"
            assert item["quantity"] == 2
            assert item["estimated_price_inr"] > 0
            assert update["data"]["splits"][0]["amount_owed"] > 0

            websocket.send_json(
                {
                    "type": "add_items",
                    "data": {
                        "items": [
                            {
                                "name": "milk",
                                "quantity": 1,
                                "unit": "piece",
                                "category": "general",
                            }
                        ]
                    },
                }
            )
            normalized = websocket.receive_json()
            assert normalized["type"] == "items_added"
            normalized_item = normalized["data"]["session"]["items"][0]
            assert normalized_item["quantity"] == 3
            assert normalized_item["demands"][0]["requested_unit"] == "ml"
            assert normalized_item["demands"][0]["requested_quantity"] == 1100

            websocket.send_json(
                {
                    "type": "add_items",
                    "data": {
                        "items": [
                            {
                                "name": "notebok",
                                "quantity": 2,
                                "unit": "piece",
                            }
                        ]
                    },
                }
            )
            suggestion = websocket.receive_json()
            assert suggestion["type"] == "item_suggestions"
            assert (
                suggestion["data"]["requests"][0]["suggestions"][0]["sku"]
                == "SKU-STN-001"
            )

            websocket.send_json(
                {
                    "type": "add_items",
                    "data": {
                        "items": [
                            {
                                "name": "asdfghjkl",
                                "quantity": 1,
                                "unit": "piece",
                            }
                        ]
                    },
                }
            )
            missing = websocket.receive_json()
            assert missing == {
                "type": "items_not_found",
                "data": {"items": ["asdfghjkl"]},
            }
