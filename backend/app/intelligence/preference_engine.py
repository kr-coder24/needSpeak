"""
Preference Engine — Apply user dietary/brand/budget preferences to extraction results.

Runs as a post-processing step after LLM extraction and before SKU resolution.
Filters items based on dietary restrictions, replaces brands with preferred ones,
and adjusts budget mode.

Person C owns this file.
"""

from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel, Field

from app.models import ExtractionResult, ExtractedItem, ExtractedIntent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Preference Models
# ---------------------------------------------------------------------------
class UserPreferences(BaseModel):
    """User-controlled shopping preferences."""
    dietary: list[str] = Field(
        default_factory=list,
        description="Dietary restrictions: veg, vegan, jain, gluten_free, etc."
    )
    preferred_brands: list[str] = Field(
        default_factory=list,
        description="Preferred brand names, e.g. ['Amul', 'Tata', 'Fortune']"
    )
    avoided_brands: list[str] = Field(
        default_factory=list,
        description="Brands to avoid, e.g. ['Patanjali']"
    )
    budget_mode: str = Field(
        default="balanced",
        description="Budget style: value, balanced, premium"
    )
    allergies: list[str] = Field(
        default_factory=list,
        description="Allergens to avoid: nuts, gluten, dairy, soy, etc."
    )
    favorite_skus: list[str] = Field(
        default_factory=list,
        description="SKUs of frequently purchased items"
    )
    preferred_categories: list[str] = Field(
        default_factory=list,
        description="Categories/subcategories to boost, e.g. snacks, cleaning, stationery."
    )
    avoided_categories: list[str] = Field(
        default_factory=list,
        description="Categories/subcategories to avoid or penalize."
    )
    quality_preference: str = Field(
        default="balanced",
        description="Product quality preference: value, balanced, quality."
    )
    pack_size_preference: str = Field(
        default="balanced",
        description="Pack-size behavior: small, balanced, bulk."
    )


# ---------------------------------------------------------------------------
# Non-vegetarian items (used for dietary filtering)
# ---------------------------------------------------------------------------
NON_VEG_KEYWORDS = {
    "chicken", "mutton", "lamb", "beef", "pork", "fish", "prawn", "shrimp",
    "crab", "lobster", "squid", "egg", "eggs", "meat", "bacon", "sausage",
    "salami", "ham", "turkey", "duck", "goat", "keema", "kebab", "tikka",
    "tandoori chicken", "butter chicken", "fish fry", "egg curry",
}

NON_VEGAN_KEYWORDS = NON_VEG_KEYWORDS | {
    "milk", "cream", "cheese", "paneer", "butter", "ghee", "curd", "yogurt",
    "dahi", "whey", "casein", "honey", "gelatin",
}

JAIN_EXCLUDED_KEYWORDS = NON_VEG_KEYWORDS | {
    "onion", "onions", "garlic", "potato", "potatoes", "carrot", "carrots",
    "beetroot", "radish", "turnip", "ginger", "mushroom", "mushrooms",
}

ALLERGY_KEYWORDS = {
    "nuts": {"almond", "almonds", "cashew", "cashews", "peanut", "peanuts", "walnut", "walnuts", "pistachio", "pistachios", "hazelnut", "hazelnuts", "mixed nuts", "dry fruits"},
    "gluten": {"wheat", "atta", "maida", "bread", "roti", "naan", "pasta", "noodles", "semolina", "suji", "sooji", "barley", "rye", "oats"},
    "dairy": {"milk", "cream", "cheese", "paneer", "butter", "ghee", "curd", "yogurt", "dahi", "whey"},
    "soy": {"soy", "soya", "tofu", "soy sauce", "soy milk", "edamame"},
}


# ---------------------------------------------------------------------------
# Core Functions
# ---------------------------------------------------------------------------
def build_implicit_preferences(user_events: list[dict]) -> UserPreferences:
    """Analyze purchase events to build implicit brand, category preferences and favorite SKUs."""
    from app.db.dynamo import get_product_by_sku
    from collections import Counter
    
    brand_counts = Counter()
    category_counts = Counter()
    sku_counts = Counter()
    for event in user_events:
        sku = event.get("sku")
        if sku:
            sku_counts[sku] += 1
            product = get_product_by_sku(sku)
            if product and "brand" in product and product["brand"].lower() not in ("generic", "fresh"):
                brand_counts[product["brand"]] += 1
            if product:
                category = product.get("subcategory") or product.get("category")
                if category:
                    category_counts[str(category)] += 1
                
    # Threshold: at least 2 purchases to become preferred
    preferred_brands = [brand for brand, count in brand_counts.items() if count >= 2]
    preferred_categories = [category for category, count in category_counts.items() if count >= 2]
    favorite_skus = [sku for sku, count in sku_counts.items() if count >= 2]
    
    if preferred_brands or preferred_categories or favorite_skus:
        logger.info(
            "Implicit preferences from %s events: brands=%s categories=%s skus=%s",
            len(user_events),
            preferred_brands,
            preferred_categories,
            favorite_skus
        )
        
    return UserPreferences(
        preferred_brands=preferred_brands,
        preferred_categories=preferred_categories,
        favorite_skus=favorite_skus
    )


