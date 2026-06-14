"""
Event Logger — Records user behavior events for preference engine and analytics.
"""
import logging
from datetime import datetime, timezone
import uuid

from app.db.dynamo import save_event

logger = logging.getLogger(__name__)

def log_event(
    user_id: str,
    event_type: str,
    sku: str = "",
    session_id: str = "",
    intent_type: str = "",
    query_text: str = "",
    rank_position: int = -1,
    price_inr: float = 0.0,
    category: str = "",
    context: str = "",
    mock_mode: bool | None = None,
) -> None:
    """
    Log a behavior event to DynamoDB.
    Event types: impression, click, add_to_cart, remove_from_cart,
    substitution_shown, substitution_accept, substitution_reject,
    purchase, search, dislike
    """
    if not user_id:
        return

    now = datetime.now(timezone.utc)
    event_id = str(uuid.uuid4())
    # Sort key format: YYYY-MM-DDTHH:MM:SS_UUID to ensure chronological sorting
    sort_key = f"{now.isoformat()}_{event_id}"

    event_data = {
        "user_id": user_id,
        "event_ts_event_id": sort_key,
        "event_type": event_type,
        "sku": sku,
        "session_id": session_id,
        "intent_type": intent_type,
        "query_text": query_text,
        "rank_position": rank_position,
        "price_inr": price_inr,
        "category": category,
        "context": context,
        "created_at": now.isoformat()
    }

    try:
        save_event(event_data, mock_mode=mock_mode)
        logger.debug(f"Logged event {event_type} for user {user_id} on SKU {sku}")
    except Exception as e:
        logger.error(f"Failed to log event {event_type}: {e}")
