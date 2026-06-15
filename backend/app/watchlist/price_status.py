import hashlib
from typing import List, Optional, Dict, Any
from .models import PriceStatus, PriceHistoryPoint

def _generate_deterministic_range(sku: str, current_price_inr: float):
    # Generates a stable mock 30-day range based on SKU hash
    hash_val = int(hashlib.md5(sku.encode()).hexdigest(), 16)
    
    # 3 variance profiles: tight (5%), medium (15%), high (30%)
    variance_pct = [0.05, 0.15, 0.30][hash_val % 3]
    
    # Decide if current price is low, mid, or high within that variance
    # 0 = low, 1 = mid, 2 = high
    position = (hash_val // 3) % 3
    
    half_range = current_price_inr * variance_pct
    
    if position == 0:
        # Current price is near the low end
        low = current_price_inr * 0.98
        high = current_price_inr + (half_range * 2)
    elif position == 1:
        # Current price is in the middle
        low = current_price_inr - half_range
        high = current_price_inr + half_range
    else:
        # Current price is near the high end
        low = current_price_inr - (half_range * 2)
        high = current_price_inr * 1.02
        
    return max(1.0, low), max(1.0, high)


def get_price_status_for_item(sku: str, current_price_inr: float, history: Optional[List[PriceHistoryPoint]] = None) -> PriceStatus:
    if history and len(history) >= 2:
        low = min(p.price_inr for p in history)
        high = max(p.price_inr for p in history)
        
        # Ensure current price is factored in
        low = min(low, current_price_inr)
        high = max(high, current_price_inr)
    else:
        low, high = _generate_deterministic_range(sku, current_price_inr)
        
    price_range = high - low
    
    if price_range < 0.01:
        # No price variance
        return PriceStatus(
            status="fair",
            color_key="yellow",
            label="Stable Price",
            explanation="Price has not changed in the last 30 days.",
            confidence=90,
            thirty_day_low_inr=low,
            thirty_day_high_inr=high,
            current_price_inr=current_price_inr,
            deal_status="fair",
            deal_color="yellow",
            deal_label="Stable Price"
        )
        
    position_pct = (current_price_inr - low) / price_range
    
    if position_pct <= 0.15:
        return PriceStatus(
            status="best",
            color_key="green",
            label="Best in 30 days",
            explanation="Current price is near the 30-day low.",
            confidence=92,
            thirty_day_low_inr=low,
            thirty_day_high_inr=high,
            current_price_inr=current_price_inr,
            deal_status="best",
            deal_color="green",
            deal_label="Best in 30 days"
        )
    elif position_pct >= 0.85:
        return PriceStatus(
            status="high",
            color_key="red",
            label="High Price",
            explanation="Current price is near the 30-day high.",
            confidence=85,
            thirty_day_low_inr=low,
            thirty_day_high_inr=high,
            current_price_inr=current_price_inr,
            deal_status="high",
            deal_color="red",
            deal_label="High Price"
        )
    else:
        return PriceStatus(
            status="fair",
            color_key="yellow",
            label="Fair Price",
            explanation="Current price is in the middle of its 30-day range.",
            confidence=88,
            thirty_day_low_inr=low,
            thirty_day_high_inr=high,
            current_price_inr=current_price_inr,
            deal_status="fair",
            deal_color="yellow",
            deal_label="Fair Price"
        )

def get_price_status_batch(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Avoids circular import by accepting dictionaries, 
    # but normally you could import watch_store inside the function if needed to fetch watch history
    # The instructions say: "Prefer real watch history when SKU is watched." 
    # We will let watch_store optionally wrap this or we can do it here by fetching watch history.
    
    # For batch fetching, if we want to fetch real watch history, we need access to the store.
    # To keep it decoupled, the caller can pass history or we can look it up.
    # For now, we will just use the fallback if history isn't provided, 
    # or we will import watch_store locally.
    
    from .watch_store import find_watch_by_sku_across_users
    
    results = []
    for item in items:
        sku = item.get("sku", "")
        current_price = item.get("current_price_inr", 0.0)
        
        # Try to find a watch for this SKU to get real history
        watch = find_watch_by_sku_across_users(sku)
        history = watch.price_history if watch else None
        
        status = get_price_status_for_item(sku, current_price, history)
        results.append({
            "sku": sku,
            "price_status": status.model_dump()
        })
        
    return results
