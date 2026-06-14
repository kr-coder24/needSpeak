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
from typing import Optional, Any

import boto3
from boto3.dynamodb.conditions import Key

from app.config import (
    AWS_REGION, 
    DYNAMODB_TABLE_PRODUCTS, 
    DYNAMODB_TABLE_SESSIONS, 
    DYNAMODB_TABLE_PREFERENCES,
    DYNAMODB_TABLE_EVENTS,
    DYNAMODB_TABLE_SHOPPER_PROFILES,
    MOCK_AWS
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DynamoDB Resource (singleton)
# ---------------------------------------------------------------------------
_dynamodb: Any = None


def _get_dynamodb() -> Any:
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


def _get_products_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_PRODUCTS)


def _get_sessions_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_SESSIONS)


def _get_preferences_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_PREFERENCES)


def _get_events_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_EVENTS)


def _get_shopper_profiles_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_SHOPPER_PROFILES)


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

# In-memory session store used when AWS is mocked, so the Review Cart page
# (GET /api/session/{id}) can round-trip within the running server without
# touching DynamoDB.
_mock_session_store: dict[str, dict] = {}


def load_all_products(mock_mode: Optional[bool] = None) -> list[dict]:
    """
    Load all products from DynamoDB into memory.
    With 80 items this is a single scan that completes in ~100ms.
    """
    global _product_cache, _cache_loaded

    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
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


def get_all_products(mock_mode: Optional[bool] = None) -> list[dict]:
    """Get all products, loading from DynamoDB if not cached."""
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        return _get_mock_products()

    global _cache_loaded
    if not _cache_loaded:
        load_all_products(mock_mode=mock_mode)
    return _product_cache


def refresh_product_cache() -> list[dict]:
    """Force refresh the product cache from DynamoDB."""
    global _cache_loaded
    _cache_loaded = False
    return load_all_products()


def get_product_by_sku(sku: str, mock_mode: Optional[bool] = None) -> Optional[dict]:
    """Get a single product by SKU from cache."""
    products = get_all_products(mock_mode=mock_mode)
    for p in products:
        if p["sku"] == sku:
            return p
    return None


# ---------------------------------------------------------------------------
# Session CRUD
# ---------------------------------------------------------------------------
def save_session(session_data: dict, mock_mode: Optional[bool] = None) -> None:
    """Save a session record to CartSessions table."""
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        sid = session_data.get("session_id")
        # Keep it in memory so GET /api/session/{id} can return the full cart.
        _mock_session_store[sid] = session_data
        logger.info(f"[MOCK] Stored session in memory: {sid}")
        return

    table = _get_sessions_table()
    # Convert floats to Decimal for DynamoDB
    item = json.loads(json.dumps(session_data, default=str), parse_float=Decimal)
    table.put_item(Item=item)
    logger.info(f"Session saved: {session_data.get('session_id')}")


def get_session(session_id: str, mock_mode: Optional[bool] = None) -> Optional[dict]:
    """Retrieve a session by ID."""
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        # Return the real stored session if we have it; otherwise a stub.
        return _mock_session_store.get(session_id) or _get_mock_session(session_id)

    table = _get_sessions_table()
    response = table.get_item(Key={"session_id": session_id})
    item = response.get("Item")
    if item:
        return _decimal_to_native(item)
    return None


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
def check_dynamodb_health(mock_mode: Optional[bool] = None) -> bool:
    """Verify DynamoDB connectivity by describing the products table."""
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
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
    """Return product catalog for demo mode. Uses V2 catalog if available, else legacy data."""
    try:
        from seed_catalog_v2 import get_all_v2_products
        from app.catalog.health_scorer import calculate_health_score
        from decimal import Decimal
        
        products = get_all_v2_products()
        
        # Calculate health scores for products with nutritional data
        health_scored_count = 0
        for product in products:
            if any([
                product.get("calories_per_100"),
                product.get("sugar_per_100"),
                product.get("protein_per_100"),
            ]):
                health_score, health_badge = calculate_health_score(
                    calories_per_100=product.get("calories_per_100"),
                    protein_per_100=product.get("protein_per_100"),
                    carbs_per_100=product.get("carbs_per_100"),
                    sugar_per_100=product.get("sugar_per_100"),
                    fat_per_100=product.get("fat_per_100"),
                    saturated_fat_per_100=product.get("saturated_fat_per_100"),
                    fiber_per_100=product.get("fiber_per_100"),
                    sodium_per_100=product.get("sodium_per_100"),
                    category=product.get("category", ""),
                )
                if health_score is not None:
                    product["health_score"] = health_score
                    health_scored_count += 1
        
        # Convert Decimal to float/int for compatibility with resolver
        normalized = []
        for p in products:
            item = {}
            for k, v in p.items():
                if isinstance(v, Decimal):
                    item[k] = float(v) if v != int(v) else int(v)
                elif isinstance(v, set):
                    item[k] = list(v)
                else:
                    item[k] = v
            normalized.append(item)
        
        logger.info(f"[MOCK] Loaded V2 catalog: {len(normalized)} products ({health_scored_count} with health scores)")
        return normalized
    except Exception as e:
        logger.warning(f"[MOCK] V2 catalog unavailable ({e}), using legacy mock data")
        return _get_legacy_mock_products()


