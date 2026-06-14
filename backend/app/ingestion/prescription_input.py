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

    prompt_text = (
        "Carefully read this medical prescription. "
        "Extract all medicine names, strengths, and dosages. "
        "Do not include patient or doctor details in the list. "
        "Return the medicines as a simple comma-separated list, and append "
        "exactly '[requires validation]' to the end of each medicine name.\n"
        "Example: Paracetamol 500mg tablet [requires validation], "
        "Amoxicillin 250mg capsule [requires validation]\n\n"
        "If there are no medicines, respond exactly: NO_ITEMS_FOUND"
    )

    if config.LLM_PROVIDER == "bedrock":
        logger.info(f"[prescription_input] Sending {len(file_bytes)} bytes to Bedrock")
        if mime_type == "application/pdf":
            from app.pipeline.bedrock_converse import call_bedrock_document
            result = call_bedrock_document(
                doc_bytes=file_bytes,
                prompt=prompt_text,
                doc_format="pdf",
                doc_name="prescription",
                max_tokens=4096,
                temperature=0.2,
            ).strip()
        else:
            from app.pipeline.bedrock_converse import call_bedrock_vision
            result = call_bedrock_vision(
                image_bytes=file_bytes,
                mime_type=mime_type,
                prompt=prompt_text,
                max_tokens=4096,
                temperature=0.2,
            ).strip()
    else:
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
                        {"text": prompt_text},
                    ],
                }
            ],
        )
        result = response.text.strip() if response.text else ""
    logger.info(f"[prescription_input] Result: '{result[:200]}...'")

    if not result or result.upper() == "NO_ITEMS_FOUND":
        return ""

    return result
