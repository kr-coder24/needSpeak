"""
Gemini Vision image OCR — Member 2, Feature 1.
Extracts shopping items / ingredients from an uploaded image
using Gemini's multimodal (vision) capabilities.
"""

import base64
import logging

from app.pipeline.gemini_client import get_gemini_client
from app import config

logger = logging.getLogger(__name__)

# Maximum image size: 10 MB
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# Supported MIME types for Gemini Vision
SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
}


def extract_text_from_image(image_bytes: bytes, mime_type: str) -> str:
    """
    Use Gemini Vision to extract shopping items from an image.

    Handles:
    - Photos of handwritten shopping lists
    - Screenshots of recipes / ingredient lists
    - Photos of fridge / pantry contents (what's needed)
    - Photos of WhatsApp forwarded messages

    Args:
        image_bytes: Raw bytes of the uploaded image.
        mime_type: MIME type of the image (e.g. "image/jpeg").

    Returns:
        A comma-separated list of extracted items with approximate quantities.

    Raises:
        ValueError: If the image is too small, too large, or unsupported type.
    """
    # ── Validation ──────────────────────────────────────────────────────
    if not image_bytes:
        raise ValueError("Empty image — no data received.")

    if len(image_bytes) < 500:
        raise ValueError(
            "Image is too small (possibly corrupt). Please upload a valid image."
        )

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError(
            f"Image is too large ({len(image_bytes) / (1024*1024):.1f} MB). "
            f"Maximum allowed size is {MAX_IMAGE_BYTES // (1024*1024)} MB."
        )

    # Normalize MIME type
    normalized_mime = (mime_type or "image/jpeg").lower().strip()
    if normalized_mime not in SUPPORTED_MIME_TYPES:
        # Be lenient — default to jpeg if something weird shows up
        logger.warning(
            f"Unsupported MIME type '{normalized_mime}', defaulting to image/jpeg"
        )
        normalized_mime = "image/jpeg"

    # ── Gemini Vision call ──────────────────────────────────────────────
    logger.info(
        f"[image_input] Sending {len(image_bytes)} bytes ({normalized_mime}) to Gemini Vision"
    )

    client = get_gemini_client()
    from google.genai import types

    response = client.models.generate_content(
        model=config.GEMINI_MODEL_ID,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=normalized_mime),
            (
                "Look at this image carefully. Extract ALL food items, "
                "ingredients, groceries, or shopping items you can see. "
                "Include approximate quantities if visible (e.g. '2 kg rice', "
                "'500g chicken'). If the image shows a handwritten list, "
                "transcribe every item. If it shows food products or a "
                "recipe, list every ingredient.\n\n"
                "Return them as a simple comma-separated list.\n"
                "Example: milk 2L, basmati rice 1kg, onions 500g, "
                "chicken breast 1kg, tomatoes 6 pieces\n\n"
                "If the image does not contain any food items or shopping "
                "items, respond with exactly: NO_ITEMS_FOUND"
            )
        ],
    )

    result = response.text.strip() if response.text else ""
    logger.info(f"[image_input] Gemini Vision result: '{result[:200]}...'")

    # Handle no-items case
    if not result or result.upper() == "NO_ITEMS_FOUND":
        return ""

    return result
