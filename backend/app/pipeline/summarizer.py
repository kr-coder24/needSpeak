"""
Bedrock Stage 3 — Generate plain English summary of the resolved cart.

This is the last pipeline stage, implemented after Stages 1 and 2 are working.
Makes one Bedrock call to produce a 2-3 sentence human-readable summary.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from google import genai
from google.genai import types

from app.config import AWS_REGION, BEDROCK_MODEL_ID, MOCK_MODE, GEMINI_API_KEY, GEMINI_MODEL_ID, LLM_PROVIDER
from app.models import CartItem, UnavailableItem
from app.pipeline.bedrock_client import get_bedrock_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Summary Generation
# ---------------------------------------------------------------------------
SUMMARY_SYSTEM_PROMPT = """You are a helpful shopping assistant. Given a resolved shopping cart, \
generate a brief 2-3 sentence summary in plain English that tells the user:
1. What was found and added to cart
2. Any substitutions made and why
3. Any items that weren't available

Be concise, friendly, and helpful. Use Indian Rupee (Rs.) for prices. Do not use markdown or special formatting."""


def generate_summary(
    cart_items: list[CartItem],
    unavailable_items: list[UnavailableItem],
    context_summary: str,
    total_price: float,
    budget_inr: Optional[int] = None,
    budget_exceeded: bool = False,
    mock_mode: Optional[bool] = None,
) -> str:
    """
    Stage 3: Generate a plain English summary of the cart.

    Returns a 2-3 sentence string.
    """
    is_mock = mock_mode if mock_mode is not None else MOCK_MODE
    if is_mock:
        return _get_mock_summary(cart_items, unavailable_items, context_summary, total_price)

    # Build the context for Bedrock
    substitutions = [i for i in cart_items if i.substituted]
    cart_summary = {
        "context": context_summary,
        "items_found": len(cart_items),
        "items_unavailable": len(unavailable_items),
        "total_price_inr": total_price,
        "substitutions": [
            {"name": i.name, "brand": i.brand, "reason": i.substitution_reason}
            for i in substitutions
        ],
        "unavailable": [
            {"name": i.name, "reason": i.reason.value}
            for i in unavailable_items
        ],
    }

    if budget_inr:
        cart_summary["budget_inr"] = budget_inr
        cart_summary["budget_exceeded"] = budget_exceeded

    user_prompt = f"Summarize this shopping cart result:\n{json.dumps(cart_summary, indent=2)}"

    try:
        if LLM_PROVIDER == "bedrock":
            logger.info("Using Bedrock (Claude) provider for summarization.")
            client = get_bedrock_client()
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 256,
                "temperature": 0.4,
                "system": SUMMARY_SYSTEM_PROMPT,
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
            summary = response_body["content"][0]["text"].strip()
        else:
            logger.info("Using Google Gemini provider for summarization.")
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model=GEMINI_MODEL_ID,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SUMMARY_SYSTEM_PROMPT,
                    max_output_tokens=256,
                    temperature=0.4,
                )
            )
            summary = response.text.strip() if response.text else ""
        logger.info(f"Summary generated: {summary[:80]}...")
        return summary

    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        # Fallback: generate a basic summary without Bedrock
        return _generate_fallback_summary(cart_items, unavailable_items, total_price)


def _generate_fallback_summary(
    cart_items: list[CartItem],
    unavailable_items: list[UnavailableItem],
    total_price: float,
) -> str:
    """Generate a basic summary without Bedrock (fallback)."""
    parts = [f"Found {len(cart_items)} items for your cart, totaling Rs.{total_price:.0f}."]

    substituted = [i for i in cart_items if i.substituted]
    if substituted:
        parts.append(f"{len(substituted)} item(s) were substituted with budget-friendly alternatives.")

    if unavailable_items:
        names = ", ".join(i.name for i in unavailable_items[:3])
        if len(unavailable_items) > 3:
            names += f" and {len(unavailable_items) - 3} more"
        parts.append(f"{names} could not be found in our catalog.")

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Mock Summary
# ---------------------------------------------------------------------------
def _get_mock_summary(
    cart_items: list[CartItem],
    unavailable_items: list[UnavailableItem],
    context_summary: str,
    total_price: float,
) -> str:
    """Generate a realistic mock summary."""
    sub_count = sum(1 for i in cart_items if i.substituted)
    parts = [f"I found {len(cart_items)} of the items you need for {context_summary.lower()}, totaling Rs.{total_price:.0f}."]

    if sub_count:
        parts.append(f"{sub_count} item(s) were swapped for more affordable alternatives to help with your budget.")

    if unavailable_items:
        names = ", ".join(i.name for i in unavailable_items[:2])
        parts.append(f"{names} {'is' if len(unavailable_items) == 1 else 'are'} not currently available in our catalog.")

    return " ".join(parts)
