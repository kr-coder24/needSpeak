"""
Unit conversion lookup table for normalizing recipe quantities
to product catalog base units (grams for weight, milliliters for volume).

Used by the SKU resolver to calculate how many product units to add to cart.
"""

# Each entry maps a recipe unit to a base unit (g or ml) with a conversion factor.
# "context" is optional — used when the same unit has different meanings
# depending on the ingredient (e.g., "head" of garlic vs cauliflower).
UNIT_CONVERSIONS = {
    # ─── Volume ───────────────────────────────────────────────────────
    "cup": {"to": "ml", "factor": 240},
    "cups": {"to": "ml", "factor": 240},
    "tbsp": {"to": "ml", "factor": 15},
    "tablespoon": {"to": "ml", "factor": 15},
    "tablespoons": {"to": "ml", "factor": 15},
    "tsp": {"to": "ml", "factor": 5},
    "teaspoon": {"to": "ml", "factor": 5},
    "teaspoons": {"to": "ml", "factor": 5},
    "litre": {"to": "ml", "factor": 1000},
    "litres": {"to": "ml", "factor": 1000},
    "liter": {"to": "ml", "factor": 1000},
    "liters": {"to": "ml", "factor": 1000},
    "l": {"to": "ml", "factor": 1000},
    "gallon": {"to": "ml", "factor": 3785},
    "gallons": {"to": "ml", "factor": 3785},
    "pint": {"to": "ml", "factor": 473},
    "pints": {"to": "ml", "factor": 473},
    "fl_oz": {"to": "ml", "factor": 30},
    "fluid_ounce": {"to": "ml", "factor": 30},
    "ml": {"to": "ml", "factor": 1},
    "milliliter": {"to": "ml", "factor": 1},
    "millilitre": {"to": "ml", "factor": 1},
    "dash": {"to": "ml", "factor": 1},
    "drop": {"to": "ml", "factor": 0.05},
    "drops": {"to": "ml", "factor": 0.05},
    "can": {"to": "ml", "factor": 400},
    "cans": {"to": "ml", "factor": 400},

    # ─── Weight ───────────────────────────────────────────────────────
    "kg": {"to": "g", "factor": 1000},
    "kilogram": {"to": "g", "factor": 1000},
    "kilograms": {"to": "g", "factor": 1000},
    "g": {"to": "g", "factor": 1},
    "gram": {"to": "g", "factor": 1},
    "grams": {"to": "g", "factor": 1},
    "gm": {"to": "g", "factor": 1},
    "pound": {"to": "g", "factor": 454},
    "pounds": {"to": "g", "factor": 454},
    "lb": {"to": "g", "factor": 454},
    "lbs": {"to": "g", "factor": 454},
    "oz": {"to": "g", "factor": 28},
    "ounce": {"to": "g", "factor": 28},
    "ounces": {"to": "g", "factor": 28},
    "pinch": {"to": "g", "factor": 0.5},
    "handful": {"to": "g", "factor": 30},
    "handfuls": {"to": "g", "factor": 30},

    # ─── Cooking-specific (approximate equivalents) ───────────────────
    "clove": {"to": "g", "factor": 5, "context": "garlic"},
    "cloves": {"to": "g", "factor": 5, "context": "garlic"},
    "large_egg": {"to": "g", "factor": 60},
    "egg": {"to": "g", "factor": 55},
    "eggs": {"to": "g", "factor": 55},
    "medium_onion": {"to": "g", "factor": 150},
    "large_onion": {"to": "g", "factor": 200},
    "small_onion": {"to": "g", "factor": 80},
    "onion": {"to": "g", "factor": 150},
    "onions": {"to": "g", "factor": 150},
    "medium_potato": {"to": "g", "factor": 150},
    "potato": {"to": "g", "factor": 150},
    "potatoes": {"to": "g", "factor": 150},
    "medium_tomato": {"to": "g", "factor": 120},
    "tomato": {"to": "g", "factor": 120},
    "tomatoes": {"to": "g", "factor": 120},
    "bunch": {"to": "g", "factor": 100},
    "bunches": {"to": "g", "factor": 100},
    "sprig": {"to": "g", "factor": 2},
    "sprigs": {"to": "g", "factor": 2},
    "head": {"to": "g", "factor": 300, "context": "cauliflower"},
    "knob": {"to": "g", "factor": 15, "context": "ginger"},
    "slice": {"to": "g", "factor": 30, "context": "bread"},
    "slices": {"to": "g", "factor": 30, "context": "bread"},
    "stick": {"to": "g", "factor": 113, "context": "butter"},
    "sticks": {"to": "g", "factor": 113, "context": "butter"},
    "leaf": {"to": "g", "factor": 0.5},
    "leaves": {"to": "g", "factor": 0.5},
    "pod": {"to": "g", "factor": 1},
    "pods": {"to": "g", "factor": 1},
    "inch": {"to": "g", "factor": 10, "context": "ginger_cinnamon"},

    # ─── Countable (treated as pieces) ────────────────────────────────
    "piece": {"to": "piece", "factor": 1},
    "pieces": {"to": "piece", "factor": 1},
    "pack": {"to": "pack", "factor": 1},
    "packs": {"to": "pack", "factor": 1},
    "packet": {"to": "pack", "factor": 1},
    "packets": {"to": "pack", "factor": 1},
    "bottle": {"to": "piece", "factor": 1},
    "bottles": {"to": "piece", "factor": 1},
    "sachet": {"to": "pack", "factor": 1},
    "sachets": {"to": "pack", "factor": 1},
    "dozen": {"to": "piece", "factor": 12},
    "box": {"to": "piece", "factor": 1},
    "set": {"to": "piece", "factor": 1},
    "roll": {"to": "piece", "factor": 1},
    "rolls": {"to": "piece", "factor": 1},
    "tablet": {"to": "piece", "factor": 1},
    "tablets": {"to": "piece", "factor": 1},
}


def normalize_to_base_unit(quantity: float, unit: str, item_name: str = "") -> tuple:
    """
    Convert a recipe quantity + unit to a base unit amount.

    Args:
        quantity: The numeric quantity from the recipe (e.g., 2)
        unit: The unit string from the recipe (e.g., "cup", "cloves")
        item_name: The ingredient name, used for context-aware conversions

    Returns:
        tuple: (converted_amount, base_unit)
               e.g., (480.0, "ml") for 2 cups
               Returns (quantity, unit) unchanged if unit is not recognized.
    """
    unit_lower = unit.lower().strip().replace(" ", "_")
    item_lower = item_name.lower().strip()

    conversion = UNIT_CONVERSIONS.get(unit_lower)

    if conversion is None:
        # Try without trailing 's' for plurals we might have missed
        if unit_lower.endswith("s") and len(unit_lower) > 2:
            conversion = UNIT_CONVERSIONS.get(unit_lower[:-1])

    if conversion is None:
        # Unit not found — return as-is, resolver will handle it
        return (quantity, unit_lower if unit_lower else "piece")

    base_unit = conversion["to"]
    factor = conversion["factor"]

    return (quantity * factor, base_unit)


def get_compatible_base_unit(product_unit: str) -> str:
    """
    Map a product's unit to its base unit type for comparison.
    Products store units as 'g', 'ml', 'piece', 'pack'.
    """
    return product_unit.lower().strip()
