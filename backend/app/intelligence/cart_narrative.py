"""
Cart Narrative — generates a 3-sentence decision rationale explaining WHY
items were chosen, substituted, or omitted. Different from the cart summary
which just describes WHAT is in the cart.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Optional

from app.config import MOCK_MODE, GEMINI_MODEL_ID, LLM_PROVIDER, BEDROCK_MODEL_ID

logger = logging.getLogger(__name__)

NARRATIVE_SYSTEM_PROMPT = """You are an intelligent shopping assistant explaining your reasoning.
Given a resolved shopping cart, generate exactly 3 SHORT sentences explaining:

1. Your overall strategy for building this cart (what drove item selection — occasion, preferences, budget)
2. Any trade-offs you made (substitutions, brand swaps, budget cuts) and WHY
3. What the customer should know (savings achieved, anything unavailable, confidence)

Rules:
- Be conversational and warm, like a friend explaining their picks
- Use Indian Rupee (₹) for prices
- Reference specific brands/items by name when explaining swaps
- Keep it to EXACTLY 3 sentences, no more
- Do NOT use bullet points or lists — just flowing sentences
- If budget was a constraint, mention how you handled it"""


def generate_cart_narrative(
    cart_items: list[dict],
    unavailable_items: list[dict],
    total_price: float,
    budget: float | None = None,
    budget_exceeded: bool = False,
    context_summary: str = "",
    dietary_pref: str | None = None,
    mock_mode: Optional[bool] = None,
) -> str:
    """
    Generate a 3-sentence decision narrative for the cart.
    Returns the narrative string.
    """
    is_mock = mock_mode if mock_mode is not None else MOCK_MODE
    if is_mock:
        return _get_mock_narrative(cart_items, unavailable_items, total_price, budget)

    # Build context for the LLM
    substituted = [i for i in cart_items if i.get("substituted")]
    brands_used = list({i.get("brand", "") for i in cart_items if i.get("brand")})
    
    cart_context = {
        "context": context_summary,
        "total_items": len(cart_items),
        "total_price_inr": total_price,
        "budget_inr": budget,
        "budget_exceeded": budget_exceeded,
        "dietary_preference": dietary_pref,
        "brands_used": brands_used[:10],
        "substitutions": [
            {
                "item": i.get("name"),
                "brand": i.get("brand"),
                "reason": i.get("substitution_reason", ""),
            }
            for i in substituted[:5]
        ],
        "unavailable": [
            {"item": i.get("name"), "reason": i.get("reason", "")}
            for i in unavailable_items[:5]
        ],
        "savings": (budget - total_price) if budget and total_price < budget else 0,
    }

    user_prompt = f"Explain your reasoning for this cart:\n{json.dumps(cart_context, indent=2)}"

    try:
        if LLM_PROVIDER == "bedrock":
            from app.pipeline.bedrock_client import get_bedrock_client
            client = get_bedrock_client()
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 200,
                "temperature": 0.5,
                "system": NARRATIVE_SYSTEM_PROMPT,
                "messages": [
                    {"role": "user", "content": [{"type": "text", "text": user_prompt}]}
                ],
            }
            response = client.invoke_model(
                modelId=BEDROCK_MODEL_ID,
                body=json.dumps(request_body),
                contentType="application/json",
            )
            response_body = json.loads(response["body"].read())
            narrative = response_body["content"][0]["text"].strip()
        else:
            from app.pipeline.gemini_client import get_gemini_client
            from google.genai import types

            client = get_gemini_client()
            last_error = None
            narrative = ""

            for attempt in range(3):
                try:
                    response = client.models.generate_content(
                        model=GEMINI_MODEL_ID,
                        contents=user_prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=NARRATIVE_SYSTEM_PROMPT,
                            max_output_tokens=200,
                            temperature=0.5,
                        ),
                    )
                    narrative = response.text.strip() if response.text else ""
                    break
                except Exception as retry_err:
                    last_error = retry_err
                    err_str = str(retry_err)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        wait_time = (attempt + 1) * 8
                        logger.warning(
                            f"Gemini rate limited (attempt {attempt+1}/3), waiting {wait_time}s..."
                        )
                        time.sleep(wait_time)
                    else:
                        raise
            else:
                # Final fallback model
                response = client.models.generate_content(
                    model="gemini-2.5-flash-lite",
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=NARRATIVE_SYSTEM_PROMPT,
                        max_output_tokens=200,
                        temperature=0.5,
                    ),
                )
                narrative = response.text.strip() if response.text else ""

        if not narrative:
            return _get_mock_narrative(cart_items, unavailable_items, total_price, budget)

        # Ensure it ends cleanly
        if narrative and narrative[-1] not in ".!?":
            narrative += "."

        return narrative

    except Exception as e:
        logger.error(f"Cart narrative generation failed: {e}")
        return _get_mock_narrative(cart_items, unavailable_items, total_price, budget)


def _get_mock_narrative(
    cart_items: list[dict],
    unavailable_items: list[dict],
    total_price: float,
    budget: float | None,
) -> str:
    """Generate a deterministic mock narrative without calling any LLM."""
    substituted = [i for i in cart_items if i.get("substituted")]
    brands = list({i.get("brand", "") for i in cart_items if i.get("brand")})

    parts = []

    # Sentence 1: strategy
    if budget:
        parts.append(
            f"I built this cart around your ₹{int(budget)} budget, "
            f"prioritizing value picks across {len(brands)} brands to cover all {len(cart_items)} items."
        )
    else:
        parts.append(
            f"I matched {len(cart_items)} items from {len(brands)} brands, "
            f"focusing on best-fit products from our catalog."
        )

    # Sentence 2: trade-offs
    if substituted:
        first_sub = substituted[0]
        reason = first_sub.get("substitution_reason", "better value")
        parts.append(
            f"I swapped {len(substituted)} item{'s' if len(substituted) > 1 else ''} — "
            f"for example, {first_sub.get('name', 'an item')} was picked because {reason}."
        )
    else:
        parts.append("No substitutions were needed — all items matched directly from the catalog.")

    # Sentence 3: result
    if budget and total_price <= budget:
        savings = int(budget - total_price)
        parts.append(f"Your cart totals ₹{int(total_price)}, saving you ₹{savings} under budget.")
    elif unavailable_items:
        names = ", ".join(i.get("name", "?") for i in unavailable_items[:2])
        parts.append(
            f"Total comes to ₹{int(total_price)}; {names} couldn't be found in our current catalog."
        )
    else:
        parts.append(f"Everything looks good — ₹{int(total_price)} total, all items in stock.")

    return " ".join(parts)
