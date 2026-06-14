"""Background task to clean up expired reservations."""

import logging
from datetime import datetime, timezone
from app.inventory.reservations import _reservations

logger = logging.getLogger(__name__)

def cleanup_expired_reservations():
    """Release expired reservations (run periodically via scheduler)."""
    now = datetime.now(timezone.utc)
    expired_count = 0
    
    for res_id, res_data in list(_reservations.items()):
        if res_data["status"] != "reserved":
            continue
        
        expires_at = datetime.fromisoformat(res_data["expires_at"])
        if now > expires_at:
            res_data["status"] = "expired"
            expired_count += 1
            logger.info(f"Auto-expired reservation {res_id}")
    
    if expired_count > 0:
        logger.info(f"Cleaned up {expired_count} expired reservations")
    
    return expired_count
