"""
Inventory Reservations — Phase 5
Handles reserving, releasing, and committing inventory using DynamoDB transactions.
Includes mock mode fallback for local testing without AWS.
"""

import logging
import uuid
from typing import Dict, List, Optional, Tuple

import boto3
from app.config import AWS_REGION, DYNAMODB_TABLE_PRODUCTS, MOCK_AWS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mock State (Used when MOCK_AWS is True)
# ---------------------------------------------------------------------------
# Stores reserved quantities per SKU: { sku: { reservation_id: qty } }
_mock_reservations: Dict[str, Dict[str, int]] = {}

# Stores available inventory overrides: { sku: qty }
# If a SKU isn't here, we assume it has unlimited stock for mock purposes,
# or we can initialize it to a fixed number (e.g. 50).
_mock_inventory: Dict[str, int] = {}

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


# ---------------------------------------------------------------------------
# Core Functions
# ---------------------------------------------------------------------------

def reserve_items(session_id: str, items: List[Dict[str, int]], mock_mode: bool = False) -> Tuple[bool, List[str], Optional[str]]:
    """
    Attempt to reserve a list of items.
    All items must be reserved successfully, or the entire operation rolls back.

    Args:
        session_id: The cart session ID.
        items: List of dictionaries like [{"sku": "SKU-123", "qty": 2}, ...]
        mock_mode: Whether to use in-memory mock or real DynamoDB.

    Returns:
        (success_boolean, list_of_failed_skus, reservation_id)
    """
    if not items:
        return True, [], str(uuid.uuid4())

    reservation_id = f"res_{session_id}"
    is_mock = MOCK_AWS or mock_mode

    if is_mock:
        # Check availability first
        failed_skus = []
        for item in items:
            sku = item["sku"]
            qty = item["qty"]
            _init_mock_inventory(sku)
            
            # Calculate currently available: total - reserved
            total_reserved = sum(_mock_reservations[sku].values())
            available = _mock_inventory[sku] - total_reserved
            
            if available < qty:
                failed_skus.append(sku)

        if failed_skus:
            return False, failed_skus, None

        # Apply reservations
        for item in items:
            sku = item["sku"]
            qty = item["qty"]
            _mock_reservations[sku][reservation_id] = qty

        logger.info(f"[MOCK] Reserved items for {reservation_id}")
        return True, [], reservation_id

    # Real DynamoDB Transaction
    client = boto3.client("dynamodb", region_name=AWS_REGION)
    
    # DynamoDB Transactions support up to 100 items. If cart > 100, we'd need to chunk,
    # but that's unlikely for a grocery cart.
    transact_items = []
    
    for item in items:
        sku = item["sku"]
        qty = str(item["qty"])
        
        # We assume the Products table has an `available_qty` field.
        # Condition: available_qty >= requested_qty
        transact_items.append({
            "Update": {
                "TableName": DYNAMODB_TABLE_PRODUCTS,
                "Key": {"sku": {"S": sku}},
                "UpdateExpression": "SET available_qty = available_qty - :qty",
                "ConditionExpression": "attribute_exists(sku) AND available_qty >= :qty",
                "ExpressionAttributeValues": {
                    ":qty": {"N": qty}
                }
            }
        })

    try:
        client.transact_write_items(TransactItems=transact_items)
        logger.info(f"DynamoDB: Successfully reserved items for {reservation_id}")
        return True, [], reservation_id
    except client.exceptions.TransactionCanceledException as e:
        reasons = e.response.get("CancellationReasons", [])
        failed_skus = []
        for i, reason in enumerate(reasons):
            if reason.get("Code") == "ConditionalCheckFailed":
                failed_skus.append(items[i]["sku"])
        
        logger.warning(f"Reservation failed for {reservation_id}. Out of stock SKUs: {failed_skus}")
        return False, failed_skus, None
    except Exception as e:
        logger.error(f"Error reserving items in DynamoDB: {e}")
        return False, [items[0]["sku"]] if items else [], None


def release_reservation(reservation_id: str, items: List[Dict[str, int]], mock_mode: bool = False) -> bool:
    """
    Release a previously held reservation (e.g., user abandoned checkout).
    """
    is_mock = MOCK_AWS or mock_mode

    if is_mock:
        for item in items:
            sku = item["sku"]
            if sku in _mock_reservations and reservation_id in _mock_reservations[sku]:
                del _mock_reservations[sku][reservation_id]
        logger.info(f"[MOCK] Released reservation {reservation_id}")
        return True

    client = boto3.client("dynamodb", region_name=AWS_REGION)
    transact_items = []
    
    for item in items:
        sku = item["sku"]
        qty = str(item["qty"])
        
        transact_items.append({
            "Update": {
                "TableName": DYNAMODB_TABLE_PRODUCTS,
                "Key": {"sku": {"S": sku}},
                "UpdateExpression": "SET available_qty = available_qty + :qty",
                "ConditionExpression": "attribute_exists(sku)",
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


def commit_reservation(reservation_id: str, items: List[Dict[str, int]], mock_mode: bool = False) -> bool:
    """
    Finalize a reservation (e.g., payment successful).
    Since we already decremented available_qty during reserve_items, 
    we just clear the mock tracker. For DynamoDB, no further action is strictly 
    needed unless we track 'reserved_qty' separately.
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
        logger.info(f"[MOCK] Committed reservation {reservation_id}")
        return True

    # For DynamoDB, the stock is already decremented. We could write an order record here.
    logger.info(f"DynamoDB: Committed reservation {reservation_id}")
    return True