def apply_preferences(
    extraction: ExtractionResult,
    preferences: UserPreferences,
    implicit_preferences: Optional[UserPreferences] = None
) -> ExtractionResult:
    """
    Apply user preferences to the extraction result.

    - Filters items based on dietary restrictions
    - Adds preference notes for the resolver to use
    - Marks filtered items with notes

    Returns the modified ExtractionResult.
    """
    if not preferences and not implicit_preferences:
        return extraction
        
    active_brands = set(preferences.preferred_brands) if preferences else set()
    active_categories = set(preferences.preferred_categories) if preferences else set()
    if implicit_preferences and implicit_preferences.preferred_brands:
        active_brands.update(implicit_preferences.preferred_brands)
    if implicit_preferences and implicit_preferences.preferred_categories:
        active_categories.update(implicit_preferences.preferred_categories)
        
    # Explicit user preferences (Pillar 9) are superior to implicit history.
    # If a user explicitly avoids a brand, strip it from the active brands list even if they bought it previously.
    if preferences and preferences.avoided_brands:
        avoided_set = {b.lower() for b in preferences.avoided_brands}
        active_brands = {b for b in active_brands if b.lower() not in avoided_set}
        
    preferred_brands_list = list(active_brands)
    preferred_categories_list = list(active_categories)

    for intent in extraction.intents:
        filtered_items = []
        for item in intent.items:
            # Check dietary restrictions
            if preferences and _should_exclude(item, preferences):
                logger.info(f"Excluded '{item.name}' due to dietary preference: {preferences.dietary}")
                continue

            # Add brand preference notes (merged explicit + implicit)
            if preferred_brands_list:
                brands_str = ", ".join(preferred_brands_list)
                existing_notes = item.notes or ""
                item.notes = f"{existing_notes} [Preferred brands: {brands_str}]".strip()

            if preferred_categories_list:
                categories_str = ", ".join(preferred_categories_list)
                existing_notes = item.notes or ""
                item.notes = f"{existing_notes} [Preferred categories: {categories_str}]".strip()

            filtered_items.append(item)

        intent.items = filtered_items

    return extraction


def _should_exclude(item: ExtractedItem, prefs: UserPreferences) -> bool:
    """Check if an item should be excluded based on dietary restrictions."""
    name_lower = item.name.lower().strip()
    name_words = set(name_lower.split())

    for restriction in prefs.dietary:
        restriction = restriction.lower().strip()

        if restriction in ("veg", "vegetarian"):
            if name_words & NON_VEG_KEYWORDS or name_lower in NON_VEG_KEYWORDS:
                return True

        elif restriction == "vegan":
            if name_words & NON_VEGAN_KEYWORDS or name_lower in NON_VEGAN_KEYWORDS:
                return True

        elif restriction == "jain":
            if name_words & JAIN_EXCLUDED_KEYWORDS or name_lower in JAIN_EXCLUDED_KEYWORDS:
                return True

    # Check allergies
    for allergy in prefs.allergies:
        allergy_lower = allergy.lower().strip()
        if allergy_lower in ALLERGY_KEYWORDS:
            if name_words & ALLERGY_KEYWORDS[allergy_lower] or name_lower in ALLERGY_KEYWORDS[allergy_lower]:
                return True

    return False


def get_budget_multiplier(budget_mode: str) -> float:
    """
    Return a price preference multiplier for the resolver.
    - value: prefer cheapest options (0.7x weight on price)
    - balanced: default (1.0x)
    - premium: prefer quality/premium brands (1.5x weight on price tolerance)
    """
    multipliers = {
        "value": 0.7,
        "balanced": 1.0,
        "premium": 1.5,
    }
    return multipliers.get(budget_mode.lower(), 1.0)
