import io
import logging
from pypdf import PdfReader

logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract all readable text from a PDF document using pypdf.
    """
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        extracted_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
        
        return extracted_text.strip()
    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {e}")
        return ""
