"""
health_scorer.py — Health Score Calculation for Products
=========================================================
Calculates a 0-100 health score based on nutritional data.
Higher scores indicate healthier products.

Scoring Factors:
- Lower calories (moderate is okay)
- Lower sugar content (critical for beverages)
- Higher protein (good)
- Higher fiber (good)
- Lower saturated fat (critical)
- Lower sodium (important)
"""

from decimal import Decimal
from typing import Optional


def calculate_health_score(
    calories_per_100: Optional[Decimal] = None,
    protein_per_100: Optional[Decimal] = None,
    carbs_per_100: Optional[Decimal] = None,
    sugar_per_100: Optional[Decimal] = None,
    fat_per_100: Optional[Decimal] = None,
    saturated_fat_per_100: Optional[Decimal] = None,
    fiber_per_100: Optional[Decimal] = None,
    sodium_per_100: Optional[Decimal] = None,
    category: str = "",
) -> tuple[Optional[Decimal], Optional[str]]:
    """
    Calculate health score (0-100) and badge label.
    
    Returns:
        (health_score, badge_label) where badge_label is one of:
        "excellent" (80-100), "good" (60-79), "moderate" (40-59), "poor" (0-39)
    """
    # Special case: Water and similar zero-calorie natural beverages
    if all([
        calories_per_100 is not None and calories_per_100 == 0,
        sugar_per_100 is not None and sugar_per_100 == 0,
        (sodium_per_100 is None or sodium_per_100 <= 10),
    ]):
        return Decimal("100"), "excellent"
    
    if not any([calories_per_100, sugar_per_100, protein_per_100]):
        return None, None
    
    score = Decimal("50")  # Start at neutral
    
    # === Sugar Score (Most Important for Beverages) ===
    # High sugar = bad, no sugar = good
    if sugar_per_100 is not None:
        if sugar_per_100 == 0:
            score += Decimal("15")  # Big bonus for zero sugar
        elif sugar_per_100 <= 2:
            score += Decimal("10")  # Low sugar
        elif sugar_per_100 <= 5:
            score += Decimal("5")   # Moderate sugar
        elif sugar_per_100 <= 10:
            score -= Decimal("5")   # High sugar
        else:
            score -= Decimal("15")  # Very high sugar (sodas)
    
    # === Calorie Score ===
    # Moderate calories are okay, very high/low can be concerning
    if calories_per_100 is not None:
        if Decimal("50") <= calories_per_100 <= Decimal("200"):
            score += Decimal("5")   # Moderate calorie range
        elif calories_per_100 < Decimal("30"):
            score += Decimal("10")  # Very low cal (diet drinks, veggies)
        elif calories_per_100 > Decimal("400"):
            score -= Decimal("10")  # Very high cal
        elif calories_per_100 > Decimal("300"):
            score -= Decimal("5")
    
    # === Protein Score ===
    # Higher protein = better
    if protein_per_100 is not None:
        if protein_per_100 >= 15:
            score += Decimal("10")
        elif protein_per_100 >= 8:
            score += Decimal("5")
        elif protein_per_100 >= 3:
            score += Decimal("2")
    
    # === Fiber Score ===
    # Higher fiber = better
    if fiber_per_100 is not None:
        if fiber_per_100 >= 10:
            score += Decimal("10")
        elif fiber_per_100 >= 5:
            score += Decimal("5")
        elif fiber_per_100 >= 2:
            score += Decimal("2")
    
    # === Saturated Fat Score ===
    # Lower saturated fat = better
    if saturated_fat_per_100 is not None:
        if saturated_fat_per_100 == 0:
            score += Decimal("5")
        elif saturated_fat_per_100 <= 1:
            score += Decimal("3")
        elif saturated_fat_per_100 > 10:
            score -= Decimal("10")
        elif saturated_fat_per_100 > 5:
            score -= Decimal("5")
    
    # === Sodium Score ===
    # Lower sodium = better (especially important for processed foods)
    if sodium_per_100 is not None:
        if sodium_per_100 <= 100:
            score += Decimal("5")  # Low sodium
        elif sodium_per_100 <= 300:
            score += Decimal("2")  # Moderate
        elif sodium_per_100 > 800:
            score -= Decimal("10")  # Very high
        elif sodium_per_100 > 500:
            score -= Decimal("5")
    
    # Clamp score to 0-100 range
    score = max(Decimal("0"), min(Decimal("100"), score))
    
    # Determine badge label
    if score >= 80:
        badge = "excellent"
    elif score >= 60:
        badge = "good"
    elif score >= 40:
        badge = "moderate"
    else:
        badge = "poor"
    
    return score, badge


def get_health_badge_display(badge: str) -> dict:
    """
    Get display properties for health badge.
    
    Returns dict with:
    - label: Display text
    - color: Tailwind CSS classes for styling
    - icon: Emoji or symbol
    """
    badge_map = {
        "excellent": {
            "label": "Excellent Choice",
            "color": "bg-green-500/15 text-green-700 border-green-500/30",
            "icon": "✓",
        },
        "good": {
            "label": "Good Choice",
            "color": "bg-blue-500/15 text-blue-700 border-blue-500/30",
            "icon": "✓",
        },
        "moderate": {
            "label": "Moderate",
            "color": "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
            "icon": "⚠",
        },
        "poor": {
            "label": "Less Healthy",
            "color": "bg-orange-500/15 text-orange-700 border-orange-500/30",
            "icon": "!",
        },
    }
    return badge_map.get(badge, badge_map["moderate"])
