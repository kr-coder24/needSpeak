"""
product_badges.py — Product Badge System for Non-Food Items
===========================================================
Provides relevant badges/indicators for different product categories:
- Cleaning products: Eco-friendly, antibacterial
- Personal care: Dermatologist tested, natural ingredients
- Electronics: Energy efficient, warranty
- Clothing: Sustainable, premium quality
"""

from decimal import Decimal
from typing import Optional


def get_product_badge(
    category: str,
    subcategory: str = "",
    price_inr: Optional[Decimal] = None,
    rating: Optional[Decimal] = None,
    dietary_tags: set = None,
    keywords: set = None,
    brand: str = "",
) -> Optional[dict]:
    """
    Get relevant badge for product based on category and attributes.
    
    Returns dict with:
    - label: Badge text
    - color: Tailwind CSS classes
    - icon: Emoji or symbol
    - type: Badge type (eco, quality, value, safety, etc.)
    """
    dietary_tags = dietary_tags or set()
    keywords = keywords or set()
    keywords_lower = {k.lower() for k in keywords}
    brand_lower = brand.lower()
    
    badges = []
    
    # === CLEANING PRODUCTS ===
    if category == "cleaning":
        # Eco-friendly indicators
        if any(term in keywords_lower for term in ["eco", "biodegradable", "natural", "plant-based", "eco-friendly"]):
            badges.append({
                "label": "Eco-Friendly",
                "color": "bg-green-500/15 text-green-700 border-green-500/30",
                "icon": "🌱",
                "type": "eco",
                "priority": 1,
            })
        
        # Antibacterial
        if any(term in keywords_lower for term in ["antibacterial", "disinfectant", "kills germs", "99.9%"]):
            badges.append({
                "label": "Antibacterial",
                "color": "bg-blue-500/15 text-blue-700 border-blue-500/30",
                "icon": "🛡",
                "type": "safety",
                "priority": 2,
            })
    
    # === PERSONAL CARE & HYGIENE ===
    elif category in ["hygiene", "personal_care"]:
        # Dermatologist tested
        if any(term in keywords_lower for term in ["dermatologist", "clinically tested", "hypoallergenic"]):
            badges.append({
                "label": "Derma Tested",
                "color": "bg-blue-500/15 text-blue-700 border-blue-500/30",
                "icon": "✓",
                "type": "quality",
                "priority": 1,
            })
        
        # Natural/Organic
        if any(term in keywords_lower for term in ["natural", "organic", "herbal", "ayurvedic", "chemical-free"]):
            badges.append({
                "label": "Natural",
                "color": "bg-green-500/15 text-green-700 border-green-500/30",
                "icon": "🌿",
                "type": "natural",
                "priority": 2,
            })
        
        # Paraben-free
        if any(term in keywords_lower for term in ["paraben-free", "sulfate-free", "sls-free"]):
            badges.append({
                "label": "No Parabens",
                "color": "bg-purple-500/15 text-purple-700 border-purple-500/30",
                "icon": "🚫",
                "type": "safety",
                "priority": 3,
            })
    
    # === FASHION & CLOTHING ===
    elif category in ["fashion_men", "fashion_women", "fashion_kids", "footwear"]:
        # Sustainable/Eco
        if any(term in keywords_lower for term in ["sustainable", "organic cotton", "recycled", "eco-friendly"]):
            badges.append({
                "label": "Sustainable",
                "color": "bg-green-500/15 text-green-700 border-green-500/30",
                "icon": "♻️",
                "type": "eco",
                "priority": 1,
            })
        
        # Premium quality indicators
        if any(term in keywords_lower for term in ["premium", "luxury", "designer", "handcrafted"]):
            badges.append({
                "label": "Premium",
                "color": "bg-amber-500/15 text-amber-700 border-amber-500/30",
                "icon": "⭐",
                "type": "quality",
                "priority": 2,
            })
        
        # Comfort
        if any(term in keywords_lower for term in ["comfortable", "breathable", "soft", "lightweight"]):
            badges.append({
                "label": "Comfortable",
                "color": "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
                "icon": "☁️",
                "type": "comfort",
                "priority": 3,
            })
    
    # === BABY PRODUCTS ===
    elif category == "baby":
        # Baby-safe
        if any(term in keywords_lower for term in ["baby-safe", "pediatrician", "gentle", "hypoallergenic"]):
            badges.append({
                "label": "Baby Safe",
                "color": "bg-pink-500/15 text-pink-700 border-pink-500/30",
                "icon": "👶",
                "type": "safety",
                "priority": 1,
            })
        
        # Chemical-free
        if any(term in keywords_lower for term in ["chemical-free", "natural", "organic"]):
            badges.append({
                "label": "Chemical-Free",
                "color": "bg-green-500/15 text-green-700 border-green-500/30",
                "icon": "🌱",
                "type": "safety",
                "priority": 2,
            })
    
    # === ELECTRONICS & ACCESSORIES ===
    elif category in ["accessories", "electronics"]:
        # Energy efficient
        if any(term in keywords_lower for term in ["energy efficient", "5-star", "inverter", "eco-mode"]):
            badges.append({
                "label": "Energy Saver",
                "color": "bg-green-500/15 text-green-700 border-green-500/30",
                "icon": "⚡",
                "type": "efficiency",
                "priority": 1,
            })
        
        # Warranty
        if any(term in keywords_lower for term in ["warranty", "guarantee", "1 year", "2 year"]):
            badges.append({
                "label": "Warranty",
                "color": "bg-blue-500/15 text-blue-700 border-blue-500/30",
                "icon": "🛡",
                "type": "warranty",
                "priority": 2,
            })
    
    # === PET PRODUCTS ===
    elif category == "pet":
        # Veterinarian approved
        if any(term in keywords_lower for term in ["vet", "veterinarian", "approved", "recommended"]):
            badges.append({
                "label": "Vet Approved",
                "color": "bg-blue-500/15 text-blue-700 border-blue-500/30",
                "icon": "✓",
                "type": "quality",
                "priority": 1,
            })
        
        # Natural ingredients
        if any(term in keywords_lower for term in ["natural", "organic", "grain-free"]):
            badges.append({
                "label": "Natural",
                "color": "bg-green-500/15 text-green-700 border-green-500/30",
                "icon": "🌿",
                "type": "natural",
                "priority": 2,
            })
    
    # === VALUE BADGES (All Categories) ===
    # Best value (high rating + reasonable price)
    if rating and rating >= Decimal("4.4") and price_inr and price_inr < Decimal("200"):
        badges.append({
            "label": "Best Value",
            "color": "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
            "icon": "💎",
            "type": "value",
            "priority": 4,
        })
    
    # Top rated
    if rating and rating >= Decimal("4.5"):
        badges.append({
            "label": "Top Rated",
            "color": "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
            "icon": "⭐",
            "type": "rating",
            "priority": 5,
        })
    
    # Return highest priority badge
    if badges:
        badges.sort(key=lambda x: x["priority"])
        return badges[0]
    
    return None


