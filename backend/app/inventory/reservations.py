import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
from app.db.dynamo import load_all_products

logger = logging.getLogger(__name__)

# Global in-memory store for simulated demo reservations
_fake_reservations: Dict[str, dict] = {}

def reserve_items(
    session_id: str,
    items: List[Dict[str, int]],
    mock_mode: bool = False,
    idempotency_key: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Tuple[bool, List[str], Optional[str], dict]:
    """Reserve inventory for cart items (Simulated Demo)."""
    reservation_id = f"res_{session_id}"
    
    if not items:
        metadata = {
            "reserved_items": [],
            "failed_items": [],
            "total_amount": 0.0,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
            "message": "No items to reserve"
        }
        return True, [], reservation_id, metadata

    try:
        catalog = load_all_products()
        products_map = {p["sku"]: p for p in catalog}
    except Exception as e:
        logger.error(f"Simulated reservation failed to load catalog: {e}")
        products_map = {}
        
    reserved_items = []
    total_amount = 0.0
    
    for item in items:
        sku = item["sku"]
        qty = item["qty"]
        product = products_map.get(sku, {})
        price = float(product.get("price_inr", 100.0))
        name = product.get("name", f"Mock Product {sku}")
        
        item_total = price * qty
        reserved_items.append({
            "sku": sku,
            "name": name,
            "qty": qty,
            "price_per_unit": price,
            "total": item_total,
        })
        total_amount += item_total
        
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    
    res_data = {
        "reservation_id": reservation_id,
        "status": "reserved",
        "reserved_items": reserved_items,
        "failed_items": [],
        "total_amount": total_amount,
        "expires_at": expires_at,
        "message": f"Successfully reserved {len(reserved_items)} item(s) (Simulated)",
    }
    
    _fake_reservations[reservation_id] = {
        "status": "reserved",
        "total_amount": total_amount,
        "reserved_items": reserved_items,
        "failed_items": [],
        "expires_at": expires_at,
        "message": f"Successfully reserved {len(reserved_items)} item(s) (Simulated)",
        "metadata": res_data.copy()
    }
    
    return True, [], reservation_id, res_data


def get_reservation_metadata(reservation_id: str) -> Optional[dict]:
    """Get reservation metadata (for mock mode tracking)."""
    reservation = _fake_reservations.get(reservation_id)
    if not reservation:
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        fallback_res_data = {
            "reservation_id": reservation_id,
            "status": "reserved",
            "reserved_items": [
                {"sku": "SKU-MILK", "name": "Organic Milk 2L", "qty": 1, "price_per_unit": 120.0, "total": 120.0},
                {"sku": "SKU-BREAD", "name": "Whole Wheat Bread 400g", "qty": 2, "price_per_unit": 89.5, "total": 179.0}
            ],
            "failed_items": [],
            "total_amount": 299.0,
            "expires_at": expires_at,
            "message": "Simulated fallback reservation"
        }
        reservation = {
            "status": "reserved",
            "total_amount": 299.0,
            "reserved_items": fallback_res_data["reserved_items"],
            "failed_items": [],
            "expires_at": expires_at,
            "message": "Simulated fallback reservation",
            "metadata": fallback_res_data
        }
        _fake_reservations[reservation_id] = reservation
    return reservation


def release_reservation(
    reservation_id: str,
    items: List[Dict[str, int]],
    mock_mode: bool = False
) -> bool:
    """Release/cancel a reservation."""
    if reservation_id in _fake_reservations:
        _fake_reservations[reservation_id]["status"] = "released"
        if "metadata" in _fake_reservations[reservation_id]:
            _fake_reservations[reservation_id]["metadata"]["status"] = "released"
    return True


def commit_reservation(
    reservation_id: str,
    items: List[Dict[str, int]],
    mock_mode: bool = False
) -> bool:
    """Mark reservation as committed (payment successful)."""
    if reservation_id in _fake_reservations:
        _fake_reservations[reservation_id]["status"] = "committed"
        if "metadata" in _fake_reservations[reservation_id]:
            _fake_reservations[reservation_id]["metadata"]["status"] = "committed"
    return True


def cleanup_expired_reservations(mock_mode: bool = False):
    """Cleanup expired reservations (no-op for simulated mock)."""
    pass
