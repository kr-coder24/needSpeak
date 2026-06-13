"""
Gemini Vision — Prescription OCR
Extracts medicine names and dosages from a prescription image/PDF.
Adds validation tags to prevent auto-substitution.
"""

import base64
import logging

from app.pipeline.gemini_client import get_gemini_client
from app import config

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024

def extract_text_from_prescription(file_bytes: bytes, mime_type: str) -> str:
    """
    Use Gemini Vision to extract medicines from a prescription.
    
    Args:
        file_bytes: Raw bytes of the uploaded image/PDF.
        mime_type: MIME type of the file.

    Returns:
        A comma-separated list of extracted medicines with dosages and the phrase
        [requires validation] appended to each item to signal to the extractor.
    """
    if not file_bytes:
        raise ValueError("Empty file — no data received.")

    if len(file_bytes) > MAX_FILE_BYTES:
        raise ValueError(f"File is too large. Maximum allowed size is {MAX_FILE_BYTES // (1024*1024)} MB.")

    logger.info(f"[prescription_input] Sending {len(file_bytes)} bytes to Gemini")

    client = get_gemini_client()
    encoded = base64.b64encode(file_bytes).decode("utf-8")

    response = client.models.generate_content(
        model=config.GEMINI_MODEL_ID,
        contents=[
            {
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": mime_type, "data": encoded}},
                    {
                        "text": (
                            "Carefully read this medical prescription. "
                            "Extract all medicine names, strengths, and dosages. "
                            "Do not include patient or doctor details in the list. "
                            "Return the medicines as a simple comma-separated list, and append "
                            "exactly '[requires validation]' to the end of each medicine name.\n"
                            "Example: Paracetamol 500mg tablet [requires validation], "
                            "Amoxicillin 250mg capsule [requires validation]\n\n"
                            "If there are no medicines, respond exactly: NO_ITEMS_FOUND"
                        )
                    },
                ],
            }
        ],
    )

    result = response.text.strip() if response.text else ""
    logger.info(f"[prescription_input] Result: '{result[:200]}...'")

    if not result or result.upper() == "NO_ITEMS_FOUND":
        return ""

    return result
