from fastapi.testclient import TestClient
import json
import pytest
from app.main import app

client = TestClient(app)

def test_confidence_high_with_clear_input():
    # Pass mock mode via header to avoid touching AWS dependencies
    response = client.post(
        "/api/parse",
        headers={"X-Mock-Mode": "1"},
        json={
            "input_type": "text",
            "content": "I want to make a burger"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] == "high"
    assert data["clarification_question"] is None
    assert len(data["intents"]) > 0
    assert len(data["intents"][0]["cart"]) > 0

def test_confidence_low_with_ambiguous_input():
    # "ambiguous" keyword still triggers low confidence for truly uninterpretable input
    response = client.post(
        "/api/parse",
        headers={"X-Mock-Mode": "1"},
        json={
            "input_type": "text",
            "content": "ambiguous"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] == "low"
    assert data["clarification_question"] is not None
    assert len(data["intents"]) > 0
    assert len(data["intents"][0]["cart"]) == 0


def test_snacks_for_guests_resolves_immediately():
    # "snacks for guests" should now resolve with high confidence and actual items
    response = client.post(
        "/api/parse",
        headers={"X-Mock-Mode": "1"},
        json={
            "input_type": "text",
            "content": "Need snacks for guests"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] == "high"
    assert data["clarification_question"] is None
    assert len(data["intents"]) > 0
    assert len(data["intents"][0]["cart"]) > 0
    assert data["intents"][0]["intent_type"] == "general"
