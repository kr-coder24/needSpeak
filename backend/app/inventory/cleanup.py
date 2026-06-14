"""Background task to clean up expired reservations."""

import logging
from datetime import datetime, timezone
from app.config import MOCK_AWS
from app.inventory.reservations import cleanup_expired_reservations as cleanup_func

logger = logging.getLogger(__name__)

def cleanup_expired_reservations():
    """
    Release expired reservations (run periodically via scheduler).
    
    For mock mode: Uses in-memory cleanup.
    For AWS mode: Relies on DynamoDB TTL (this function is a no-op).
    """
    try:
        cleanup_func(mock_mode=MOCK_AWS)
        logger.debug("Reservation cleanup completed")
    except Exception as e:
        logger.error(f"Error during reservation cleanup: {e}")

