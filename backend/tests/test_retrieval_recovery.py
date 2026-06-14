import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import ExtractedItem
from app.pipeline import resolver
from app.pipeline.resolver import resolve_cart
from app.search.local_retrieval import LocalRetriever
from app.search.local_vector_retrieval import LocalVectorRetriever
from app.search.ranker import RankingContext, rank_candidates
from app.catalog.models import ProductCandidate
from app.db.dynamo import get_user_events, get_user_preferences, save_user_preferences
from app.intelligence.event_logger import log_event
from app.ingestion.url_fetcher import is_youtube_url


def _reset_retriever():
    resolver._retriever = None


def test_default_search_provider_uses_local_retriever(monkeypatch):
    monkeypatch.delenv("SEARCH_PROVIDER", raising=False)
    _reset_retriever()

    retriever = resolver._get_retriever(mock_mode=True)

    assert isinstance(retriever, LocalRetriever)


def test_local_vector_retriever_is_explicit_opt_in(monkeypatch):
    monkeypatch.setenv("SEARCH_PROVIDER", "local_vector")
    _reset_retriever()

    retriever = resolver._get_retriever(mock_mode=True)

    assert isinstance(retriever, LocalVectorRetriever)


def test_ranker_keeps_relevance_above_rating_noise():
    strong_match = ProductCandidate(
        sku="RICE-LOW-RATING",
        title="budget basmati rice",
        brand="Local",
        category="grains",
        subcategory="rice",
        price_inr=120,
        unit="g",
        unit_quantity=1000,
        rating=3.4,
        review_count=10,
        in_stock=True,
        keywords={"rice", "basmati"},
        text_score=10.0,
    )
    weak_match = ProductCandidate(
        sku="COOKIE-HIGH-RATING",
        title="premium chocolate cookies",
        brand="Premium",
        category="snacks",
        subcategory="biscuits",
        price_inr=60,
        unit="g",
        unit_quantity=100,
        rating=5.0,
        review_count=10000,
        in_stock=True,
        keywords={"cookies"},
        text_score=1.0,
    )

    ranked = rank_candidates(
        [weak_match, strong_match],
        RankingContext(budget_mode="balanced"),
    )

    assert ranked[0].sku == "RICE-LOW-RATING"
    assert ranked[0].purchase_likelihood > ranked[1].purchase_likelihood


def test_resolved_cart_includes_likelihood_fields_for_recipe_items(monkeypatch):
    monkeypatch.delenv("SEARCH_PROVIDER", raising=False)
    _reset_retriever()

    items = [
        ExtractedItem(name="basmati rice", quantity=500, unit="g", category="grains"),
        ExtractedItem(name="chicken", quantity=750, unit="g", category="meat_poultry"),
        ExtractedItem(name="onion", quantity=3, unit="piece", category="vegetables"),
        ExtractedItem(name="curd", quantity=200, unit="g", category="dairy"),
        ExtractedItem(name="biryani masala", quantity=50, unit="g", category="spices"),
    ]

    cart, unavailable, total, budget_exceeded = resolve_cart(
        items=items,
        budget_inr=2000,
        session_id="test-biryani",
        mock_mode=True,
        budget_mode="balanced",
        occasion="biryani",
    )

    assert total > 0
    assert not budget_exceeded
    assert len(cart) >= 4
    assert len(unavailable) <= 1
    assert all(0 <= item.purchase_likelihood <= 1 for item in cart)
    assert all(0 <= item.likely_rating <= 100 for item in cart)
    assert any("rice" in item.name.lower() for item in cart)
    assert any("masala" in item.name.lower() for item in cart)


def test_broad_chips_query_returns_selected_item_with_limited_alternatives(monkeypatch):
    monkeypatch.delenv("SEARCH_PROVIDER", raising=False)
    _reset_retriever()

    cart, unavailable, total, _ = resolve_cart(
        items=[ExtractedItem(name="chips", quantity=3, unit="pack", category="snacks")],
        session_id="test-chips",
        mock_mode=True,
        budget_mode="balanced",
    )

    assert total > 0
    assert unavailable == []
    assert len(cart) == 1
    assert "chips" in " ".join(cart[0].matched_from).lower()
    assert len(cart[0].alternatives) <= 3
    assert 0 <= cart[0].likely_rating <= 100


def test_youtube_url_detection_routes_to_url_ingestion():
    assert is_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert is_youtube_url("https://youtu.be/dQw4w9WgXcQ")


def test_youtube_transcript_like_burger_recipe_resolves_core_items(monkeypatch):
    monkeypatch.delenv("SEARCH_PROVIDER", raising=False)
    _reset_retriever()

    items = [
        ExtractedItem(name="burger buns", quantity=4, unit="piece", category="grains"),
        ExtractedItem(name="aloo tikki patty", quantity=4, unit="piece", category="snacks"),
        ExtractedItem(name="cheese slices", quantity=4, unit="piece", category="dairy"),
        ExtractedItem(name="tomato ketchup", quantity=1, unit="pack", category="spices"),
    ]

    cart, unavailable, total, _ = resolve_cart(
        items=items,
        session_id="test-youtube-burger",
        mock_mode=True,
        budget_mode="balanced",
    )

    names = " ".join(item.name.lower() for item in cart)
    unavailable_names = " ".join(item.name.lower() for item in unavailable)
    assert total > 0
    assert "bun" in names
    assert "cheese" in names
    assert "fresh tomato" not in names
    assert "ketchup" in names or "ketchup" in unavailable_names


def test_mock_preferences_round_trip_generalized_profile():
    user_id = "test-pref-user"
    preferences = {
        "dietary": ["veg"],
        "preferred_brands": ["Amul"],
        "avoided_brands": ["Generic"],
        "preferred_categories": ["dairy", "snacks"],
        "avoided_categories": ["meat_poultry"],
        "allergies": ["peanut"],
        "budget_mode": "balanced",
        "quality_preference": "quality",
        "pack_size_preference": "bulk",
    }

    save_user_preferences(user_id, preferences, mock_mode=True)

    assert get_user_preferences(user_id, mock_mode=True) == preferences


def test_event_logger_respects_mock_mode_for_behavior_events():
    user_id = "test-event-user"

    log_event(
        user_id=user_id,
        event_type="purchase",
        sku="MOCK-DAI-005",
        session_id="test-session",
        intent_type="recipe",
        query_text="burger ingredients",
        rank_position=1,
        price_inr=130,
        category="dairy",
        context="accepted cart item",
        mock_mode=True,
    )

    events = get_user_events(user_id, event_type="purchase", mock_mode=True)
    assert events
    assert events[0]["user_id"] == user_id
    assert events[0]["sku"] == "MOCK-DAI-005"
    assert events[0]["category"] == "dairy"
