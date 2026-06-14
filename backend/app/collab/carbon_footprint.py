"""Carbon scoring for collaborative carts.

The calculator uses catalog fields first and falls back to deterministic demo
metadata when the live catalog does not yet have origin/weight attributes.
"""

from __future__ import annotations

from app.collab.models import CarbonAlternative, CarbonCartBreakdown, CarbonItemBreakdown, CollabCartItem
from app.db.dynamo import get_all_products

EMISSION_FACTOR_KG_PER_KG_KM = 0.00021

CATEGORY_DEFAULTS = {
    "dairy": {"origin_city": "Sonipat", "distance_km": 45, "weight_kg": 0.5},
    "grains": {"origin_city": "Dehradun", "distance_km": 250, "weight_kg": 1.0},
    "pulses": {"origin_city": "Indore", "distance_km": 800, "weight_kg": 1.0},
    "oils": {"origin_city": "Jaipur", "distance_km": 280, "weight_kg": 1.0},
    "snacks": {"origin_city": "Noida", "distance_km": 35, "weight_kg": 0.2},
    "beverages": {"origin_city": "Gurugram", "distance_km": 30, "weight_kg": 1.0},
    "stationery": {"origin_city": "Delhi", "distance_km": 12, "weight_kg": 0.2},
    "cleaning": {"origin_city": "Ghaziabad", "distance_km": 28, "weight_kg": 1.0},
    "general": {"origin_city": "Delhi", "distance_km": 20, "weight_kg": 0.5},
}


def _category_key(value: str) -> str:
    normalized = (value or "general").strip().lower()
    if normalized in CATEGORY_DEFAULTS:
        return normalized
    if normalized in {"food", "grocery", "groceries", "bakery"}:
        return "general"
    return normalized


def _estimate_weight_kg(item: CollabCartItem, product: dict | None = None) -> float:
    if product and product.get("weight_kg"):
        return float(product["weight_kg"])

    unit = item.unit.lower()
    per_unit = item.unit_quantity
    if unit == "kg":
        return per_unit
    if unit == "g":
        return per_unit / 1000
    if unit in {"l", "litre", "liter"}:
        return per_unit
    if unit == "ml":
        return per_unit / 1000

    category_default = CATEGORY_DEFAULTS.get(_category_key(item.category), CATEGORY_DEFAULTS["general"])
    return float(category_default["weight_kg"])


def compute_item_carbon(item: CollabCartItem, product: dict | None = None) -> tuple[float, str, float]:
    category_default = CATEGORY_DEFAULTS.get(_category_key(item.category), CATEGORY_DEFAULTS["general"])
    origin = str((product or {}).get("origin_city") or category_default["origin_city"])
    distance_km = float((product or {}).get("distance_km") or category_default["distance_km"])
    weight_kg = _estimate_weight_kg(item, product)
    co2 = weight_kg * item.quantity * distance_km * EMISSION_FACTOR_KG_PER_KG_KM
    return round(co2, 3), origin, distance_km


def _find_local_alternative(item: CollabCartItem, products: list[dict]) -> CarbonAlternative | None:
    current_default = CATEGORY_DEFAULTS.get(_category_key(item.category), CATEGORY_DEFAULTS["general"])
    current_distance = float(current_default["distance_km"])
    current_product = next((product for product in products if product.get("sku") == item.sku), None)
    if current_product:
        current_distance = float(current_product.get("distance_km") or current_distance)

    alternatives = []
    for product in products:
        if product.get("sku") == item.sku or not product.get("in_stock", True):
            continue
        if str(product.get("subcategory", "")).lower() != str(item.category).lower() and str(product.get("category", "")).lower() != str(item.category).lower():
            continue
        distance = float(product.get("distance_km") or CATEGORY_DEFAULTS.get(_category_key(product.get("category", "")), CATEGORY_DEFAULTS["general"])["distance_km"])
        if distance + 50 < current_distance:
            alternatives.append((distance, product))

    if not alternatives:
        return None

    local_distance, local_product = min(alternatives, key=lambda entry: entry[0])
    savings_km = current_distance - local_distance
    savings_co2 = _estimate_weight_kg(item, current_product) * item.quantity * savings_km * EMISSION_FACTOR_KG_PER_KG_KM
    return CarbonAlternative(
        sku=item.sku,
        name=item.name,
        local_alt_sku=local_product["sku"],
        local_alt_name=local_product.get("name", local_product.get("title", "Local alternative")),
        savings_km=round(savings_km, 1),
        savings_co2_kg=round(savings_co2, 3),
    )


def compute_cart_carbon(items: list[CollabCartItem]) -> CarbonCartBreakdown:
    products = get_all_products()
    by_sku = {product.get("sku"): product for product in products}
    breakdown_items: list[CarbonItemBreakdown] = []
    suggestions: list[CarbonAlternative] = []

    for item in items:
        product = by_sku.get(item.sku)
        co2, origin, distance = compute_item_carbon(item, product)
        item.carbon_co2_kg = co2
        item.carbon_origin = origin
        item.local_carbon_alternative = None

        alternative = _find_local_alternative(item, products)
        if alternative:
            item.local_carbon_alternative = alternative.model_dump()
            suggestions.append(alternative)

        breakdown_items.append(
            CarbonItemBreakdown(
                sku=item.sku,
                name=item.name,
                co2_kg=co2,
                origin=origin,
                distance_km=distance,
            )
        )

    return CarbonCartBreakdown(
        total_co2_kg=round(sum(item.co2_kg for item in breakdown_items), 3),
        items=breakdown_items,
        suggestions=suggestions,
    )
