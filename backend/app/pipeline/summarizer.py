"""
Bedrock Stage 3 — Generate plain English summary of the resolved cart.

This is the last pipeline stage, implemented after Stages 1 and 2 are working.
Makes one Bedrock call to produce a 2-3 sentence human-readable summary.
"""

from __future__ import annotations

import json
import logging
from typing import Optional


from app.config import AWS_REGION, BEDROCK_MODEL_ID, MOCK_MODE, GEMINI_MODEL_ID, LLM_PROVIDER
from app.models import IntentGroup, CartItem, UnavailableItem
from app.pipeline.bedrock_client import get_bedrock_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Summary Generation
# ---------------------------------------------------------------------------
SUMMARY_SYSTEM_PROMPT = """You are a helpful shopping assistant. Given a resolved shopping cart (which may contain multiple distinct intents or groups), \
generate a brief 2-3 sentence summary in plain English that tells the user:
1. What was found and added to cart
2. Any substitutions made and why
3. Any items that weren't available

Be concise, friendly, and helpful. Use Indian Rupee (Rs.) for prices. Do not use markdown or special formatting."""


def generate_summary(
    intent_groups: list[IntentGroup],
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
        return _get_mock_summary(intent_groups, total_price)

    # Build the context for Bedrock
    cart_summary = {
        "intent_groups": [
            {
                "intent": g.intent_type.value,
                "context": g.context_summary,
                "items_found": len(g.cart),
                "items_unavailable": len(g.unavailable_items),
                "substitutions": [
                    {"name": i.name, "brand": i.brand, "reason": i.substitution_reason}
                    for i in g.cart if i.substituted
                ],
                "unavailable": [
                    {"name": i.name, "reason": i.reason.value}
                    for i in g.unavailable_items
                ],
            }
            for g in intent_groups
        ],
        "total_price_inr": total_price,
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
            from app.pipeline.gemini_client import get_gemini_client
            from google.genai import types
            import time
            client = get_gemini_client()
            last_error = None
            for attempt in range(3):
                try:
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
                    break
                except Exception as retry_err:
                    last_error = retry_err
                    err_str = str(retry_err)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        wait_time = (attempt + 1) * 10
                        logger.warning(f"Gemini rate limited (attempt {attempt+1}/3), waiting {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        raise
            else:
                logger.info("Attempting Gemini call with model=gemini-2.5-flash-lite (fallback)...")
                response = client.models.generate_content(
                    model="gemini-2.5-flash-lite",
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SUMMARY_SYSTEM_PROMPT,
                        max_output_tokens=256,
                        temperature=0.4,
                    )
                )
                summary = response.text.strip() if response.text else ""
                logger.info("Gemini call succeeded with model=gemini-2.5-flash-lite")
        
        # Validate summary is complete and not truncated
        if not summary:
            logger.warning("Summary generation returned empty string, using fallback")
            return _generate_fallback_summary(intent_groups, total_price)

        # Check if summary looks incomplete (ends mid-sentence without punctuation)
        if summary and summary[-1] not in '.!?':
            logger.warning(f"Summary appears incomplete (no ending punctuation): {summary[:100]}")
            summary += "."  # Add period to complete it

        logger.info(f"Summary generated: {summary[:100]}...")
        return summary

    except Exception as e:
        logger.error(f"Summary generation failed: {e}", exc_info=True)
        # Fallback: generate a basic summary without LLM
        return _generate_fallback_summary(intent_groups, total_price)


def _generate_fallback_summary(
    intent_groups: list[IntentGroup],
    total_price: float,
) -> str:
    """Generate a basic summary without Bedrock (fallback)."""
    total_items = sum(len(g.cart) for g in intent_groups)
    
    if not intent_groups or total_items == 0:
        return "No items were found for your request."
    
    parts = [f"Found {total_items} item{'s' if total_items != 1 else ''} totaling ₹{total_price:.0f}."]

    sub_count = sum(1 for g in intent_groups for i in g.cart if i.substituted)
    if sub_count:
        parts.append(f"{sub_count} item{'s were' if sub_count != 1 else ' was'} substituted with budget-friendly alternatives.")

    all_unavailable = [i for g in intent_groups for i in g.unavailable_items]
    if all_unavailable:
        names = ", ".join(i.name for i in all_unavailable[:3])
        if len(all_unavailable) > 3:
            names += f" and {len(all_unavailable) - 3} more"
        parts.append(f"{names} could not be found in our catalog.")

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Mock Summary
# ---------------------------------------------------------------------------
def _get_mock_summary(
    intent_groups: list[IntentGroup],
    total_price: float,
) -> str:
    """Generate a realistic mock summary."""
    total_items = sum(len(g.cart) for g in intent_groups)
    
    if not intent_groups or total_items == 0:
        return "No items were found for your request."
        
    contexts = [g.context_summary.lower() for g in intent_groups if g.context_summary]
    context_str = " and ".join(contexts) if contexts else "your request"
    
    parts = [f"I found {total_items} item{'s' if total_items != 1 else ''} for {context_str}, totaling ₹{total_price:.0f}."]

    sub_count = sum(1 for g in intent_groups for i in g.cart if i.substituted)
    if sub_count:
        parts.append(f"{sub_count} item{'s were' if sub_count != 1 else ' was'} swapped for more affordable alternatives.")

    all_unavailable = [i for g in intent_groups for i in g.unavailable_items]
    if all_unavailable:
        names = ", ".join(i.name for i in all_unavailable[:2])
        parts.append(f"{names} {'are' if len(all_unavailable) > 1 else 'is'} not currently available.")

    return " ".join(parts)