def _get_legacy_mock_products() -> list[dict]:
    """Return the original set of mock products (legacy fallback)."""
    return [
        # Grains
        {
            "sku": "MOCK-GRN-001", "name": "india gate classic basmati rice", "category": "grains",
            "subcategory": "rice", "brand": "India Gate", "price_inr": 189,
            "unit": "g", "unit_quantity": 1000, "rating": 4.5, "in_stock": True,
            "keywords": ["rice", "basmati", "biryani", "pulao", "chawal"],
            "tags": ["biryani", "everyday"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-GRN-002", "name": "aashirvaad whole wheat atta", "category": "grains",
            "subcategory": "flour", "brand": "Aashirvaad", "price_inr": 269,
            "unit": "g", "unit_quantity": 5000, "rating": 4.6, "in_stock": True,
            "keywords": ["atta", "wheat", "flour", "roti", "chapati"],
            "tags": ["everyday"],
            "dietary": ["veg", "vegan", "jain"],
        },
        
        # Spices
        {
            "sku": "MOCK-SPC-001", "name": "mdh turmeric powder haldi", "category": "spices",
            "subcategory": "ground spice", "brand": "MDH", "price_inr": 42,
            "unit": "g", "unit_quantity": 100, "rating": 4.4, "in_stock": True,
            "keywords": ["turmeric", "haldi", "powder", "spice"],
            "tags": ["everyday", "cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-SPC-002", "name": "mdh red chili powder", "category": "spices",
            "subcategory": "ground spice", "brand": "MDH", "price_inr": 55,
            "unit": "g", "unit_quantity": 100, "rating": 4.3, "in_stock": True,
            "keywords": ["red chili", "chili powder", "mirch", "spice"],
            "tags": ["everyday", "cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-SPC-003", "name": "tata salt iodized", "category": "spices",
            "subcategory": "salt", "brand": "Tata", "price_inr": 25,
            "unit": "g", "unit_quantity": 1000, "rating": 4.8, "in_stock": True,
            "keywords": ["salt", "namak", "tata salt"],
            "tags": ["everyday"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-SPC-004", "name": "everest garam masala powder", "category": "spices",
            "subcategory": "ground spice", "brand": "Everest", "price_inr": 68,
            "unit": "g", "unit_quantity": 100, "rating": 4.5, "in_stock": True,
            "keywords": ["garam masala", "masala powder", "everest", "spice"],
            "tags": ["cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-SPC-005", "name": "everest biryani masala", "category": "spices",
            "subcategory": "ground spice", "brand": "Everest", "price_inr": 75,
            "unit": "g", "unit_quantity": 50, "rating": 4.6, "in_stock": True,
            "keywords": ["biryani masala", "masala", "biryani powder", "everest"],
            "tags": ["biryani", "cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-SPC-006", "name": "catch black pepper powder", "category": "spices",
            "subcategory": "ground spice", "brand": "Catch", "price_inr": 60,
            "unit": "g", "unit_quantity": 50, "rating": 4.2, "in_stock": True,
            "keywords": ["black pepper", "kali mirch", "pepper powder"],
            "tags": ["cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        
        # Vegetables
        {
            "sku": "MOCK-VEG-001", "name": "fresh onion", "category": "vegetables",
            "subcategory": "root vegetable", "brand": "Fresh", "price_inr": 35,
            "unit": "g", "unit_quantity": 1000, "rating": 4.0, "in_stock": True,
            "keywords": ["onion", "pyaaz", "vegetable"],
            "tags": ["everyday", "cooking"],
            "dietary": ["veg", "vegan"],
        },
        {
            "sku": "MOCK-VEG-002", "name": "fresh tomato", "category": "vegetables",
            "subcategory": "vine vegetable", "brand": "Fresh", "price_inr": 40,
            "unit": "g", "unit_quantity": 1000, "rating": 4.1, "in_stock": True,
            "keywords": ["tomato", "tamatar", "vegetable"],
            "tags": ["everyday", "cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-VEG-010", "name": "fresh iceberg lettuce", "category": "vegetables",
            "subcategory": "leafy vegetable", "brand": "Fresh", "price_inr": 65,
            "unit": "piece", "unit_quantity": 1, "rating": 4.5, "in_stock": True,
            "keywords": ["lettuce", "leaf", "salad", "burger"],
            "tags": ["salad", "burger"],
            "dietary": ["veg", "vegan", "jain"],
        },
        
        # Burger/Fast Food Specific
        {
            "sku": "MOCK-BUN-001", "name": "english oven burger buns", "category": "grains",
            "subcategory": "bread", "brand": "English Oven", "price_inr": 40,
            "unit": "pack", "unit_quantity": 1, "rating": 4.5, "in_stock": True,
            "keywords": ["bun", "burger bun", "bread"],
            "tags": ["burger", "snacks"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-BUN-002", "name": "harvest gold white bread", "category": "grains",
            "subcategory": "bread", "brand": "Harvest Gold", "price_inr": 35,
            "unit": "pack", "unit_quantity": 1, "rating": 4.6, "in_stock": True,
            "keywords": ["bread", "white bread", "sandwich bread", "slice"],
            "tags": ["sandwich", "breakfast"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-SNK-005", "name": "mccain aloo tikki", "category": "snacks",
            "subcategory": "frozen", "brand": "McCain", "price_inr": 125,
            "unit": "pack", "unit_quantity": 1, "rating": 4.7, "in_stock": True,
            "keywords": ["aloo tikki", "patty", "frozen", "burger patty"],
            "tags": ["burger", "snacks"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-DAI-005", "name": "amul cheese slices", "category": "dairy",
            "subcategory": "cheese", "brand": "Amul", "price_inr": 130,
            "unit": "pack", "unit_quantity": 1, "rating": 4.8, "in_stock": True,
            "keywords": ["cheese", "slice", "amul", "cheese slice"],
            "tags": ["burger", "breakfast"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-DAI-006", "name": "dr. oetker veg mayonnaise", "category": "dairy",
            "subcategory": "sauce", "brand": "Dr. Oetker", "price_inr": 85,
            "unit": "pack", "unit_quantity": 1, "rating": 4.6, "in_stock": True,
            "keywords": ["mayo", "mayonnaise", "veg mayo"],
            "tags": ["burger", "snacks"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-SPC-010", "name": "kissan fresh tomato ketchup", "category": "spices",
            "subcategory": "sauce", "brand": "Kissan", "price_inr": 110,
            "unit": "pack", "unit_quantity": 1, "rating": 4.5, "in_stock": True,
            "keywords": ["ketchup", "tomato ketchup", "sauce"],
            "tags": ["burger", "snacks"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-VEG-002", "name": "fresh tomato", "category": "vegetables",
            "subcategory": "vine vegetable", "brand": "Fresh", "price_inr": 40,
            "unit": "g", "unit_quantity": 1000, "rating": 4.1, "in_stock": True,
            "keywords": ["tomato", "tamatar", "vegetable"],
            "tags": ["everyday", "cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-VEG-003", "name": "fresh ginger adrak", "category": "vegetables",
            "subcategory": "root vegetable", "brand": "Fresh", "price_inr": 20,
            "unit": "g", "unit_quantity": 100, "rating": 4.2, "in_stock": True,
            "keywords": ["ginger", "adrak", "vegetable"],
            "tags": ["cooking"],
            "dietary": ["veg", "vegan"],
        },
        {
            "sku": "MOCK-VEG-004", "name": "fresh garlic lahsun", "category": "vegetables",
            "subcategory": "root vegetable", "brand": "Fresh", "price_inr": 25,
            "unit": "g", "unit_quantity": 100, "rating": 4.3, "in_stock": True,
            "keywords": ["garlic", "lahsun", "vegetable"],
            "tags": ["cooking"],
            "dietary": ["veg", "vegan"],
        },
        {
            "sku": "MOCK-VEG-005", "name": "fresh green chili hari mirch", "category": "vegetables",
            "subcategory": "chili", "brand": "Fresh", "price_inr": 15,
            "unit": "g", "unit_quantity": 100, "rating": 4.1, "in_stock": True,
            "keywords": ["green chili", "hari mirch", "vegetable"],
            "tags": ["cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-VEG-006", "name": "fresh coriander leaves bunch", "category": "vegetables",
            "subcategory": "herb", "brand": "Fresh", "price_inr": 10,
            "unit": "piece", "unit_quantity": 1, "rating": 4.4, "in_stock": True,
            "keywords": ["coriander", "dhania", "leaves", "bunch", "green herb"],
            "tags": ["everyday"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-VEG-007", "name": "fresh mint leaves bunch pudina", "category": "vegetables",
            "subcategory": "herb", "brand": "Fresh", "price_inr": 10,
            "unit": "piece", "unit_quantity": 1, "rating": 4.5, "in_stock": True,
            "keywords": ["mint", "pudina", "leaves", "bunch", "green herb"],
            "tags": ["cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-VEG-008", "name": "fresh lemon nimbu", "category": "vegetables",
            "subcategory": "citrus", "brand": "Fresh", "price_inr": 20,
            "unit": "piece", "unit_quantity": 6, "rating": 4.6, "in_stock": True,
            "keywords": ["lemon", "nimbu", "vegetable"],
            "tags": ["everyday"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # Dairy
        {
            "sku": "MOCK-DRY-001", "name": "amul butter salted", "category": "dairy",
            "subcategory": "butter", "brand": "Amul", "price_inr": 275,
            "unit": "g", "unit_quantity": 500, "rating": 4.7, "in_stock": True,
            "keywords": ["butter", "amul", "dairy", "salted butter"],
            "tags": ["everyday"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-DRY-002", "name": "amul fresh paneer", "category": "dairy",
            "subcategory": "paneer", "brand": "Amul", "price_inr": 90,
            "unit": "g", "unit_quantity": 200, "rating": 4.6, "in_stock": True,
            "keywords": ["paneer", "cottage cheese", "amul paneer", "dairy"],
            "tags": ["cooking"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-DRY-003", "name": "mother dairy curd dahi", "category": "dairy",
            "subcategory": "curd", "brand": "Mother Dairy", "price_inr": 35,
            "unit": "g", "unit_quantity": 400, "rating": 4.4, "in_stock": True,
            "keywords": ["curd", "yogurt", "dahi", "mother dairy"],
            "tags": ["everyday", "biryani"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-DRY-004", "name": "amul pure ghee tin", "category": "dairy",
            "subcategory": "ghee", "brand": "Amul", "price_inr": 650,
            "unit": "ml", "unit_quantity": 1000, "rating": 4.8, "in_stock": True,
            "keywords": ["ghee", "pure ghee", "amul ghee", "clarified butter"],
            "tags": ["cooking", "biryani"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-DRY-005", "name": "amul fresh cream", "category": "dairy",
            "subcategory": "cream", "brand": "Amul", "price_inr": 67,
            "unit": "ml", "unit_quantity": 250, "rating": 4.5, "in_stock": True,
            "keywords": ["cream", "fresh cream", "amul cream"],
            "tags": ["cooking"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-DRY-006", "name": "amul taaza fresh milk", "category": "dairy",
            "subcategory": "milk", "brand": "Amul", "price_inr": 28,
            "unit": "ml", "unit_quantity": 500, "rating": 4.7, "in_stock": True,
            "keywords": ["milk", "doodh", "amul milk", "taaza"],
            "tags": ["everyday"],
            "dietary": ["veg"],
        },

        # Oils
        {
            "sku": "MOCK-OIL-001", "name": "fortune sunflower oil lite", "category": "oils",
            "subcategory": "refined oil", "brand": "Fortune", "price_inr": 145,
            "unit": "ml", "unit_quantity": 1000, "rating": 4.4, "in_stock": True,
            "keywords": ["oil", "cooking oil", "sunflower oil", "refined oil", "fortune"],
            "tags": ["everyday", "cooking"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # Beverages
        {
            "sku": "MOCK-BEV-001", "name": "coca cola soft drink", "category": "beverages",
            "subcategory": "soda", "brand": "Coca-Cola", "price_inr": 90,
            "unit": "ml", "unit_quantity": 2000, "rating": 4.5, "in_stock": True,
            "keywords": ["coke", "cola", "soft drink", "coca cola", "soda", "cold drink", "cold drinks"],
            "tags": ["party"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-BEV-002", "name": "red label tea powder", "category": "beverages",
            "subcategory": "tea", "brand": "Red Label", "price_inr": 160,
            "unit": "g", "unit_quantity": 500, "rating": 4.6, "in_stock": True,
            "keywords": ["tea", "chai", "tea powder", "red label"],
            "tags": ["everyday"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-BEV-003", "name": "bisleri water bottle", "category": "beverages",
            "subcategory": "water", "brand": "Bisleri", "price_inr": 20,
            "unit": "ml", "unit_quantity": 1000, "rating": 4.5, "in_stock": True,
            "keywords": ["water", "water bottle", "pani", "mineral water", "bisleri"],
            "tags": ["everyday", "party"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-DSP-001", "name": "paper plates pack of 50", "category": "cleaning",
            "subcategory": "disposables", "brand": "Generic", "price_inr": 80,
            "unit": "pack", "unit_quantity": 1, "rating": 4.0, "in_stock": True,
            "keywords": ["paper plates", "plates", "disposable plates", "party plates"],
            "tags": ["party", "disposable"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-DSP-002", "name": "paper cups pack of 50", "category": "cleaning",
            "subcategory": "disposables", "brand": "Generic", "price_inr": 60,
            "unit": "pack", "unit_quantity": 1, "rating": 4.0, "in_stock": True,
            "keywords": ["paper cups", "cups", "disposable cups", "party cups"],
            "tags": ["party", "disposable"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-DSP-003", "name": "napkins tissue paper pack", "category": "cleaning",
            "subcategory": "disposables", "brand": "Generic", "price_inr": 40,
            "unit": "pack", "unit_quantity": 1, "rating": 4.1, "in_stock": True,
            "keywords": ["napkins", "tissues", "tissue paper", "paper napkins"],
            "tags": ["party", "everyday"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # Snacks
        {
            "sku": "MOCK-SNK-001", "name": "lays potato chips classic salt", "category": "snacks",
            "subcategory": "chips", "brand": "Lays", "price_inr": 20,
            "unit": "g", "unit_quantity": 50, "rating": 4.3, "in_stock": True,
            "keywords": ["lays", "chips", "potato chips", "snacks"],
            "tags": ["party", "snacks"],
            "dietary": ["veg"],
        },
        {
            "sku": "MOCK-SNK-002", "name": "haldirams salted peanuts", "category": "snacks",
            "subcategory": "nuts", "brand": "Haldirams", "price_inr": 40,
            "unit": "g", "unit_quantity": 200, "rating": 4.2, "in_stock": True,
            "keywords": ["peanuts", "singdana", "haldirams", "salted nuts", "snacks"],
            "tags": ["party", "snacks"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # Stationery
        {
            "sku": "MOCK-STN-001", "name": "lexi ballpoint pens pack of 5", "category": "stationery",
            "subcategory": "writing", "brand": "Lexi", "price_inr": 50,
            "unit": "pack", "unit_quantity": 1, "rating": 4.1, "in_stock": True,
            "keywords": ["pen", "pens", "ballpoint pen", "lexi", "writing"],
            "tags": ["school", "office"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-STN-002", "name": "classmate notebook single line", "category": "stationery",
            "subcategory": "paper", "brand": "Classmate", "price_inr": 60,
            "unit": "piece", "unit_quantity": 1, "rating": 4.5, "in_stock": True,
            "keywords": ["notebook", "copy", "register", "classmate", "exercise book"],
            "tags": ["school", "office"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # Tools & Hardware
        {
            "sku": "MOCK-TLS-001", "name": "stanley screwdriver set", "category": "tools_hardware",
            "subcategory": "hand tools", "brand": "Stanley", "price_inr": 450,
            "unit": "piece", "unit_quantity": 1, "rating": 4.3, "in_stock": True,
            "keywords": ["screwdriver", "stanley", "tool set", "repair"],
            "tags": ["diy", "repair"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-TLS-002", "name": "generic adjustable wrench spanner", "category": "tools_hardware",
            "subcategory": "hand tools", "brand": "Generic", "price_inr": 320,
            "unit": "piece", "unit_quantity": 1, "rating": 4.0, "in_stock": True,
            "keywords": ["wrench", "spanner", "adjustable spanner", "plumbing"],
            "tags": ["diy", "repair"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-TLS-003", "name": "generic ptfe thread sealing tape roll", "category": "tools_hardware",
            "subcategory": "plumbing", "brand": "Generic", "price_inr": 35,
            "unit": "piece", "unit_quantity": 1, "rating": 3.8, "in_stock": True,
            "keywords": ["ptfe tape", "teflon tape", "plumbing tape", "leak sealing"],
            "tags": ["diy", "plumbing", "repair"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # Medicines OTC
        {
            "sku": "MOCK-MED-001", "name": "crocin cold n flu paracetamol", "category": "medicines_otc",
            "subcategory": "painkiller", "brand": "Crocin", "price_inr": 30,
            "unit": "pack", "unit_quantity": 1, "rating": 4.7, "in_stock": True,
            "keywords": ["paracetamol", "crocin", "fever medicine", "cold flu", "tablet"],
            "tags": ["health"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # Meat & Poultry
        {
            "sku": "MOCK-MPT-001", "name": "fresho whole chicken", "category": "meat_poultry",
            "subcategory": "chicken", "brand": "Fresho", "price_inr": 219,
            "unit": "g", "unit_quantity": 1000, "rating": 4.3, "in_stock": True,
            "keywords": ["chicken", "murgh", "poultry", "whole chicken", "meat"],
            "tags": ["cooking", "biryani"],
            "dietary": ["non-veg"],
        },

        # More Snacks
        {
            "sku": "MOCK-SNK-003", "name": "act ii classic salted popcorn", "category": "snacks",
            "subcategory": "popcorn", "brand": "Act II", "price_inr": 30,
            "unit": "g", "unit_quantity": 70, "rating": 4.2, "in_stock": True,
            "keywords": ["popcorn", "act ii", "snacks", "movie snack"],
            "tags": ["party", "snacks"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-SNK-004", "name": "haldirams navratan mixture namkeen", "category": "snacks",
            "subcategory": "namkeen", "brand": "Haldirams", "price_inr": 65,
            "unit": "g", "unit_quantity": 200, "rating": 4.4, "in_stock": True,
            "keywords": ["namkeen", "mixture", "haldirams", "navratan", "snacks"],
            "tags": ["party", "snacks"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # More Stationery
        {
            "sku": "MOCK-STN-003", "name": "apsara drawing pencils pack", "category": "stationery",
            "subcategory": "writing", "brand": "Apsara", "price_inr": 30,
            "unit": "pack", "unit_quantity": 1, "rating": 4.3, "in_stock": True,
            "keywords": ["pencil", "pencils", "apsara", "drawing pencils", "writing"],
            "tags": ["school", "office"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-STN-004", "name": "apsara eraser pack", "category": "stationery",
            "subcategory": "accessories", "brand": "Apsara", "price_inr": 15,
            "unit": "pack", "unit_quantity": 5, "rating": 4.0, "in_stock": True,
            "keywords": ["eraser", "rubber", "apsara"],
            "tags": ["school", "office"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-STN-005", "name": "nataraj sharpener metal", "category": "stationery",
            "subcategory": "accessories", "brand": "Nataraj", "price_inr": 10,
            "unit": "piece", "unit_quantity": 1, "rating": 4.1, "in_stock": True,
            "keywords": ["sharpener", "nataraj", "pencil sharpener"],
            "tags": ["school"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-STN-006", "name": "faber castell geometry box", "category": "stationery",
            "subcategory": "geometry", "brand": "Faber-Castell", "price_inr": 185,
            "unit": "piece", "unit_quantity": 1, "rating": 4.5, "in_stock": True,
            "keywords": ["geometry box", "compass", "protractor", "faber castell"],
            "tags": ["school"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-STN-007", "name": "camlin colored pencils set of 12", "category": "stationery",
            "subcategory": "art", "brand": "Camlin", "price_inr": 65,
            "unit": "pack", "unit_quantity": 1, "rating": 4.4, "in_stock": True,
            "keywords": ["colored pencils", "colour pencils", "crayons", "camlin", "art"],
            "tags": ["school", "art"],
            "dietary": ["veg", "vegan", "jain"],
        },

        # Premium spices for biryani
        {
            "sku": "MOCK-SPC-007", "name": "lion brand kashmir saffron", "category": "spices",
            "subcategory": "premium spice", "brand": "Lion", "price_inr": 120,
            "unit": "g", "unit_quantity": 1, "rating": 4.9, "in_stock": True,
            "keywords": ["saffron", "kesar", "zafran", "kashmir saffron"],
            "tags": ["biryani", "premium"],
            "dietary": ["veg", "vegan", "jain"],
        },
        {
            "sku": "MOCK-SPC-008", "name": "whole spices combo bay cardamom cloves cinnamon", "category": "spices",
            "subcategory": "whole spice", "brand": "MDH", "price_inr": 95,
            "unit": "pack", "unit_quantity": 1, "rating": 4.4, "in_stock": True,
            "keywords": ["bay leaves", "cardamom", "cloves", "cinnamon", "whole spices", "tej patta", "elaichi", "laung", "dalchini"],
            "tags": ["biryani", "cooking"],
            "dietary": ["veg", "vegan", "jain"],
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

# ---------------------------------------------------------------------------
# User Preferences (Phase 6)
# ---------------------------------------------------------------------------
_mock_preferences_store: dict[str, dict] = {}

def save_user_preferences(user_id: str, preferences_data: dict, mock_mode: Optional[bool] = None) -> None:
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        _mock_preferences_store[user_id] = preferences_data
        return
    
    table = _get_preferences_table()
    item = json.loads(json.dumps(preferences_data, default=str), parse_float=Decimal)
    item["user_id"] = user_id
    item["last_updated_at"] = datetime.now(timezone.utc).isoformat()
    table.put_item(Item=item)

def get_user_preferences(user_id: str, mock_mode: Optional[bool] = None) -> Optional[dict]:
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        return _mock_preferences_store.get(user_id)
    
    table = _get_preferences_table()
    try:
        response = table.get_item(Key={"user_id": user_id})
        item = response.get("Item")
        if item:
            return _decimal_to_native(item)
    except Exception as e:
        logger.error(f"Error getting preferences for {user_id}: {e}")
    return None

# ---------------------------------------------------------------------------
# User Events (Phase 6)
# ---------------------------------------------------------------------------
_mock_events_store: list[dict] = []

def save_event(event_data: dict, mock_mode: Optional[bool] = None) -> None:
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        _mock_events_store.append(event_data)
        return
    
    table = _get_events_table()
    item = json.loads(json.dumps(event_data, default=str), parse_float=Decimal)
    table.put_item(Item=item)

def get_user_events(user_id: str, event_type: str = "purchase", limit: int = 50, mock_mode: Optional[bool] = None) -> list[dict]:
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        events = [e for e in _mock_events_store if e.get("user_id") == user_id and e.get("event_type") == event_type]
        return sorted(events, key=lambda x: x.get("created_at", ""), reverse=True)[:limit]
    
    table = _get_events_table()
    try:
        response = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id),
            ScanIndexForward=False, # get newest first
            Limit=limit
        )
        items = response.get("Items", [])
        events = _decimal_to_native(items)
        return [e for e in events if e.get("event_type") == event_type]
    except Exception as e:
        logger.error(f"Error getting events for {user_id}: {e}")
        return []

# ---------------------------------------------------------------------------
# Shopper Profiles / Budget Fingerprint (Shopper DNA)
# ---------------------------------------------------------------------------
_mock_shopper_profiles_store: dict[str, dict] = {}


def save_shopper_profile(user_id: str, profile_data: dict, mock_mode: Optional[bool] = None) -> None:
    """Save or update shopper DNA profile."""
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        _mock_shopper_profiles_store[user_id] = profile_data
        return

    table = _get_shopper_profiles_table()
    item = json.loads(json.dumps(profile_data, default=str), parse_float=Decimal)
    item["user_id"] = user_id
    item["last_updated_at"] = datetime.now(timezone.utc).isoformat()
    table.put_item(Item=item)


def get_shopper_profile(user_id: str, mock_mode: Optional[bool] = None) -> Optional[dict]:
    """Retrieve shopper DNA profile for a user."""
    is_mock = MOCK_AWS or (mock_mode if mock_mode is not None else False)
    if is_mock:
        return _mock_shopper_profiles_store.get(user_id)

    table = _get_shopper_profiles_table()
    try:
        response = table.get_item(Key={"user_id": user_id})
        item = response.get("Item")
        if item:
            return _decimal_to_native(item)
    except Exception as e:
        logger.error(f"Error getting shopper profile for {user_id}: {e}")
    return None
