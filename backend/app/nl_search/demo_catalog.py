"""
Unified Demo Catalog for Natural Language Search

Integrates ALL mock catalogs:
- V2 Catalog (562 products): groceries, fashion, accessories, medicines, etc.
- Electronics Catalog (25 products): phones, laptops, headphones, shoes

Total: ~587 products across 30 categories.
Does NOT touch Amazon DynamoDB — all in-memory mock data.
"""

from __future__ import annotations

import logging
from typing import Any
from decimal import Decimal

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Unified product cache
# ---------------------------------------------------------------------------
_UNIFIED_CATALOG: list[dict[str, Any]] | None = None


def _normalize_v2_product(product: dict) -> dict[str, Any]:
    """
    Normalize a V2 catalog product into the unified NL search format.
    
    V2 schema: sku, name, brand, category, subcategory, price_inr, unit,
    unit_quantity, rating, review_count, keywords (list), synonyms (list),
    dietary_tags, allergen_tags, occasion_tags, etc.
    
    Unified schema adds: specs (dict), features (list), tags (list)
    """
    # Convert Decimal to float/int
    price = product.get("price_inr", 0)
    if isinstance(price, Decimal):
        price = float(price)
    price = int(price) if price == int(price) else price
    
    # Build specs dict from available fields
    specs: dict[str, Any] = {}
    if product.get("unit_quantity"):
        uq = product["unit_quantity"]
        if isinstance(uq, Decimal):
            uq = float(uq)
        specs["unit_quantity"] = uq
        specs["unit"] = product.get("unit", "")
    
    # Nutritional specs for food items
    for field in ["calories_per_100", "protein_per_100", "carbs_per_100", 
                  "sugar_per_100", "fat_per_100", "fiber_per_100", "sodium_per_100"]:
        val = product.get(field)
        if val is not None:
            if isinstance(val, Decimal):
                val = float(val)
            specs[field] = val
    
    # Build features list from synonyms + review previews
    features: list[str] = []
    for syn in (product.get("synonyms") or []):
        if isinstance(syn, str):
            features.append(syn)
    for review in (product.get("review_preview") or []):
        if isinstance(review, str):
            features.append(review)
    
    # Build tags list from keywords + dietary + occasion + allergen
    tags: list[str] = []
    for kw in (product.get("keywords") or []):
        if isinstance(kw, str):
            tags.append(kw)
    for dt in (product.get("dietary_tags") or []):
        if isinstance(dt, str):
            tags.append(dt)
    for ot in (product.get("occasion_tags") or []):
        if isinstance(ot, str):
            tags.append(ot)
    for at in (product.get("allergen_tags") or []):
        if isinstance(at, str):
            tags.append(f"allergen:{at}")
    
    # Subcategory in tags
    if product.get("subcategory"):
        tags.append(product["subcategory"])
    
    rating = product.get("rating", 0)
    if isinstance(rating, Decimal):
        rating = float(rating)
    
    return {
        "sku": product.get("sku", ""),
        "name": product.get("name", ""),
        "brand": product.get("brand", ""),
        "category": product.get("category", ""),
        "subcategory": product.get("subcategory", ""),
        "price_inr": int(price),
        "specs": specs,
        "features": features,
        "tags": tags,
        "rating": float(rating),
        "review_count": product.get("review_count", 0),
        "in_stock": product.get("in_stock", True),
        "image_url": product.get("image_url", ""),
        # Keep original fields for grocery-specific matching
        "keywords": list(product.get("keywords") or []),
        "synonyms": list(product.get("synonyms") or []),
        "dietary_tags": list(product.get("dietary_tags") or []),
        "occasion_tags": list(product.get("occasion_tags") or []),
        "unit": product.get("unit", ""),
        "unit_quantity": float(product.get("unit_quantity") or 0),
    }


# ---------------------------------------------------------------------------
# Electronics Demo Products (phones, laptops, headphones, premium shoes)
# ---------------------------------------------------------------------------

