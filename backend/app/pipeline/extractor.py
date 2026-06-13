"""
Bedrock Stage 1 — Extract structured shopping list from raw text.

Uses Claude Sonnet 4.6 via Amazon Bedrock to parse any text input
into a structured JSON shopping list with items, quantities, and units.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

import boto3
from google import genai
from google.genai import types

from app import config
from app.config import AWS_REGION, BEDROCK_MODEL_ID, MOCK_MODE, GEMINI_API_KEY, GEMINI_MODEL_ID, LLM_PROVIDER
from app.models import ExtractionResult, ExtractedItem, ExtractedIntent, IntentType
from app.pipeline.bedrock_client import get_bedrock_client
from app.pipeline.gemini_client import get_gemini_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a shopping list extractor. You receive text that may be a recipe, \
DIY instructions, a supplies list, a medical note, or a general shopping request. \
Your job is to extract every item that needs to be purchased.

RULES:
1. Output ONLY valid JSON. No prose, no markdown fences, no explanation, no preamble.
2. If the input is completely unrelated to shopping, cooking, events, gatherings, or any activity that might need supplies (e.g. "what is the weather?"), return: {"intents": [], "error": "no_shoppable_content"}
3. Never invent quantities not implied by the text. If no quantity is stated, use reasonable defaults (e.g., 1 for countable items, 100g for small amounts).
4. Normalize units to: g, ml, piece, pack, cup, tbsp, tsp, clove, bunch, kg, litre. Use the most natural unit for the item.
5. For recipes, estimate quantities for the stated number of servings.
6. Decompose the request into logical intents. For each intent, classify intent_type as exactly one of: recipe, diy, supplies, medical, general.
7. The context_summary should be one sentence describing what the user is trying to do for that specific intent.
8. Understand Hindi, Hinglish, and Indian English — many inputs will use these.
9. For budget-constrained requests, extract the budget but still list all items normally.
10. If the text mentions servings/people, set the servings field accordingly.
11. DEDUPLICATE: Combine identical or similar ingredients (e.g. "onions" and "sliced onions") into a single entry with their quantities combined/summed. Do NOT list the same item multiple times for different recipe steps.
12. CONFIDENCE EVALUATION: Assess how confident you are in the user's intent. If the input is too vague or broad (e.g., "I need snacks for guests" without specifying what kind of gathering), set confidence to "low" and provide a helpful clarification_question (e.g., "Is this a sports gathering, a children's birthday, or a formal dinner?"). Otherwise, set confidence to "high" and clarification_question to null.
13. EVENT INFERENCE: For event, party, occasion, or gathering descriptions (e.g. "IPL watch party for 10 people", "birthday party", "movie night", "picnic for 5"), infer and suggest common items that would be needed (snacks, drinks, disposables, etc.) even if the user did not list specific items. Scale quantities to the number of people mentioned. These are valid shopping requests — do NOT return no_shoppable_content for them.
14. For Indian events and occasions, suggest culturally appropriate items (e.g. chips, namkeen, cold drinks, popcorn, paper cups, paper plates for a cricket watch party)."""

USER_PROMPT_TEMPLATE = """Extract the shopping list from this text.{servings_instruction}

TEXT:
{input_text}

Respond with JSON matching this exact schema:
{{
  "confidence": "high|medium|low",
  "clarification_question": "question string or null",
  "servings": null or number,
  "intents": [
    {{
      "intent_type": "recipe|diy|supplies|medical|general",
      "context_summary": "one sentence summary for this specific intent",
      "items": [
        {{
          "name": "item name in english, lowercase",
          "quantity": number,
          "unit": "g|ml|piece|pack|cup|tbsp|tsp|kg|litre|clove|bunch",
          "category": "grains|dairy|vegetables|fruits|beverages|snacks|spices|oils|cleaning|stationery|tools_hardware|medicines_otc",
          "optional": false,
          "notes": "optional note or null"
        }}
      ]
    }}
  ]
}}"""


