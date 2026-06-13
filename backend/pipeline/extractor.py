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

from config import AWS_REGION, BEDROCK_MODEL_ID, MOCK_MODE
from models import ExtractionResult, ExtractedItem, IntentType

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bedrock Client (singleton)
# ---------------------------------------------------------------------------
_bedrock_client = None


def _get_bedrock():
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    return _bedrock_client


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a shopping list extractor. You receive text that may be a recipe, \
DIY instructions, a supplies list, a medical note, or a general shopping request. \
Your job is to extract every item that needs to be purchased.

RULES:
1. Output ONLY valid JSON. No prose, no markdown fences, no explanation, no preamble.
2. If the input contains no shoppable items, return: {"items": [], "error": "no_shoppable_content"}
3. Never invent quantities not implied by the text. If no quantity is stated, use reasonable defaults (e.g., 1 for countable items, 100g for small amounts).
4. Normalize units to: g, ml, piece, pack, cup, tbsp, tsp, clove, bunch, kg, litre. Use the most natural unit for the item.
5. For recipes, estimate quantities for the stated number of servings.
6. Classify intent_type as exactly one of: recipe, diy, supplies, medical, general
7. The context_summary should be one sentence describing what the user is trying to do.
8. Understand Hindi, Hinglish, and Indian English — many inputs will use these.
9. For budget-constrained requests, extract the budget but still list all items normally.
10. If the text mentions servings/people, set the servings field accordingly."""

USER_PROMPT_TEMPLATE = """Extract the shopping list from this text.{servings_instruction}

TEXT:
{input_text}

Respond with JSON matching this exact schema:
{{
  "intent_type": "recipe|diy|supplies|medical|general",
  "context_summary": "one sentence summary",
  "servings": null or number,
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
def _call_bedrock(system_prompt: str, user_prompt: str) -> str:
    """Invoke Bedrock with the given prompts, return raw text response."""
    client = _get_bedrock()

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


def extract_items(
    text: str,
    servings_override: Optional[int] = None,
) -> ExtractionResult:
    """
    Stage 1: Extract a structured shopping list from raw text.

    Args:
        text: Raw input text (recipe, list, message, etc.)
        servings_override: Optional serving count to scale quantities to

    Returns:
        ExtractionResult with parsed items
    """
    if MOCK_MODE:
        return _get_mock_extraction(text)

    # Build user prompt
    servings_instruction = ""
    if servings_override:
        servings_instruction = f"\n\nIMPORTANT: Scale all quantities to {servings_override} servings."

    user_prompt = USER_PROMPT_TEMPLATE.format(
        servings_instruction=servings_instruction,
        input_text=text,
    )

    # First attempt
    logger.info("Calling Bedrock for extraction (attempt 1)...")
    try:
        raw_response = _call_bedrock(SYSTEM_PROMPT, user_prompt)
    except Exception as e:
        logger.error(f"Bedrock call failed: {e}")
        return ExtractionResult(error="bedrock_timeout")

    parsed = _sanitize_json_response(raw_response)

    # Retry once with stricter prompt if parse failed
    if parsed is None:
        logger.warning("First extraction attempt returned invalid JSON. Retrying with stricter prompt...")
        strict_prompt = (
            "You MUST respond with ONLY a JSON object. No other text before or after. "
            "No markdown fences. Just the raw JSON.\n\n" + user_prompt
        )
        try:
            raw_response = _call_bedrock(SYSTEM_PROMPT, strict_prompt)
        except Exception as e:
            logger.error(f"Bedrock retry failed: {e}")
            return ExtractionResult(error="extraction_failed")

        parsed = _sanitize_json_response(raw_response)

        if parsed is None:
            logger.error("Second extraction attempt also failed. Returning error.")
            return ExtractionResult(error="extraction_failed")

    # Check for no_shoppable_content
    if parsed.get("error") == "no_shoppable_content":
        return ExtractionResult(items=[], error="no_shoppable_content")

    # Parse items
    items = []
    for raw_item in parsed.get("items", []):
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

    # Map intent type
    intent_str = parsed.get("intent_type", "general").lower()
    try:
        intent_type = IntentType(intent_str)
    except ValueError:
        intent_type = IntentType.GENERAL

    return ExtractionResult(
        intent_type=intent_type,
        context_summary=parsed.get("context_summary", ""),
        servings=parsed.get("servings"),
        items=items,
    )


# ---------------------------------------------------------------------------
# Mock Data
# ---------------------------------------------------------------------------
def _get_mock_extraction(text: str) -> ExtractionResult:
    """Return a realistic mock extraction for demo/testing."""
    text_lower = text.lower()

    # Detect intent from keywords
    if any(w in text_lower for w in ["recipe", "biryani", "cook", "chicken", "masala", "curry"]):
        return ExtractionResult(
            intent_type=IntentType.RECIPE,
            context_summary="Chicken Biryani recipe for 4 people",
            servings=4,
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
            ],
        )
    elif any(w in text_lower for w in ["party", "chips", "cold drink", "snack", "popcorn"]):
        return ExtractionResult(
            intent_type=IntentType.GENERAL,
            context_summary="Party snacks and drinks for 6 people with Rs.400 budget",
            servings=6,
            items=[
                ExtractedItem(name="chips", quantity=3, unit="pack", category="snacks"),
                ExtractedItem(name="cold drink", quantity=3, unit="bottle", category="beverages"),
                ExtractedItem(name="popcorn", quantity=2, unit="pack", category="snacks"),
                ExtractedItem(name="namkeen", quantity=1, unit="pack", category="snacks", optional=True),
            ],
        )
    elif any(w in text_lower for w in ["notebook", "pencil", "pen", "school", "stationery"]):
        return ExtractionResult(
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
            ],
        )
    elif any(w in text_lower for w in ["fix", "tap", "plumb", "wrench", "screw", "repair"]):
        return ExtractionResult(
            intent_type=IntentType.DIY,
            context_summary="Fix a leaky tap - plumbing supplies needed",
            items=[
                ExtractedItem(name="adjustable wrench", quantity=1, unit="piece", category="tools_hardware"),
                ExtractedItem(name="ptfe tape", quantity=1, unit="piece", category="tools_hardware"),
                ExtractedItem(name="screwdriver set", quantity=1, unit="piece", category="tools_hardware"),
            ],
        )
    else:
        return ExtractionResult(
            intent_type=IntentType.GENERAL,
            context_summary="General shopping list",
            items=[
                ExtractedItem(name="rice", quantity=1, unit="kg", category="grains"),
                ExtractedItem(name="onion", quantity=1, unit="kg", category="vegetables"),
                ExtractedItem(name="salt", quantity=1, unit="pack", category="spices"),
            ],
        )
