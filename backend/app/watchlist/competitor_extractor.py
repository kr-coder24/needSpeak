from __future__ import annotations

import json
import os
import re

from app import config


def _regex_extract(text: str | None) -> tuple[str | None, float | None]:
    if not text:
        return None, None
    source_match = re.search(r"([A-Za-z][A-Za-z0-9 .&-]{1,40})\s*(?:-|:|at|for)?", text)
    price_match = re.search(r"(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)", text, re.IGNORECASE)
    source = source_match.group(1).strip(" -:") if source_match else "Competitor"
    price = float(price_match.group(1).replace(",", "")) if price_match else None
    return source, price


def extract_competitor_price(
    text: str | None = None,
    image_bytes: bytes | None = None,
    mime_type: str | None = None,
) -> tuple[str | None, float | None]:
    if config.MOCK_MODE or not os.getenv("GEMINI_API_KEY"):
        return _regex_extract(text) if text else (None, None)

    try:
        from google import genai
        from google.genai import types

        parts: list = [
            "Extract the marketplace/source and INR price from this competitor listing. Return only JSON: {\"source\":\"...\",\"price_inr\":1234}."
        ]
        if text:
            parts.append(text)
        if image_bytes:
            parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type or "image/png"))

        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        response = client.models.generate_content(
            model=config.GEMINI_MODEL_ID,
            contents=parts,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        data = json.loads(response.text or "{}")
        price = data.get("price_inr")
        return data.get("source") or "Competitor", float(price) if price else None
    except Exception:
        return _regex_extract(text)
