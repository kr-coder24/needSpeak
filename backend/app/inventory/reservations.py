"""
Inventory Reservations — Enhanced Version
Handles reserving, releasing, and committing inventory using DynamoDB transactions.
Includes mock mode fallback for local testing without AWS.

Enhanced from main branch with:
- Better return types (structured response)
- Idempotency support
- Expiry tracking
- Alternative suggestions on failure
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import boto3
from app.config import AWS_REGION, DYNAMODB_TABLE_PRODUCTS, MOCK_AWS
from app.db.dynamo import get_all_products

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mock State (Used when MOCK_AWS is True)
# ---------------------------------------------------------------------------
# Stores reserved quantities per SKU: { sku: { reservation_id: qty } }
_mock_reservations: Dict[str, Dict[str, int]] = {}

# Stores available inventory overrides: { sku: qty }
_mock_inventory: Dict[str, int] = {}

# Stores reservation metadata for idempotency and expiry
_reservation_metadata: Dict[str, dict] = {}

def _init_mock_inventory(sku: str, initial_qty: int = 50):
    if sku not in _mock_inventory:
        _mock_inventory[sku] = initial_qty
    if sku not in _mock_reservations:
        _mock_reservations[sku] = {}

# ---------------------------------------------------------------------------
# DynamoDB Resources
# ---------------------------------------------------------------------------
_dynamodb = None

def _get_products_table():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb.Table(DYNAMODB_TABLE_PRODUCTS)

def reserve_items(
    session_id: str,
    items: List[Dict[str, int]],
    mock_mode: bool = False,
    idempotency_key: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Tuple[bool, List[str], Optional[str], dict]:
    """
    Attempt to reserve a list of items with DynamoDB conditional updates.
    All items must be reserved successfully, or the entire operation rolls back.

    Args:
        session_id: The cart session ID.
        items: List of dictionaries like [{"sku": "SKU-123", "qty": 2, "location_id": "DEFAULT"}, ...]
        mock_mode: Whether to use in-memory mock or real DynamoDB.
        idempotency_key: Optional key to prevent duplicate reservations.
        user_id: Optional user ID for tracking.

    Returns:
        (success_boolean, list_of_failed_skus, reservation_id, metadata_dict)
        
        metadata_dict contains:
        - reserved_items: List of successfully reserved items with details
        - failed_items: List of failed items with reasons and alternatives
        - total_amount: Total price of reserved items
        - expires_at: ISO timestamp when reservation expires
        - message: Human-readable status message
    """
    if not items:
        return True, [], str(uuid.uuid4()), {
            "reserved_items": [],
            "failed_items": [],
            "total_amount": 0.0,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
            "message": "No items to reserve"
        }

    reservation_id = f"res_{session_id}"
    is_mock = MOCK_AWS or mock_mode
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Check idempotency (both mock and real)
    if idempotency_key and idempotency_key in _reservation_metadata:
        cached = _reservation_metadata[idempotency_key]
        logger.info(f"Idempotent request detected: {idempotency_key}")
        return cached["success"], cached["failed_skus"], cached["reservation_id"], cached["metadata"]
    
    # Load product catalog for metadata enrichment
    try:
        products = {p["sku"]: p for p in get_all_products()}
    except Exception as e:
        logger.error(f"Failed to load product catalog: {e}")
        products = {}

    if is_mock:
        # Mock Mode: In-memory reservation logic
        failed_skus = []
        reserved_items = []
        failed_items = []
        total_amount = 0.0
        
        for item in items:
            sku = item["sku"]
            qty = item["qty"]
            _init_mock_inventory(sku)
            
            # Calculate currently available: total - reserved
            total_reserved = sum(_mock_reservations[sku].values())
            available = _mock_inventory[sku] - total_reserved
            
            product = products.get(sku, {})
            price = float(product.get("price_inr", 0))
            
            if available < qty:
                failed_skus.append(sku)
                failed_items.append({
                    "sku": sku,
                    "name": product.get("name", sku),
                    "reason": "out_of_stock",
                    "message": f"Only {available} units available, requested {qty}",
                    "available_qty": available,
                })
            else:
                item_total = price * qty
                reserved_items.append({
                    "sku": sku,
                    "name": product.get("name", sku),
                    "qty": qty,
                    "price_per_unit": price,
                    "total": item_total,
                })
                total_amount += item_total

        if failed_skus:
            metadata = {
                "reserved_items": reserved_items,
                "failed_items": failed_items,
                "total_amount": total_amount,
                "expires_at": expires_at.isoformat(),
                "message": f"{len(failed_skus)} item(s) out of stock"
            }
            # Cache for idempotency
            if idempotency_key:
                _reservation_metadata[idempotency_key] = {
                    "success": False,
                    "failed_skus": failed_skus,
                    "reservation_id": None,
                    "metadata": metadata
                }
            return False, failed_skus, None, metadata

        # Apply reservations
        for item in items:
            sku = item["sku"]
            qty = item["qty"]
            _mock_reservations[sku][reservation_id] = qty
        
        metadata = {
            "reserved_items": reserved_items,
            "failed_items": [],
            "total_amount": total_amount,
            "expires_at": expires_at.isoformat(),
            "message": f"Successfully reserved {len(reserved_items)} item(s)",
            "status": "reserved"
        }

        # Store metadata
        _reservation_metadata[reservation_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "items": items,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
            "metadata": metadata,
            "reserved_items": reserved_items,
            "total_amount": total_amount,
            "status": "reserved"
        }

        
        # Cache for idempotency
        if idempotency_key:
            _reservation_metadata[idempotency_key] = {
                "success": True,
                "failed_skus": [],
                "reservation_id": reservation_id,
                "metadata": metadata
            }
        
        logger.info(f"[MOCK] Reserved items for {reservation_id}")
        return True, [], reservation_id, metadata

    # Real DynamoDB Transaction
    client = boto3.client("dynamodb", region_name=AWS_REGION)
    
    # DynamoDB Transactions support up to 100 items
    transact_items = []
    reserved_items = []
    total_amount = 0.0
    
    for item in items:
        sku = item["sku"]
        qty = str(item["qty"])
        
        product = products.get(sku, {})
        price = float(product.get("price_inr", 0))
        item_total = price * int(qty)
        
        reserved_items.append({
            "sku": sku,
            "name": product.get("name", sku),
            "qty": int(qty),
            "price_per_unit": price,
            "total": item_total,
        })
        total_amount += item_total
        
        # Conditional update: available_qty >= requested_qty
        transact_items.append({
            "Update": {
                "TableName": DYNAMODB_TABLE_PRODUCTS,
                "Key": {"sku": {"S": sku}},
                "UpdateExpression": "SET available_qty = available_qty - :qty, reserved_qty = if_not_exists(reserved_qty, :zero) + :qty",
                "ConditionExpression": "attribute_exists(sku) AND available_qty >= :qty",
                "ExpressionAttributeValues": {
                    ":qty": {"N": qty},
                    ":zero": {"N": "0"}
                }
            }
        })

    try:
        client.transact_write_items(TransactItems=transact_items)
        
        metadata = {
            "reserved_items": reserved_items,
            "failed_items": [],
            "total_amount": total_amount,
            "expires_at": expires_at.isoformat(),
            "message": f"Successfully reserved {len(reserved_items)} item(s)",
            "status": "reserved"
        }
        
        # Store metadata
        _reservation_metadata[reservation_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "items": items,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
            "metadata": metadata,
            "reserved_items": reserved_items,
            "total_amount": total_amount,
            "status": "reserved"
        }
        
        # Cache for idempotency
        if idempotency_key:
            _reservation_metadata[idempotency_key] = {
                "success": True,
                "failed_skus": [],
                "reservation_id": reservation_id,
                "metadata": metadata
            }
        
        logger.info(f"DynamoDB: Successfully reserved items for {reservation_id}")
        return True, [], reservation_id, metadata
        
    except client.exceptions.TransactionCanceledException as e:
        reasons = e.response.get("CancellationReasons", [])
        failed_skus = []
        failed_items = []
        
        for i, reason in enumerate(reasons):
            if reason.get("Code") == "ConditionalCheckFailed":
                sku = items[i]["sku"]
                failed_skus.append(sku)
                product = products.get(sku, {})
                failed_items.append({
                    "sku": sku,
                    "name": product.get("name", sku),
                    "reason": "out_of_stock",
                    "message": f"{product.get('name', sku)} is currently out of stock or insufficient quantity",
                })
        
        metadata = {
            "reserved_items": [],
            "failed_items": failed_items,
            "total_amount": 0.0,
            "expires_at": expires_at.isoformat(),
            "message": f"Reservation failed: {len(failed_skus)} item(s) out of stock"
        }
        
        # Cache for idempotency
        if idempotency_key:
            _reservation_metadata[idempotency_key] = {
                "success": False,
                "failed_skus": failed_skus,
                "reservation_id": None,
                "metadata": metadata
            }
        
        logger.warning(f"Reservation failed for {reservation_id}. Out of stock SKUs: {failed_skus}")
        return False, failed_skus, None, metadata
        
    except Exception as e:
        logger.error(f"Error reserving items in DynamoDB: {e}")
        
        metadata = {
            "reserved_items": [],
            "failed_items": [{
                "sku": items[0]["sku"] if items else "unknown",
                "reason": "system_error",
                "message": str(e)
            }],
            "total_amount": 0.0,
            "expires_at": expires_at.isoformat(),
            "message": "System error during reservation"
        }
        
        return False, [items[0]["sku"]] if items else [], None, metadata


def release_reservation(
    reservation_id: str,
    items: List[Dict[str, int]],
    mock_mode: bool = False
) -> bool:
    """
    Release a previously held reservation (e.g., user abandoned checkout).
    Adds back the reserved quantities to available inventory.
    """
    is_mock = MOCK_AWS or mock_mode

    if is_mock:
        for item in items:
            sku = item["sku"]
            if sku in _mock_reservations and reservation_id in _mock_reservations[sku]:
                del _mock_reservations[sku][reservation_id]
        
        # Clean up metadata
        if reservation_id in _reservation_metadata:
            del _reservation_metadata[reservation_id]
            
        logger.info(f"[MOCK] Released reservation {reservation_id}")
        return True

    client = boto3.client("dynamodb", region_name=AWS_REGION)
    transact_items = []
    
    for item in items:
        sku = item["sku"]
        qty = str(item["qty"])
        
        # Add back to available_qty, subtract from reserved_qty
        transact_items.append({
            "Update": {
                "TableName": DYNAMODB_TABLE_PRODUCTS,
                "Key": {"sku": {"S": sku}},
                "UpdateExpression": "SET available_qty = available_qty + :qty, reserved_qty = reserved_qty - :qty",
                "ConditionExpression": "attribute_exists(sku) AND reserved_qty >= :qty",
                "ExpressionAttributeValues": {
                    ":qty": {"N": qty}
                }
            }
        })

    try:
        client.transact_write_items(TransactItems=transact_items)
        logger.info(f"DynamoDB: Released reservation {reservation_id}")
        return True
    except Exception as e:
        logger.error(f"Error releasing reservation {reservation_id} in DynamoDB: {e}")
        return False


def commit_reservation(
    reservation_id: str,
    items: List[Dict[str, int]],
    mock_mode: bool = False
) -> bool:
    """
    Finalize a reservation (e.g., payment successful).
    For mock mode: permanently decrement inventory.
    For DynamoDB: stock is already decremented during reserve, just update reserved_qty.
    """
    is_mock = MOCK_AWS or mock_mode

    if is_mock:
        for item in items:
            sku = item["sku"]
            qty = item["qty"]
            if sku in _mock_reservations and reservation_id in _mock_reservations[sku]:
                # Actual stock is decremented permanently
                _mock_inventory[sku] -= qty
                del _mock_reservations[sku][reservation_id]
        
        # Clean up metadata
        if reservation_id in _reservation_metadata:
            del _reservation_metadata[reservation_id]
            
        logger.info(f"[MOCK] Committed reservation {reservation_id}")
        return True

    # For DynamoDB, the stock is already decremented during reserve.
    # We just need to clear the reserved_qty counter.
    client = boto3.client("dynamodb", region_name=AWS_REGION)
    transact_items = []
    
    for item in items:
        sku = item["sku"]
        qty = str(item["qty"])
        
        transact_items.append({
            "Update": {
                "TableName": DYNAMODB_TABLE_PRODUCTS,
                "Key": {"sku": {"S": sku}},
                "UpdateExpression": "SET reserved_qty = reserved_qty - :qty",
                "ConditionExpression": "attribute_exists(sku) AND reserved_qty >= :qty",
                "ExpressionAttributeValues": {
                    ":qty": {"N": qty}
                }
            }
        })

    try:
        client.transact_write_items(TransactItems=transact_items)
        logger.info(f"DynamoDB: Committed reservation {reservation_id}")
        return True
    except Exception as e:
        logger.error(f"Error committing reservation {reservation_id} in DynamoDB: {e}")
        return False


def get_reservation_metadata(reservation_id: str) -> Optional[dict]:
    """Get reservation metadata (for mock mode tracking)."""
    return _reservation_metadata.get(reservation_id)


def cleanup_expired_reservations(mock_mode: bool = False):
    """
    Clean up expired reservations (primarily for mock mode).
    For production, use DynamoDB TTL on a reservations table.
    """
    is_mock = MOCK_AWS or mock_mode
    
    if not is_mock:
        logger.info("Cleanup not needed for DynamoDB mode (use TTL)")
        return
    
    now = datetime.now(timezone.utc)
    expired = []
    
    for res_id, metadata in list(_reservation_metadata.items()):
        expires_at = metadata.get("expires_at")
        if expires_at and isinstance(expires_at, datetime) and expires_at < now:
            expired.append(res_id)
            items = metadata.get("items", [])
            release_reservation(res_id, items, mock_mode=True)
    
    if expired:
        logger.info(f"[MOCK] Cleaned up {len(expired)} expired reservations: {expired}")
