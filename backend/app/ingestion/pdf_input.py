"""
Gemini Document Understanding — PDF Extraction
Extracts shopping items / ingredients from an uploaded PDF document.
"""

import base64
import logging

from app.pipeline.gemini_client import get_gemini_client
from app import config

logger = logging.getLogger(__name__)

# Maximum PDF size: 20 MB for inline bytes. Larger files might require Files API,
# but for hackathon, we assume inline works up to Gemini's 20MB limit.
MAX_PDF_BYTES = 20 * 1024 * 1024

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Use Gemini to extract shopping items from a PDF document.

    Args:
        pdf_bytes: Raw bytes of the uploaded PDF.

    Returns:
        A comma-separated list of extracted items with approximate quantities.

    Raises:
        ValueError: If the PDF is too large or empty.
    """
    if not pdf_bytes:
        raise ValueError("Empty PDF — no data received.")

    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise ValueError(
            f"PDF is too large ({len(pdf_bytes) / (1024*1024):.1f} MB). "
            f"Maximum allowed size is {MAX_PDF_BYTES // (1024*1024)} MB."
        )

    logger.info(f"[pdf_input] Sending {len(pdf_bytes)} bytes to Gemini Document Understanding")

    client = get_gemini_client()
    encoded = base64.b64encode(pdf_bytes).decode("utf-8")

    response = client.models.generate_content(
        model=config.GEMINI_MODEL_ID,
        contents=[
            {
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": "application/pdf", "data": encoded}},
                    {
                        "text": (
                            "Read this PDF document carefully. Extract ALL food items, "
                            "ingredients, groceries, or shopping items listed. "
                            "Include approximate quantities if specified (e.g. '2 kg rice', "
                            "'500g chicken'). Transcribe every relevant item.\n\n"
                            "Return them as a simple comma-separated list.\n"
                            "Example: milk 2L, basmati rice 1kg, onions 500g, "
                            "chicken breast 1kg, tomatoes 6 pieces\n\n"
                            "If the document does not contain any food items or shopping "
                            "items, respond with exactly: NO_ITEMS_FOUND"
                        )
                    },
                ],
            }
        ],
    )

    result = response.text.strip() if response.text else ""
    logger.info(f"[pdf_input] Gemini PDF result: '{result[:200]}...'")

    if not result or result.upper() == "NO_ITEMS_FOUND":
        return ""

    return result