def get_category_specific_info(category: str, product: dict) -> Optional[dict]:
    """
    Get category-specific information to display.
    
    Returns dict with:
    - metric_name: Display name
    - metric_value: Value to show
    - icon: Optional emoji
    """
    
    # Cleaning products - Show usage info
    if category == "cleaning":
        unit_quantity = product.get("unit_quantity")
        unit = product.get("unit", "")
        if unit_quantity:
            return {
                "metric_name": "Volume",
                "metric_value": f"{unit_quantity}{unit}",
                "icon": "📦",
            }
    
    # Fashion - Show material/fabric
    elif category in ["fashion_men", "fashion_women", "fashion_kids"]:
        keywords = product.get("keywords", set())
        materials = ["cotton", "polyester", "silk", "wool", "linen", "denim"]
        for mat in materials:
            if any(mat in str(k).lower() for k in keywords):
                return {
                    "metric_name": "Fabric",
                    "metric_value": mat.capitalize(),
                    "icon": "👕",
                }
    
    # Baby products - Age suitability
    elif category == "baby":
        keywords = product.get("keywords", set())
        age_indicators = ["newborn", "0-6 months", "6-12 months", "1-2 years"]
        for age in age_indicators:
            if any(age in str(k).lower() for k in keywords):
                return {
                    "metric_name": "Age",
                    "metric_value": age.title(),
                    "icon": "👶",
                }
    
    return None
