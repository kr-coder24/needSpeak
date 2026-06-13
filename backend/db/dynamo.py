"""
DynamoDB client and query functions for ProductCatalog and CartSessions.

With 80 SKUs, we load the entire catalog into memory at startup for fast
SKU resolution. This avoids per-item DynamoDB queries during the pipeline.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key

from config import AWS_REGION, DYNAMODB_TABLE_PRODUCTS, DYNAMODB_TABLE_SESSIONS, MOCK_MODE

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DynamoDB Resource (singleton)
# ---------------------------------------------------------------------------
_dynamodb = None


def _get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


def _get_products_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_PRODUCTS)


def _get_sessions_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_SESSIONS)


# ---------------------------------------------------------------------------
# Decimal serializer (DynamoDB returns Decimal, JSON needs float/int)
# ---------------------------------------------------------------------------
def _decimal_to_native(obj):
    """Recursively convert Decimal values to int or float for JSON."""
    if isinstance(obj, Decimal):
        if obj == int(obj):
            return int(obj)
        return float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_decimal_to_native(i) for i in obj]
    if isinstance(obj, set):
        return [_decimal_to_native(i) for i in obj]
    return obj


# ---------------------------------------------------------------------------
# Product Catalog — In-Memory Cache
# ---------------------------------------------------------------------------
_product_cache: list[dict] = []
_cache_loaded = False


def load_all_products() -> list[dict]:
    """
    Load all products from DynamoDB into memory.
    With 80 items this is a single scan that completes in ~100ms.
    """
    global _product_cache, _cache_loaded

    if MOCK_MODE:
        _product_cache = _get_mock_products()
        _cache_loaded = True
        return _product_cache

    table = _get_products_table()
    items = []
    response = table.scan()
    items.extend(response.get("Items", []))

    # Handle pagination (unlikely with 80 items but safe)
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    _product_cache = [_decimal_to_native(item) for item in items]
    _cache_loaded = True
    logger.info(f"Loaded {len(_product_cache)} products into memory cache")
    return _product_cache


def get_all_products() -> list[dict]:
    """Get all products, loading from DynamoDB if not cached."""
    if not _cache_loaded:
        load_all_products()
    return _product_cache


def refresh_product_cache() -> list[dict]:
    """Force refresh the product cache from DynamoDB."""
    global _cache_loaded
    _cache_loaded = False
    return load_all_products()


def get_product_by_sku(sku: str) -> Optional[dict]:
    """Get a single product by SKU from cache."""
    products = get_all_products()
    for p in products:
        if p["sku"] == sku:
            return p
    return None


# ---------------------------------------------------------------------------
# Session CRUD
# ---------------------------------------------------------------------------
def save_session(session_data: dict) -> None:
    """Save a session record to CartSessions table."""
    if MOCK_MODE:
        logger.info(f"[MOCK] Would save session: {session_data.get('session_id')}")
        return

    table = _get_sessions_table()
    # Convert floats to Decimal for DynamoDB
    item = json.loads(json.dumps(session_data, default=str), parse_float=Decimal)
    table.put_item(Item=item)
    logger.info(f"Session saved: {session_data.get('session_id')}")


def get_session(session_id: str) -> Optional[dict]:
    """Retrieve a session by ID."""
    if MOCK_MODE:
        return _get_mock_session(session_id)

    table = _get_sessions_table()
    response = table.get_item(Key={"session_id": session_id})
    item = response.get("Item")
    if item:
        return _decimal_to_native(item)
    return None


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
def check_dynamodb_health() -> bool:
    """Verify DynamoDB connectivity by describing the products table."""
    if MOCK_MODE:
        return True
    try:
        table = _get_products_table()
        _ = table.table_status
        return True
    except Exception as e:
        logger.error(f"DynamoDB health check failed: {e}")
        return False


# ---------------------------------------------------------------------------
# Mock Data (for MOCK_MODE)
# ---------------------------------------------------------------------------
def _get_mock_products() -> list[dict]:
    """Return a small set of mock products for demo mode."""
    return [
        {
            "sku": "MOCK-GRN-001", "name": "india gate basmati rice", "category": "grains",
            "subcategory": "rice", "brand": "India Gate", "price_inr": 189,
            "unit": "g", "unit_quantity": 1000, "rating": 4.5, "in_stock": True,
            "keywords": ["rice", "basmati", "biryani", "pulao", "chawal"],
            "tags": ["biryani", "everyday"],
        },
        {
            "sku": "MOCK-SPC-001", "name": "mdh turmeric powder haldi", "category": "spices",
            "subcategory": "ground spice", "brand": "MDH", "price_inr": 42,
            "unit": "g", "unit_quantity": 100, "rating": 4.4, "in_stock": True,
            "keywords": ["turmeric", "haldi", "powder", "spice"],
            "tags": ["everyday", "cooking"],
        },
        {
            "sku": "MOCK-SPC-002", "name": "mdh red chili powder", "category": "spices",
            "subcategory": "ground spice", "brand": "MDH", "price_inr": 55,
            "unit": "g", "unit_quantity": 100, "rating": 4.3, "in_stock": True,
            "keywords": ["red chili", "chili powder", "mirch", "spice"],
            "tags": ["everyday", "cooking"],
        },
        {
            "sku": "MOCK-VEG-001", "name": "fresh onion", "category": "vegetables",
            "subcategory": "root vegetable", "brand": "Fresh", "price_inr": 35,
            "unit": "g", "unit_quantity": 1000, "rating": 4.0, "in_stock": True,
            "keywords": ["onion", "pyaaz", "vegetable"],
            "tags": ["everyday", "cooking"],
        },
        {
            "sku": "MOCK-DRY-001", "name": "amul butter", "category": "dairy",
            "subcategory": "butter", "brand": "Amul", "price_inr": 275,
            "unit": "g", "unit_quantity": 500, "rating": 4.7, "in_stock": True,
            "keywords": ["butter", "amul", "dairy"],
            "tags": ["everyday", "baking"],
        },
    ]


def _get_mock_session(session_id: str) -> Optional[dict]:
    """Return a mock session for demo mode."""
    return {
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_type": "text",
        "status": "completed",
        "intent_type": "general",
        "context_summary": "Mock session",
        "total_price_inr": 0,
    }
