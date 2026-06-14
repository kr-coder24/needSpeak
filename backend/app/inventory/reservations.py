"""Inventory reservation with conditional updates."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.db.dynamo import get_all_products

logger = logging.getLogger(__name__)

# In-memory reservation store (use DynamoDB in production)
_reservations: dict[str, dict] = {}

def reserve_items(
    items: list[dict],  # [{"sku": "SKU-001", "qty": 2, "location_id": "DEFAULT"}]
    session_id: str,
    user_id: str | None = None,
    idempotency_key: str | None = None,
    mock_mode: bool = False,
) -> dict:
    """
    Reserve inventory items with conditional updates.
    
    Returns:
        {
            "reservation_id": "res_xxx",
            "status": "reserved" | "partial_failed" | "failed",
            "reserved_items": [...],
            "failed_items": [...],
            "total_amount": 1234.5,
            "expires_at": "2026-06-14T12:00:00Z",
            "message": "..."
        }
    """
    
    # Check idempotency
    if idempotency_key:
        for res_id, res_data in _reservations.items():
            if res_data.get("idempotency_key") == idempotency_key:
                logger.info(f"Idempotent request detected: {idempotency_key}")
                return _format_reservation_response(res_id, res_data)
    
    reservation_id = f"res_{uuid.uuid4().hex[:12]}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    products = {p["sku"]: p for p in get_all_products()}
    reserved_items = []
    failed_items = []
    total_amount = 0.0
    
    for item in items:
        sku = item["sku"]
        qty = item["qty"]
        location_id = item.get("location_id", "DEFAULT")
        
        product = products.get(sku)
        if not product:
            failed_items.append({
                "sku": sku,
                "reason": "product_not_found",
                "message": f"SKU {sku} not found in catalog",
            })
            continue
        
        # Check stock (mock: assume in_stock = True means available)
        if not product.get("in_stock", True):
            failed_items.append({
                "sku": sku,
                "reason": "out_of_stock",
                "message": f"{product['name']} is currently out of stock",
                "alternatives": [],  # TODO: suggest alternatives
            })
            continue
        
        # Reserve successfully
        price = float(product.get("price_inr", 0))
        item_total = price * qty
        reserved_items.append({
            "sku": sku,
            "name": product["name"],
            "qty": qty,
            "price_per_unit": price,
            "total": item_total,
            "location_id": location_id,
        })
        total_amount += item_total
    
    # Determine status
    if not reserved_items:
        status = "failed"
        message = "All items failed to reserve"
    elif failed_items:
        status = "partial_failed"
        message = f"{len(reserved_items)} items reserved, {len(failed_items)} failed"
    else:
        status = "reserved"
        message = f"Successfully reserved {len(reserved_items)} items"
    
    # Store reservation
    _reservations[reservation_id] = {
        "reservation_id": reservation_id,
        "session_id": session_id,
        "user_id": user_id,
        "status": status,
        "reserved_items": reserved_items,
        "failed_items": failed_items,
        "total_amount": total_amount,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "idempotency_key": idempotency_key,
    }
    
    return _format_reservation_response(reservation_id, _reservations[reservation_id])


def _format_reservation_response(reservation_id: str, res_data: dict) -> dict:
    return {
        "reservation_id": reservation_id,
        "status": res_data["status"],
        "reserved_items": res_data["reserved_items"],
        "failed_items": res_data["failed_items"],
        "total_amount": res_data["total_amount"],
        "expires_at": res_data["expires_at"],
        "message": res_data.get("message", ""),
    }


def get_reservation(reservation_id: str) -> Optional[dict]:
    """Retrieve reservation by ID."""
    return _reservations.get(reservation_id)


def release_reservation(reservation_id: str) -> bool:
    """Release/cancel a reservation."""
    if reservation_id in _reservations:
        _reservations[reservation_id]["status"] = "released"
        logger.info(f"Released reservation {reservation_id}")
        return True
    return False


def commit_reservation(reservation_id: str) -> bool:
    """Mark reservation as committed (payment successful)."""
    if reservation_id in _reservations:
        _reservations[reservation_id]["status"] = "committed"
        logger.info(f"Committed reservation {reservation_id}")
        return True
    return False