ELECTRONICS_PRODUCTS: list[dict[str, Any]] = [
    # =========================================================================
    # SMARTPHONES
    # =========================================================================
    {
        "sku": "PHONE-001",
        "name": "Samsung Galaxy S24 Ultra",
        "brand": "Samsung",
        "category": "smartphone",
        "subcategory": "flagship",
        "price_inr": 124999,
        "specs": {
            "ram_gb": 12, "storage_gb": 256, "battery_mah": 5000,
            "display_inches": 6.8, "camera_mp": 200,
            "processor": "Snapdragon 8 Gen 3", "os": "Android 14", "5g": True,
        },
        "features": ["S Pen", "AI features", "titanium frame", "100x zoom", "gaming"],
        "tags": ["premium", "flagship", "best camera", "stylus", "productivity"],
        "rating": 4.7, "review_count": 2340, "in_stock": True,
        "image_url": "", "keywords": ["phone", "samsung", "galaxy", "android"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "PHONE-002",
        "name": "iPhone 15 Pro Max",
        "brand": "Apple",
        "category": "smartphone",
        "subcategory": "flagship",
        "price_inr": 159900,
        "specs": {
            "ram_gb": 8, "storage_gb": 256, "battery_mah": 4441,
            "display_inches": 6.7, "camera_mp": 48,
            "processor": "A17 Pro", "os": "iOS 17", "5g": True,
        },
        "features": ["titanium design", "action button", "ProRes video", "USB-C"],
        "tags": ["premium", "flagship", "best video", "iOS", "ecosystem"],
        "rating": 4.8, "review_count": 3100, "in_stock": True,
        "image_url": "", "keywords": ["phone", "iphone", "apple", "ios"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "PHONE-003",
        "name": "OnePlus 12",
        "brand": "OnePlus",
        "category": "smartphone",
        "subcategory": "flagship",
        "price_inr": 64999,
        "specs": {
            "ram_gb": 12, "storage_gb": 256, "battery_mah": 5400,
            "display_inches": 6.82, "camera_mp": 50,
            "processor": "Snapdragon 8 Gen 3", "os": "Android 14", "5g": True,
        },
        "features": ["Hasselblad camera", "100W fast charging", "alert slider"],
        "tags": ["flagship killer", "fast charging", "gaming", "value flagship"],
        "rating": 4.6, "review_count": 1850, "in_stock": True,
        "image_url": "", "keywords": ["phone", "oneplus", "android", "fast charge"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "PHONE-004",
        "name": "Samsung Galaxy A54 5G",
        "brand": "Samsung",
        "category": "smartphone",
        "subcategory": "mid-range",
        "price_inr": 32999,
        "specs": {
            "ram_gb": 8, "storage_gb": 128, "battery_mah": 5000,
            "display_inches": 6.4, "camera_mp": 50,
            "processor": "Exynos 1380", "os": "Android 13", "5g": True,
        },
        "features": ["water resistant", "4 years updates", "Super AMOLED"],
        "tags": ["mid-range", "value", "5G", "long support", "water resistant"],
        "rating": 4.4, "review_count": 4200, "in_stock": True,
        "image_url": "", "keywords": ["phone", "samsung", "galaxy", "5g", "mid-range"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "PHONE-005",
        "name": "Realme Narzo 60 5G",
        "brand": "Realme",
        "category": "smartphone",
        "subcategory": "budget",
        "price_inr": 14999,
        "specs": {
            "ram_gb": 8, "storage_gb": 128, "battery_mah": 5000,
            "display_inches": 6.4, "camera_mp": 64,
            "processor": "Dimensity 6020", "os": "Android 13", "5g": True,
        },
        "features": ["33W fast charging", "dynamic island", "smooth display"],
        "tags": ["budget", "5G", "value", "battery", "gaming entry"],
        "rating": 4.2, "review_count": 5600, "in_stock": True,
        "image_url": "", "keywords": ["phone", "realme", "budget", "5g"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "PHONE-006",
        "name": "Poco X5 Pro 5G",
        "brand": "Poco",
        "category": "smartphone",
        "subcategory": "budget",
        "price_inr": 18999,
        "specs": {
            "ram_gb": 8, "storage_gb": 256, "battery_mah": 5000,
            "display_inches": 6.67, "camera_mp": 108,
            "processor": "Snapdragon 778G", "os": "Android 12", "5g": True,
        },
        "features": ["108MP camera", "67W turbo charging", "120Hz AMOLED"],
        "tags": ["budget flagship", "gaming", "camera", "value champion"],
        "rating": 4.3, "review_count": 8900, "in_stock": True,
        "image_url": "", "keywords": ["phone", "poco", "xiaomi", "budget"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "PHONE-007",
        "name": "Redmi Note 13 Pro+ 5G",
        "brand": "Redmi",
        "category": "smartphone",
        "subcategory": "mid-range",
        "price_inr": 29999,
        "specs": {
            "ram_gb": 8, "storage_gb": 256, "battery_mah": 5000,
            "display_inches": 6.67, "camera_mp": 200,
            "processor": "Dimensity 7200 Ultra", "os": "Android 14", "5g": True,
        },
        "features": ["200MP camera", "120W charging", "curved display", "IP68"],
        "tags": ["mid-range", "camera king", "fast charging", "premium design"],
        "rating": 4.5, "review_count": 3400, "in_stock": True,
        "image_url": "", "keywords": ["phone", "redmi", "xiaomi", "camera"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },

    # =========================================================================
    # LAPTOPS
    # =========================================================================
    {
        "sku": "LAPTOP-001",
        "name": "MacBook Air M3",
        "brand": "Apple",
        "category": "laptop",
        "subcategory": "ultrabook",
        "price_inr": 114900,
        "specs": {
            "ram_gb": 8, "storage_gb": 256, "display_inches": 13.6,
            "processor": "Apple M3", "battery_hours": 18, "weight_kg": 1.24,
        },
        "features": ["fanless", "Retina display", "MagSafe", "all-day battery"],
        "tags": ["ultrabook", "premium", "portable", "silent", "productivity", "coding"],
        "rating": 4.8, "review_count": 1200, "in_stock": True,
        "image_url": "", "keywords": ["laptop", "macbook", "apple", "ultrabook"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "LAPTOP-002",
        "name": "HP Pavilion 15 (2024)",
        "brand": "HP",
        "category": "laptop",
        "subcategory": "mainstream",
        "price_inr": 54999,
        "specs": {
            "ram_gb": 16, "storage_gb": 512, "display_inches": 15.6,
            "processor": "Intel Core i5-1335U", "battery_hours": 8, "weight_kg": 1.75,
        },
        "features": ["backlit keyboard", "FHD IPS", "fingerprint reader"],
        "tags": ["mainstream", "office", "student", "coding", "value"],
        "rating": 4.3, "review_count": 2800, "in_stock": True,
        "image_url": "", "keywords": ["laptop", "hp", "pavilion", "office"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "LAPTOP-003",
        "name": "Lenovo IdeaPad Slim 3",
        "brand": "Lenovo",
        "category": "laptop",
        "subcategory": "budget",
        "price_inr": 34999,
        "specs": {
            "ram_gb": 8, "storage_gb": 256, "display_inches": 15.6,
            "processor": "AMD Ryzen 5 5500U", "battery_hours": 7, "weight_kg": 1.65,
        },
        "features": ["thin and light", "Dolby Audio", "rapid charge"],
        "tags": ["budget", "student", "lightweight", "AMD", "value", "coding"],
        "rating": 4.1, "review_count": 5400, "in_stock": True,
        "image_url": "", "keywords": ["laptop", "lenovo", "ideapad", "budget"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "LAPTOP-004",
        "name": "ASUS ROG Strix G16",
        "brand": "ASUS",
        "category": "laptop",
        "subcategory": "gaming",
        "price_inr": 109990,
        "specs": {
            "ram_gb": 16, "storage_gb": 1024, "display_inches": 16,
            "processor": "Intel Core i7-13650HX", "gpu": "RTX 4060",
            "battery_hours": 5, "weight_kg": 2.5,
        },
        "features": ["165Hz display", "RGB keyboard", "MUX switch", "advanced cooling"],
        "tags": ["gaming", "high performance", "RGB", "esports", "RTX"],
        "rating": 4.6, "review_count": 980, "in_stock": True,
        "image_url": "", "keywords": ["laptop", "asus", "rog", "gaming", "rtx"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "LAPTOP-005",
        "name": "Dell Inspiron 15",
        "brand": "Dell",
        "category": "laptop",
        "subcategory": "mainstream",
        "price_inr": 45999,
        "specs": {
            "ram_gb": 8, "storage_gb": 512, "display_inches": 15.6,
            "processor": "Intel Core i5-1235U", "battery_hours": 6, "weight_kg": 1.8,
        },
        "features": ["ComfortView display", "Dell Mobile Connect"],
        "tags": ["mainstream", "office", "reliable", "coding", "student"],
        "rating": 4.2, "review_count": 3600, "in_stock": True,
        "image_url": "", "keywords": ["laptop", "dell", "inspiron", "office"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "LAPTOP-006",
        "name": "Acer Nitro V Gaming Laptop",
        "brand": "Acer",
        "category": "laptop",
        "subcategory": "gaming",
        "price_inr": 67990,
        "specs": {
            "ram_gb": 16, "storage_gb": 512, "display_inches": 15.6,
            "processor": "Intel Core i5-13420H", "gpu": "RTX 4050",
            "battery_hours": 4, "weight_kg": 2.3,
        },
        "features": ["144Hz display", "dual fan cooling", "killer WiFi"],
        "tags": ["gaming", "budget gaming", "entry gaming", "RTX"],
        "rating": 4.3, "review_count": 1500, "in_stock": True,
        "image_url": "", "keywords": ["laptop", "acer", "nitro", "gaming", "rtx"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },

    # =========================================================================
    # HEADPHONES
    # =========================================================================
    {
        "sku": "HP-001",
        "name": "Sony WH-1000XM5",
        "brand": "Sony",
        "category": "headphones",
        "subcategory": "over-ear",
        "price_inr": 29990,
        "specs": {
            "driver_mm": 30, "battery_hours": 30, "weight_g": 250,
            "noise_cancellation": True, "wireless": True,
        },
        "features": ["industry-leading ANC", "multipoint", "speak-to-chat", "LDAC"],
        "tags": ["premium", "ANC", "wireless", "travel", "work from home"],
        "rating": 4.7, "review_count": 4500, "in_stock": True,
        "image_url": "", "keywords": ["headphone", "sony", "anc", "wireless"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "HP-002",
        "name": "Apple AirPods Pro 2",
        "brand": "Apple",
        "category": "headphones",
        "subcategory": "earbuds",
        "price_inr": 24900,
        "specs": {
            "battery_hours": 6, "battery_case_hours": 30, "weight_g": 5.3,
            "noise_cancellation": True, "wireless": True,
        },
        "features": ["adaptive transparency", "spatial audio", "MagSafe case", "H2 chip"],
        "tags": ["premium", "ANC", "earbuds", "Apple ecosystem", "compact"],
        "rating": 4.8, "review_count": 6200, "in_stock": True,
        "image_url": "", "keywords": ["headphone", "earbuds", "apple", "airpods"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "HP-003",
        "name": "boAt Rockerz 550",
        "brand": "boAt",
        "category": "headphones",
        "subcategory": "over-ear",
        "price_inr": 1499,
        "specs": {
            "driver_mm": 50, "battery_hours": 20, "weight_g": 210,
            "noise_cancellation": False, "wireless": True,
        },
        "features": ["physical noise isolation", "soft padded earcups", "aux support"],
        "tags": ["budget", "wireless", "bass", "casual", "gym"],
        "rating": 4.1, "review_count": 45000, "in_stock": True,
        "image_url": "", "keywords": ["headphone", "boat", "wireless", "budget"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "HP-004",
        "name": "JBL Tune 760NC",
        "brand": "JBL",
        "category": "headphones",
        "subcategory": "over-ear",
        "price_inr": 4999,
        "specs": {
            "driver_mm": 40, "battery_hours": 35, "weight_g": 240,
            "noise_cancellation": True, "wireless": True,
        },
        "features": ["active noise cancellation", "JBL Pure Bass", "foldable", "multipoint"],
        "tags": ["mid-range", "ANC", "value ANC", "long battery", "travel"],
        "rating": 4.3, "review_count": 8900, "in_stock": True,
        "image_url": "", "keywords": ["headphone", "jbl", "anc", "wireless"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "HP-005",
        "name": "OnePlus Buds Pro 2",
        "brand": "OnePlus",
        "category": "headphones",
        "subcategory": "earbuds",
        "price_inr": 11999,
        "specs": {
            "battery_hours": 6, "battery_case_hours": 39, "weight_g": 4.9,
            "noise_cancellation": True, "wireless": True,
        },
        "features": ["spatial audio", "LHDC 5.0", "dual drivers", "adaptive ANC"],
        "tags": ["mid-range", "ANC", "earbuds", "Android", "OnePlus ecosystem"],
        "rating": 4.4, "review_count": 2100, "in_stock": True,
        "image_url": "", "keywords": ["headphone", "earbuds", "oneplus", "anc"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "HP-006",
        "name": "Noise Buds VS104",
        "brand": "Noise",
        "category": "headphones",
        "subcategory": "earbuds",
        "price_inr": 999,
        "specs": {
            "battery_hours": 7, "battery_case_hours": 45, "weight_g": 4,
            "noise_cancellation": False, "wireless": True,
        },
        "features": ["Hyper Sync", "touch controls", "IPX5", "voice assistant"],
        "tags": ["budget", "earbuds", "gym", "value", "daily use"],
        "rating": 3.9, "review_count": 52000, "in_stock": True,
        "image_url": "", "keywords": ["headphone", "earbuds", "noise", "budget"],
        "synonyms": [], "dietary_tags": [], "occasion_tags": [],
        "unit": "piece", "unit_quantity": 1,
    },

    # =========================================================================
    # PREMIUM SHOES (supplements footwear in V2 catalog)
    # =========================================================================
    {
        "sku": "SHOE-001",
        "name": "Nike Air Zoom Pegasus 40",
        "brand": "Nike",
        "category": "footwear",
        "subcategory": "running",
        "price_inr": 11495,
        "specs": {"weight_g": 272, "drop_mm": 10, "cushioning": "medium"},
        "features": ["Zoom Air unit", "breathable mesh", "responsive cushioning"],
        "tags": ["running", "daily trainer", "neutral", "marathon prep", "premium"],
        "rating": 4.6, "review_count": 3200, "in_stock": True,
        "image_url": "", "keywords": ["shoes", "nike", "running", "sports"],
        "synonyms": ["joote", "running shoes"], "dietary_tags": [], "occasion_tags": ["sports", "gym"],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "SHOE-002",
        "name": "Adidas Ultraboost Light",
        "brand": "Adidas",
        "category": "footwear",
        "subcategory": "running",
        "price_inr": 15999,
        "specs": {"weight_g": 280, "drop_mm": 10, "cushioning": "high"},
        "features": ["BOOST midsole", "Primeknit upper", "Continental rubber"],
        "tags": ["running", "premium", "comfort", "lifestyle", "daily wear"],
        "rating": 4.7, "review_count": 2800, "in_stock": True,
        "image_url": "", "keywords": ["shoes", "adidas", "running", "boost"],
        "synonyms": ["joote", "running shoes"], "dietary_tags": [], "occasion_tags": ["sports", "gym"],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "SHOE-003",
        "name": "Puma Softride Rift",
        "brand": "Puma",
        "category": "footwear",
        "subcategory": "running",
        "price_inr": 2999,
        "specs": {"weight_g": 240, "drop_mm": 8, "cushioning": "soft"},
        "features": ["SoftFoam+ sockliner", "ultra-lightweight", "slip-on feel"],
        "tags": ["budget", "running", "casual", "gym", "value"],
        "rating": 4.2, "review_count": 6500, "in_stock": True,
        "image_url": "", "keywords": ["shoes", "puma", "running", "budget"],
        "synonyms": ["joote", "running shoes"], "dietary_tags": [], "occasion_tags": ["sports", "gym"],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "SHOE-004",
        "name": "ASICS Gel-Kayano 30",
        "brand": "ASICS",
        "category": "footwear",
        "subcategory": "running",
        "price_inr": 16999,
        "specs": {"weight_g": 305, "drop_mm": 10, "cushioning": "high", "stability": True},
        "features": ["GEL technology", "4D Guidance System", "PureGEL", "stability"],
        "tags": ["running", "stability", "overpronation", "marathon", "premium"],
        "rating": 4.8, "review_count": 1900, "in_stock": True,
        "image_url": "", "keywords": ["shoes", "asics", "running", "stability"],
        "synonyms": ["joote", "running shoes"], "dietary_tags": [], "occasion_tags": ["sports", "gym"],
        "unit": "piece", "unit_quantity": 1,
    },
    {
        "sku": "SHOE-005",
        "name": "Skechers Go Walk 6",
        "brand": "Skechers",
        "category": "footwear",
        "subcategory": "walking",
        "price_inr": 4999,
        "specs": {"weight_g": 200, "drop_mm": 6, "cushioning": "ultra-soft"},
        "features": ["Ultra Go cushioning", "Air-Cooled Goga Mat", "slip-on"],
        "tags": ["walking", "comfort", "senior friendly", "casual", "travel"],
        "rating": 4.5, "review_count": 8200, "in_stock": True,
        "image_url": "", "keywords": ["shoes", "skechers", "walking", "comfort"],
        "synonyms": ["joote", "walking shoes"], "dietary_tags": [], "occasion_tags": ["casual"],
        "unit": "piece", "unit_quantity": 1,
    },
]


# ---------------------------------------------------------------------------
# Load & merge catalogs
# ---------------------------------------------------------------------------

def _load_unified_catalog() -> list[dict[str, Any]]:
    """
    Load and merge ALL mock catalogs into one unified list.
    Order: V2 catalog (562 products) + Electronics (25 products).
    Does NOT touch DynamoDB.
    """
    all_products: list[dict[str, Any]] = []
    
    # 1. Load V2 catalog (groceries, fashion, etc.)
    try:
        from seed_catalog_v2 import get_all_v2_products
        v2_products = get_all_v2_products()
        for p in v2_products:
            all_products.append(_normalize_v2_product(p))
        logger.info(f"[NL Search] Loaded V2 catalog: {len(v2_products)} products")
    except Exception as e:
        logger.warning(f"[NL Search] Could not load V2 catalog: {e}")
    
    # 2. Add electronics products (avoid duplicates by SKU)
    existing_skus = {p["sku"] for p in all_products}
    electronics_added = 0
    for p in ELECTRONICS_PRODUCTS:
        if p["sku"] not in existing_skus:
            all_products.append(p)
            electronics_added += 1
    logger.info(f"[NL Search] Added {electronics_added} electronics products")
    
    logger.info(f"[NL Search] Total unified catalog: {len(all_products)} products")
    return all_products


def get_unified_catalog() -> list[dict[str, Any]]:
    """Get the unified catalog (cached after first load)."""
    global _UNIFIED_CATALOG
    if _UNIFIED_CATALOG is None:
        _UNIFIED_CATALOG = _load_unified_catalog()
    return _UNIFIED_CATALOG


def get_products_by_category(category: str) -> list[dict[str, Any]]:
    """Filter products by category."""
    catalog = get_unified_catalog()
    return [p for p in catalog if p["category"].lower() == category.lower()]


def get_product_by_sku(sku: str) -> dict[str, Any] | None:
    """Get a single product by SKU."""
    for p in get_unified_catalog():
        if p["sku"] == sku:
            return p
    return None


def get_catalog_stats() -> dict[str, Any]:
    """Get catalog statistics."""
    catalog = get_unified_catalog()
    categories: dict[str, int] = {}
    brands: set[str] = set()
    min_price = float("inf")
    max_price = 0
    
    for product in catalog:
        cat = product["category"]
        categories[cat] = categories.get(cat, 0) + 1
        brands.add(product["brand"])
        price = product.get("price_inr", 0)
        if price > 0:
            min_price = min(min_price, price)
            max_price = max(max_price, price)
    
    return {
        "total_products": len(catalog),
        "categories": categories,
        "category_count": len(categories),
        "price_range": {"min": int(min_price), "max": int(max_price)},
        "brands": sorted(brands),
        "brand_count": len(brands),
    }


# Backward compatibility
DEMO_PRODUCTS = ELECTRONICS_PRODUCTS  # Legacy reference
