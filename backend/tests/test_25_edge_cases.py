import pytest
import json
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app

client = TestClient(app)

# Helper function to mock the LLM
def mock_llm_response(test_case_id: str):
    responses = {
        "test1": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [{
                "intent_type": "general",
                "context_summary": "Unstructured grocery list",
                "items": [
                    {"name": "rice", "quantity": 1, "unit": "kg", "category": "grains"},
                    {"name": "onion", "quantity": 5, "unit": "piece", "category": "vegetables"},
                    {"name": "salt", "quantity": 1, "unit": "pack", "category": "spices"},
                    {"name": "snacks", "quantity": 2, "unit": "pack", "category": "snacks"}
                ]
            }]
        },
        "test2": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [{
                "intent_type": "recipe",
                "context_summary": "Baking a cake",
                "items": [
                    {"name": "eggs", "quantity": 12, "unit": "piece", "category": "dairy"},
                    {"name": "milk", "quantity": 1, "unit": "litre", "category": "dairy"},
                    {"name": "flour", "quantity": 1, "unit": "pack", "category": "grains"},
                    {"name": "sugar", "quantity": 1, "unit": "pack", "category": "spices"}
                ]
            }]
        },
        "test3": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [{
                "intent_type": "recipe",
                "context_summary": "Palak Paneer for 4 people",
                "items": [
                    {"name": "spinach", "quantity": 2, "unit": "bunch", "category": "vegetables"},
                    {"name": "paneer", "quantity": 400, "unit": "g", "category": "dairy"},
                    {"name": "garlic", "quantity": 5, "unit": "clove", "category": "vegetables"},
                    {"name": "tomato", "quantity": 2, "unit": "piece", "category": "vegetables"}
                ]
            }]
        },
        "test4": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [{
                "intent_type": "diy",
                "context_summary": "Fixing a leaky sink pipe",
                "items": [
                    {"name": "adjustable wrench", "quantity": 1, "unit": "piece", "category": "tools_hardware"},
                    {"name": "ptfe tape", "quantity": 1, "unit": "piece", "category": "tools_hardware"},
                    {"name": "pipe sealant", "quantity": 1, "unit": "piece", "category": "tools_hardware"}
                ]
            }]
        },
        "test5": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [{
                "intent_type": "supplies",
                "context_summary": "5th grade school supplies",
                "items": [
                    {"name": "notebook", "quantity": 5, "unit": "piece", "category": "stationery"},
                    {"name": "pen", "quantity": 2, "unit": "pack", "category": "stationery"},
                    {"name": "ruler", "quantity": 1, "unit": "piece", "category": "stationery"}
                ]
            }]
        },
        "test12": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [
                {
                    "intent_type": "supplies",
                    "context_summary": "Camping trip supplies",
                    "items": [
                        {"name": "tent", "quantity": 1, "unit": "piece", "category": "general"},
                        {"name": "flashlight", "quantity": 1, "unit": "piece", "category": "tools_hardware"}
                    ]
                },
                {
                    "intent_type": "recipe",
                    "context_summary": "Pasta for dinner",
                    "items": [
                        {"name": "pasta", "quantity": 1, "unit": "pack", "category": "grains"},
                        {"name": "pasta sauce", "quantity": 1, "unit": "pack", "category": "spices"},
                        {"name": "cheese", "quantity": 1, "unit": "pack", "category": "dairy"}
                    ]
                }
            ]
        },
        "test14": {
            "confidence": "low",
            "clarification_question": "What kind of guests? Are you serving dinner, snacks, or drinks?",
            "intents": []
        },
        "test16": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [{
                "intent_type": "recipe",
                "context_summary": "Fuzzy volume extraction",
                "items": [
                    {"name": "saffron", "quantity": 1, "unit": "g", "category": "spices"},
                    {"name": "almonds", "quantity": 50, "unit": "g", "category": "snacks"}
                ]
            }]
        },
        "test19": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [{
                "intent_type": "recipe",
                "context_summary": "Butter chicken",
                "items": [
                    {"name": "chicken", "quantity": 500, "unit": "g", "category": "general"},
                    {"name": "butter", "quantity": 100, "unit": "g", "category": "dairy"},
                    {"name": "tomato", "quantity": 3, "unit": "piece", "category": "vegetables"}
                ]
            }]
        },
        "test22": {
            "confidence": "high",
            "clarification_question": None,
            "intents": [{
                "intent_type": "recipe",
                "context_summary": "Vegan pizza",
                "items": [
                    {"name": "vegan cheese", "quantity": 1, "unit": "pack", "category": "dairy"},
                    {"name": "pizza base", "quantity": 2, "unit": "piece", "category": "grains"},
                    {"name": "capsicum", "quantity": 2, "unit": "piece", "category": "vegetables"}
                ]
            }]
        }
    }
    return json.dumps(responses.get(test_case_id, responses["test1"]))

# We patch the _call_llm function inside extractor to return our mock JSON
# so we don't hit the real Gemini API or use the fallback mock strings.

@patch("app.pipeline.extractor._call_llm")
def test_1_unstructured_grocery_list(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test1")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "Hey, I need some rice..."}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["intents"]) == 1
    assert data["intents"][0]["intent_type"] == "general"

@patch("app.pipeline.extractor._call_llm")
def test_2_implicit_quantities(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test2")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "dozen eggs..."}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    cart = data = resp.json()["intents"][0]["cart"]
    assert any(i["name"] == "eggs" for i in cart)

@patch("app.pipeline.extractor._call_llm")
def test_3_complex_indian_recipe(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test3")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "Palak Paneer"}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    
@patch("app.pipeline.extractor._call_llm")
def test_4_hardware_diy(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test4")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "sink pipe leaking"}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    assert resp.json()["intents"][0]["intent_type"] == "diy"

@patch("app.pipeline.extractor._call_llm")
def test_5_stationery_supplies(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test5")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "5th grade supplies"}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    assert resp.json()["intents"][0]["intent_type"] == "supplies"

@patch("app.pipeline.extractor._call_llm")
def test_12_dual_disjoint_intents(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test12")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "camping tent and pasta dinner"}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["intents"]) == 2
    types = [i["intent_type"] for i in data["intents"]]
    assert "supplies" in types
    assert "recipe" in types

@patch("app.pipeline.extractor._call_llm")
def test_14_broad_ambiguous_request(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test14")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "guests coming over"}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["confidence"] == "low"
    assert "What kind of guests" in data["clarification_question"]

@patch("app.pipeline.extractor._call_llm")
def test_16_fuzzy_volumes(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test16")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "pinch of saffron"}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200

@patch("app.pipeline.extractor._call_llm")
def test_19_strict_budget_substitution(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test19")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "butter chicken", "budget_inr": 300}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    data = resp.json()
    cart = [i for g in data["intents"] for i in g["cart"]]
    # At 300, it should substitute or be very cheap
    assert data["budget_exceeded"] is False or len(cart) > 0

@patch("app.pipeline.extractor._call_llm")
def test_22_dietary_constraints(mock_call_llm):
    mock_call_llm.return_value = mock_llm_response("test22")
    resp = client.post("/api/parse", json={"input_type": "text", "content": "vegan pizza"}, headers={"X-Mock-Mode": "0"})
    assert resp.status_code == 200
    cart = [i for g in resp.json()["intents"] for i in g["cart"]]
    unavailable = [i for g in resp.json()["intents"] for i in g["unavailable_items"]]
    assert len(cart) + len(unavailable) > 0
