"""
Restock Predictor — Analyzes cart history to generate a Predictive Restock Timeline.
It combats "Subscription Fatigue" by intelligently predicting exactly when users 
will run out of items based on standard consumption profiles and past purchases.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone

# Standard consumption profiles for categories
CONSUMPTION_HORIZONS = {
    "dairy": 3,
    "bakery": 4,
    "produce": 7,
    "meat": 5,
    "snacks": 10,
    "beverages": 14,
    "pantry": 30,
    "spices": 60,
    "cleaning": 45,
    "hygiene": 45,
    "general": 20,
}

def _categorize(item_name: str) -> str:
    """Simple categorization logic based on keywords."""
    name = item_name.lower()
    if any(k in name for k in ["milk", "cheese", "butter", "paneer", "yogurt", "curd"]): return "dairy"
    if any(k in name for k in ["bread", "buns", "cake", "cookie"]): return "bakery"
    if any(k in name for k in ["apple", "onion", "potato", "tomato", "banana", "veg"]): return "produce"
    if any(k in name for k in ["chips", "snack", "mixture", "bhujia", "kurkure"]): return "snacks"
    if any(k in name for k in ["coke", "pepsi", "water", "juice", "soda"]): return "beverages"
    if any(k in name for k in ["rice", "dal", "flour", "atta", "sugar", "salt"]): return "pantry"
    if any(k in name for k in ["soap", "shampoo", "paste", "brush", "wash"]): return "hygiene"
    if any(k in name for k in ["detergent", "cleaner", "harpic", "vim"]): return "cleaning"
    return "general"

def generate_restock_timeline(history_sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parses past checkout sessions to generate a restock timeline.
    Returns categorized groups: 'Urgent' (<= 3 days), 'Upcoming' (4-14 days), 'Later' (>14 days).
    """
    item_map = {}
    now = datetime.now(timezone.utc)
    
    for session in history_sessions:
        # We assume session has "saved_at" or defaults to 14 days ago
        saved_str = session.get("saved_at")
        if saved_str:
            try:
                # remove Z if present for fromisoformat
                purchase_date = datetime.fromisoformat(saved_str.replace("Z", "+00:00"))
            except ValueError:
                purchase_date = now - timedelta(days=14)
        else:
            purchase_date = now - timedelta(days=14)

        items = session.get("items", [])
        for item in items:
            sku = item.get("sku", "unknown")
            name = item.get("name", "Unknown Item")
            qty = item.get("quantity", item.get("qty", 1))
            category = item.get("category") or _categorize(name)
            
            # Base horizon multiplied by log of quantity to account for bulk buys
            # e.g., buying 2x milk doesn't mean it lasts 2x as long exactly, maybe 1.5x
            base_horizon = CONSUMPTION_HORIZONS.get(category.lower(), 20)
            adjusted_horizon = base_horizon * (1 + (qty - 1) * 0.3)
            
            run_out_date = purchase_date + timedelta(days=adjusted_horizon)
            days_remaining = (run_out_date - now).days
            
            # If it ran out more than 10 days ago and wasn't repurchased, user might not want it
            if days_remaining < -10:
                continue
                
            # If we already saw this SKU in a MORE RECENT session, don't overwrite
            if sku in item_map:
                if purchase_date > item_map[sku]["last_purchased"]:
                    item_map[sku]["last_purchased"] = purchase_date
                    item_map[sku]["days_remaining"] = int(days_remaining)
            else:
                item_map[sku] = {
                    "sku": sku,
                    "name": name,
                    "category": category.capitalize(),
                    "last_purchased": purchase_date,
                    "days_remaining": int(days_remaining),
                    "price_inr": item.get("price_inr", 0),
                    "image": item.get("image", "")
                }
                
    # Group into timeline
    urgent, upcoming, later = [], [], []
    for data in item_map.values():
        days = data["days_remaining"]
        # Format for output
        entry = {
            "sku": data["sku"],
            "name": data["name"],
            "category": data["category"],
            "days_remaining": days,
            "price_inr": data["price_inr"],
            "image": data["image"]
        }
        
        if days <= 3:
            urgent.append(entry)
        elif days <= 14:
            upcoming.append(entry)
        else:
            later.append(entry)
            
    # Sort each list by urgency
    urgent.sort(key=lambda x: x["days_remaining"])
    upcoming.sort(key=lambda x: x["days_remaining"])
    later.sort(key=lambda x: x["days_remaining"])
    
    return {
        "urgent": urgent,
        "upcoming": upcoming,
        "later": later,
        "total_items": len(urgent) + len(upcoming) + len(later)
    }