# ---------------------------------------------------------------------------
# JSON Sanitizer (Risk 1 Mitigation)
# ---------------------------------------------------------------------------
def _sanitize_json_response(raw: str) -> Optional[dict]:
    """
    Extract valid JSON from Bedrock's response, handling common issues:
    1. Markdown code fences (```json ... ```)
    2. Leading/trailing prose
    3. Whitespace issues
    """
    text = raw.strip()

    # Remove markdown code fences
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n?```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()

    # Find the JSON object — first { to last }
    first_brace = text.find("{")
    last_brace = text.rfind("}")

    if first_brace == -1 or last_brace == -1 or last_brace <= first_brace:
        return None

    json_str = text[first_brace : last_brace + 1]

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse failed after sanitization: {e}")
        return None


# ---------------------------------------------------------------------------
# Core Extraction
# ---------------------------------------------------------------------------
def _call_gemini(system_prompt: str, user_prompt: str) -> str:
    """Invoke Gemini with retry and fallback models to handle transient 503/429 load spikes."""
    import time
    client = get_gemini_client()
    
    # Try the configured model first, followed by reliable fallbacks
    models_to_try = [GEMINI_MODEL_ID]
    for m in ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash"]:
        if m not in models_to_try:
            models_to_try.append(m)
            
    last_error = None
    for model in models_to_try:
        # Retry up to 3 times per model for transient errors
        for attempt in range(3):
            try:
                logger.info(f"Attempting Gemini call with model={model} (attempt {attempt + 1})...")
                response = client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        temperature=0.1,
                        max_output_tokens=4096,
                    )
                )
                if response.text:
                    logger.info(f"Gemini call succeeded with model={model}")
                    return response.text
                else:
                    raise ValueError("Empty response text received")
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini model={model} attempt {attempt + 1} failed: {e}")
                # Wait before retrying (exponential backoff)
                time.sleep(1 * (attempt + 1))
                
    # If all models/attempts failed, raise the final exception
    raise last_error or RuntimeError("Gemini API call failed for all models")


def _call_bedrock(system_prompt: str, user_prompt: str) -> str:
    """Invoke Bedrock with the given prompts, return raw text response."""
    client = get_bedrock_client()

    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0.1,  # Low temperature for structured output
        "system": system_prompt,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": user_prompt}],
            }
        ],
    }

    response = client.invoke_model(
        modelId=BEDROCK_MODEL_ID,
        body=json.dumps(request_body),
        contentType="application/json",
    )

    response_body = json.loads(response["body"].read())
    return response_body["content"][0]["text"]

def _call_llm(system_prompt: str, user_prompt: str) -> str:
    if config.LLM_PROVIDER == "gemini":
        return _call_gemini(system_prompt, user_prompt)
    return _call_bedrock(system_prompt, user_prompt)


def _call_llm(system_prompt: str, user_prompt: str) -> str:
    """Route intent extraction call to either Gemini or Bedrock."""
    if LLM_PROVIDER == "bedrock":
        return _call_bedrock(system_prompt, user_prompt)
    else:
        return _call_gemini(system_prompt, user_prompt)


def extract_items(
    text: str,
    servings_override: Optional[int] = None,
    mock_mode: Optional[bool] = None,
) -> ExtractionResult:
    """
    Stage 1: Extract a structured shopping list from raw text.

    Args:
        text: Raw input text (recipe, list, message, etc.)
        servings_override: Optional serving count to scale quantities to
        mock_mode: Optional request-scoped mock mode flag

    Returns:
        ExtractionResult with parsed items
    """
    is_mock = mock_mode if mock_mode is not None else MOCK_MODE
    # MOCK_MODE bypasses the LLM entirely (canned extraction). AWS mocking is
    # handled separately by MOCK_AWS in the db layer.
    if is_mock:
        return _get_mock_extraction(text)

    # Build user prompt
    servings_instruction = ""
    if servings_override:
        servings_instruction = f"\n\nIMPORTANT: Only scale quantities to {servings_override} servings if simple linear scaling would produce unrealistic results. Otherwise, extract base quantities and report the base servings."

    user_prompt = USER_PROMPT_TEMPLATE.format(
        servings_instruction=servings_instruction,
        input_text=text,
    )

    # First attempt
    logger.info(f"Calling {LLM_PROVIDER} for extraction (attempt 1)...")
    try:
        raw_response = _call_llm(SYSTEM_PROMPT, user_prompt)
    except Exception as e:
        logger.error(f"{LLM_PROVIDER} call failed: {e}. Falling back to mock extraction for demo stability.")
        return _get_mock_extraction(text)

    parsed = _sanitize_json_response(raw_response)

    # Retry once with stricter prompt if parse failed
    if parsed is None:
        logger.warning(f"First extraction attempt via {LLM_PROVIDER} returned invalid JSON. Retrying with stricter prompt...")
        strict_prompt = (
            "You MUST respond with ONLY a JSON object. No other text before or after. "
            "No markdown fences. Just the raw JSON.\n\n" + user_prompt
        )
        try:
            raw_response = _call_llm(SYSTEM_PROMPT, strict_prompt)
        except Exception as e:
            logger.error(f"{LLM_PROVIDER} retry failed: {e}. Falling back to mock extraction.")
            return _get_mock_extraction(text)

        parsed = _sanitize_json_response(raw_response)

        if parsed is None:
            logger.error("Second extraction attempt also failed. Falling back to mock extraction.")
            return _get_mock_extraction(text)

    # Check for no_shoppable_content
    if parsed.get("error") == "no_shoppable_content":
        return ExtractionResult(intents=[], error="no_shoppable_content")

    # Parse intents and items
    intents = []
    for raw_intent in parsed.get("intents", []):
        items = []
        for raw_item in raw_intent.get("items", []):
            try:
                item = ExtractedItem(
                    name=raw_item.get("name", "unknown"),
                    quantity=float(raw_item.get("quantity", 1)),
                    unit=raw_item.get("unit", "piece"),
                    category=raw_item.get("category", "general"),
                    optional=raw_item.get("optional", False),
                    notes=raw_item.get("notes"),
                )
                items.append(item)
            except Exception as e:
                logger.warning(f"Failed to parse extracted item: {raw_item} — {e}")
        
        intent_str = raw_intent.get("intent_type", "general").lower()
        try:
            intent_type = IntentType(intent_str)
        except ValueError:
            intent_type = IntentType.GENERAL

        items = _deduplicate_extracted_items(items)
        
        intents.append(ExtractedIntent(
            intent_type=intent_type,
            context_summary=raw_intent.get("context_summary", ""),
            items=items,
        ))

    return ExtractionResult(
        servings=parsed.get("servings"),
        confidence=parsed.get("confidence", "high"),
        clarification_question=parsed.get("clarification_question"),
        intents=intents,
    )


def _deduplicate_extracted_items(items: list[ExtractedItem]) -> list[ExtractedItem]:
    """Merge items with identical names and units (e.g., 'onion' and 'onion')."""
    merged: dict[tuple[str, str], ExtractedItem] = {}
    for item in items:
        # Normalize name: lowercase, strip, singularize (remove trailing 's' if any)
        name_norm = item.name.lower().strip()
        if len(name_norm) > 1 and name_norm.endswith("s"):
            name_norm = name_norm[:-1]
        
        # Group by normalized name and unit
        key = (name_norm, item.unit.lower().strip())
        if key in merged:
            existing = merged[key]
            merged[key] = existing.model_copy(update={
                "quantity": existing.quantity + item.quantity,
                "optional": existing.optional and item.optional,  # required if either is required
                "notes": f"{existing.notes or ''}; {item.notes or ''}".strip("; "),
            })
        else:
            merged[key] = item
    return list(merged.values())


# ---------------------------------------------------------------------------
# Mock Data
# ---------------------------------------------------------------------------
def _get_mock_extraction(text: str) -> ExtractionResult:
    """Return a realistic mock extraction for demo/testing."""
    text_lower = text.lower()

    # Detect intent from keywords - check burger first to avoid 'masala' keyword collision
    if any(w in text_lower for w in ["ambiguous", "snacks for guests", "vague"]):
        return ExtractionResult(
            confidence="low",
            clarification_question="What kind of gathering is this? (e.g., sports night, kids birthday, formal dinner)",
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.GENERAL,
                    context_summary="Generic snacks request for guests",
                    items=[]
                )
            ]
        )
    elif any(w in text_lower for w in ["burger", "bun", "patty", "बर्गर", "tikki"]):
        return ExtractionResult(
            servings=4,
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.RECIPE,
                    context_summary="Veggie Burger recipe",
                    items=[
                        ExtractedItem(name="burger buns", quantity=4, unit="piece", category="grains"),
                        ExtractedItem(name="aloo tikki patty", quantity=4, unit="piece", category="snacks"),
                        ExtractedItem(name="cheese slices", quantity=4, unit="piece", category="dairy"),
                        ExtractedItem(name="onion", quantity=2, unit="piece", category="vegetables"),
                        ExtractedItem(name="tomato", quantity=2, unit="piece", category="vegetables"),
                        ExtractedItem(name="lettuce", quantity=1, unit="piece", category="vegetables"),
                        ExtractedItem(name="mayonnaise", quantity=1, unit="pack", category="dairy"),
                        ExtractedItem(name="tomato ketchup", quantity=1, unit="pack", category="spices"),
                    ]
                )
            ]
        )
    elif any(w in text_lower for w in ["sandwich", "sándwich", "सैंडविच", "सेंडविच"]):
        return ExtractionResult(
            servings=4,
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.RECIPE,
                    context_summary="Veg Club Sandwich recipe",
                    items=[
                        ExtractedItem(name="white bread", quantity=1, unit="pack", category="grains"),
                        ExtractedItem(name="mayonnaise", quantity=1, unit="pack", category="dairy"),
                        ExtractedItem(name="tomato ketchup", quantity=1, unit="pack", category="spices"),
                        ExtractedItem(name="cheese slices", quantity=1, unit="pack", category="dairy"),
                        ExtractedItem(name="onion", quantity=2, unit="piece", category="vegetables"),
                        ExtractedItem(name="tomato", quantity=2, unit="piece", category="vegetables"),
                        ExtractedItem(name="green chili", quantity=2, unit="piece", category="vegetables"),
                        ExtractedItem(name="butter", quantity=100, unit="g", category="dairy"),
                    ]
                )
            ]
        )
    elif any(w in text_lower for w in ["tikka", "butter chicken", "मक्खन चिकन", "टिक्का"]):
        return ExtractionResult(
            servings=4,
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.RECIPE,
                    context_summary="Chicken Tikka Masala recipe for 4 people",
                    items=[
                        ExtractedItem(name="chicken", quantity=800, unit="g", category="general"),
                        ExtractedItem(name="onion", quantity=2, unit="piece", category="vegetables"),
                        ExtractedItem(name="tomato", quantity=3, unit="piece", category="vegetables"),
                        ExtractedItem(name="butter", quantity=100, unit="g", category="dairy"),
                        ExtractedItem(name="fresh cream", quantity=100, unit="ml", category="dairy"),
                        ExtractedItem(name="curd", quantity=1, unit="cup", category="dairy"),
                        ExtractedItem(name="ginger", quantity=1, unit="inch", category="vegetables"),
                        ExtractedItem(name="garlic", quantity=6, unit="clove", category="vegetables"),
                        ExtractedItem(name="red chili powder", quantity=2, unit="tsp", category="spices"),
                        ExtractedItem(name="turmeric powder", quantity=1, unit="tsp", category="spices"),
                        ExtractedItem(name="garam masala", quantity=1.5, unit="tsp", category="spices"),
                        ExtractedItem(name="salt", quantity=1, unit="tsp", category="spices"),
                        ExtractedItem(name="cooking oil", quantity=2, unit="tbsp", category="oils"),
                        ExtractedItem(name="coriander leaves bunch", quantity=1, unit="piece", category="vegetables"),
                    ]
                )
            ]
        )
    elif any(w in text_lower for w in ["biryani", "chicken", "curry", "चिकन", "बिरयानी"]):
        return ExtractionResult(
            servings=4,
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.RECIPE,
                    context_summary="Chicken Biryani recipe for 4 people",
                    items=[
                        ExtractedItem(name="basmati rice", quantity=500, unit="g", category="grains"),
                        ExtractedItem(name="chicken", quantity=750, unit="g", category="general"),
                        ExtractedItem(name="onion", quantity=3, unit="piece", category="vegetables"),
                        ExtractedItem(name="tomato", quantity=2, unit="piece", category="vegetables"),
                        ExtractedItem(name="curd", quantity=1, unit="cup", category="dairy"),
                        ExtractedItem(name="ghee", quantity=4, unit="tbsp", category="dairy"),
                        ExtractedItem(name="turmeric powder", quantity=1, unit="tsp", category="spices"),
                        ExtractedItem(name="red chili powder", quantity=2, unit="tsp", category="spices"),
                        ExtractedItem(name="biryani masala", quantity=1, unit="tbsp", category="spices"),
                        ExtractedItem(name="garam masala", quantity=1, unit="tsp", category="spices"),
                        ExtractedItem(name="salt", quantity=1, unit="tsp", category="spices"),
                        ExtractedItem(name="green chili", quantity=4, unit="piece", category="vegetables"),
                        ExtractedItem(name="ginger", quantity=1, unit="inch", category="vegetables"),
                        ExtractedItem(name="garlic", quantity=8, unit="clove", category="vegetables"),
                        ExtractedItem(name="cooking oil", quantity=2, unit="tbsp", category="oils"),
                    ]
                )
            ]
        )
    elif any(w in text_lower for w in ["party", "chips", "cold drink", "snack", "popcorn"]):
        return ExtractionResult(
            servings=6,
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.GENERAL,
                    context_summary="Party snacks and drinks for 6 people with Rs.400 budget",
                    items=[
                        ExtractedItem(name="chips", quantity=3, unit="pack", category="snacks"),
                        ExtractedItem(name="cold drink", quantity=3, unit="bottle", category="beverages"),
                        ExtractedItem(name="popcorn", quantity=2, unit="pack", category="snacks"),
                        ExtractedItem(name="namkeen", quantity=1, unit="pack", category="snacks", optional=True),
                    ]
                )
            ]
        )
    elif any(w in text_lower for w in ["notebook", "pencil", "pen", "school", "stationery"]):
        return ExtractionResult(
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.SUPPLIES,
                    context_summary="School supplies list for new session",
                    items=[
                        ExtractedItem(name="notebook", quantity=5, unit="piece", category="stationery"),
                        ExtractedItem(name="pencil", quantity=1, unit="pack", category="stationery"),
                        ExtractedItem(name="pen", quantity=1, unit="pack", category="stationery"),
                        ExtractedItem(name="eraser", quantity=1, unit="pack", category="stationery"),
                        ExtractedItem(name="sharpener", quantity=1, unit="pack", category="stationery"),
                        ExtractedItem(name="geometry box", quantity=1, unit="piece", category="stationery"),
                        ExtractedItem(name="colored pencils", quantity=1, unit="pack", category="stationery"),
                    ]
                )
            ]
        )
    elif any(w in text_lower for w in ["fix", "tap", "plumb", "wrench", "screw", "repair"]):
        return ExtractionResult(
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.DIY,
                    context_summary="Fix a leaky tap - plumbing supplies needed",
                    items=[
                        ExtractedItem(name="adjustable wrench", quantity=1, unit="piece", category="tools_hardware"),
                        ExtractedItem(name="ptfe tape", quantity=1, unit="piece", category="tools_hardware"),
                        ExtractedItem(name="screwdriver set", quantity=1, unit="piece", category="tools_hardware"),
                    ]
                )
            ]
        )
    else:
        return ExtractionResult(
            intents=[
                ExtractedIntent(
                    intent_type=IntentType.GENERAL,
                    context_summary="General shopping list",
                    items=[
                        ExtractedItem(name="rice", quantity=1, unit="kg", category="grains"),
                        ExtractedItem(name="onion", quantity=1, unit="kg", category="vegetables"),
                        ExtractedItem(name="salt", quantity=1, unit="pack", category="spices"),
                    ]
                )
            ]
        )
