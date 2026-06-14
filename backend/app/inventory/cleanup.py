"""Background task to clean up expired reservations."""

import logging
from app.inventory.reservations import cleanup_expired_reservations as cleanup_func

logger = logging.getLogger(__name__)

def cleanup_expired_reservations():
    """
    Release expired reservations.
    """
    try:
        cleanup_func(mock_mode=True)
    except Exception as e:
        logger.error(f"Error during reservation cleanup: {e}")
