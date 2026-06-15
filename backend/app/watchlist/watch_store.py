import uuid
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import random

from .models import Watch, PriceHistoryPoint, CreateWatchRequest
from .price_status import get_price_status_for_item

# In-memory store: user_id -> List[Watch]
_WATCH_STORE: Dict[str, List[Watch]] = {}
_SEEDED_USERS = set()

def _generate_demo_history(current_price: float, drop_type: str = "none") -> List[PriceHistoryPoint]:
    history = []
    base_price = current_price
    
    if drop_type == "recent_drop":
        # Was higher, dropped recently
        base_price = current_price * 1.2
    elif drop_type == "recent_rise":
        # Was lower, rose recently
        base_price = current_price * 0.8
        
    for i in range(30, -1, -1):
        date_str = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        
        # Add some jitter
        jitter = base_price * random.uniform(-0.02, 0.02)
        price = max(1.0, base_price + jitter)
        
        # Apply drop/rise in the last 5 days
        if i <= 5:
            price = current_price + (current_price * random.uniform(-0.01, 0.01))
            
        history.append(PriceHistoryPoint(date=date_str, price_inr=round(price, 2)))
        
    return history

def seed_demo_data(user_id: str):
    if user_id in _SEEDED_USERS:
        return
        
    _SEEDED_USERS.add(user_id)
    if user_id not in _WATCH_STORE:
        _WATCH_STORE[user_id] = []
        
    # We must not duplicate seeded SKUs if somehow called again.
    existing_skus = {w.sku for w in _WATCH_STORE[user_id]}
    
    demo_watches = [
        {
            "sku": "SKU-CHICKEN",
            "name": "Farm Fresh Chicken Breast",
            "brand": "Fresh Farm",
            "current_price_inr": 280.0,
            "target_price_inr": 280.0,
            "drop_type": "none",
            "email_ready": False,
            "neighbor_match": "Average Fresh Farm",
            "competitor_price_inr": 290.0,
            "competitor_source": "BigBasket"
        },
        {
            "sku": "SKU-SONY",
            "name": "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
            "brand": "Sony",
            "current_price_inr": 31385.0,
            "target_price_inr": 22990.0,
            "drop_type": "recent_rise",
            "email_ready": False,
            "neighbor_match": "Average Sony",
            "competitor_price_inr": 31999.0,
            "competitor_source": "Croma"
        },
        {
            "sku": "SKU-DAAWAT",
            "name": "Daawat Rozana Super Basmati Rice",
            "brand": "Daawat",
            "current_price_inr": 1435.0,
            "target_price_inr": 1250.0,
            "drop_type": "none",
            "email_ready": True,
            "neighbor_match": "Average Daawat",
            "competitor_price_inr": 1450.0,
            "competitor_source": "Reliance Smart"
        },
        {
            "sku": "SKU-PHILIPS",
            "name": "Philips Digital Air Fryer 4.1L with Touch Panel",
            "brand": "Philips",
            "current_price_inr": 9256.0,
            "target_price_inr": 8999.0,
            "drop_type": "none",
            "email_ready": False,
            "neighbor_match": "Average Philips",
            "competitor_price_inr": 9499.0,
            "competitor_source": "Amazon"
        },
        {
            "sku": "SKU-LG",
            "name": "LG 7 kg 5 Star Fully Automatic Front Load",
            "brand": "LG",
            "current_price_inr": 30565.0,
            "target_price_inr": 30990.0,
            "drop_type": "recent_drop",
            "email_ready": True,
            "neighbor_match": "Average LG",
            "competitor_price_inr": 29990.0,
            "competitor_source": "Flipkart"
        },
        {
            "sku": "SKU-PAMPERS",
            "name": "Pampers Active Baby Diapers Monthly Box",
            "brand": "Pampers",
            "current_price_inr": 2021.0,
            "target_price_inr": 1499.0,
            "drop_type": "none",
            "email_ready": False,
            "neighbor_match": "Average Pampers",
            "competitor_price_inr": 2100.0,
            "competitor_source": "FirstCry"
        },
        {
            "sku": "DEMO-PURIFIER",
            "name": "Kent Supreme RO + UV Water Purifier 8L",
            "brand": "Kent",
            "current_price_inr": 14715.0,
            "target_price_inr": 13499.0,
            "drop_type": "recent_drop",
            "email_ready": True,
            "neighbor_match": "Average Kent",
            "competitor_price_inr": 13790.0,
            "competitor_source": "Flipkart"
        }
    ]
    
    for dw in demo_watches:
        if dw["sku"] in existing_skus:
            continue
            
        history = _generate_demo_history(dw["current_price_inr"], dw["drop_type"])
        status = get_price_status_for_item(dw["sku"], dw["current_price_inr"], history)
        
        watch = Watch(
            sku=dw["sku"],
            name=dw["name"],
            brand=dw["brand"],
            current_price_inr=dw["current_price_inr"],
            target_price_inr=dw["target_price_inr"],
            price_history=history,
            competitor_price_inr=dw["competitor_price_inr"],
            competitor_source=dw["competitor_source"],
            email="demo@example.com" if dw["email_ready"] else None,
            neighbor_match=dw["neighbor_match"],
            price_status=status
        )
        _WATCH_STORE[user_id].append(watch)


def find_watch_by_sku(user_id: str, sku: str) -> Optional[Watch]:
    watches = _WATCH_STORE.get(user_id, [])
    for w in watches:
        if w.sku == sku:
            return w
    return None


def find_watch_by_sku_across_users(sku: str) -> Optional[Watch]:
    for watches in _WATCH_STORE.values():
        for w in watches:
            if w.sku == sku:
                return w
    return None


def get_user_watchlist(user_id: str) -> List[Watch]:
    seed_demo_data(user_id)
    return _WATCH_STORE.get(user_id, [])


def create_watch(user_id: str, req: CreateWatchRequest) -> Watch:
    seed_demo_data(user_id)
    
    existing = find_watch_by_sku(user_id, req.sku)
    if existing:
        # Update optional fields if provided
        if req.email is not None:
            existing.email = req.email
        if req.target_price_inr is not None:
            existing.target_price_inr = req.target_price_inr
        if req.competitor_price_inr is not None:
            existing.competitor_price_inr = req.competitor_price_inr
        if req.competitor_source is not None:
            existing.competitor_source = req.competitor_source
            
        # Re-evaluate status
        existing.price_status = get_price_status_for_item(
            existing.sku, existing.current_price_inr, existing.price_history
        )
        return existing
        
    # Create new
    history = _generate_demo_history(req.current_price_inr)
    status = get_price_status_for_item(req.sku, req.current_price_inr, history)
    
    new_watch = Watch(
        sku=req.sku,
        name=req.name,
        brand=req.brand,
        current_price_inr=req.current_price_inr,
        target_price_inr=req.target_price_inr,
        price_history=history,
        competitor_price_inr=req.competitor_price_inr,
        competitor_source=req.competitor_source,
        email=req.email,
        price_status=status
    )
    
    _WATCH_STORE[user_id].append(new_watch)
    return new_watch


def simulate_next_day(user_id: str):
    # Appends history to all watches for a user
    watches = get_user_watchlist(user_id)
    events = []
    
    for w in watches:
        # Shift date by 1 day
        last_date = datetime.strptime(w.price_history[-1].date, "%Y-%m-%d")
        next_date = last_date + timedelta(days=1)
        
        # Small random change
        jitter = w.current_price_inr * random.uniform(-0.03, 0.03)
        new_price = max(1.0, round(w.current_price_inr + jitter, 2))
        
        w.current_price_inr = new_price
        w.price_history.append(PriceHistoryPoint(date=next_date.strftime("%Y-%m-%d"), price_inr=new_price))
        
        # Keep it around 30-31 days for UI
        if len(w.price_history) > 40:
            w.price_history = w.price_history[-30:]
            
        w.price_status = get_price_status_for_item(w.sku, w.current_price_inr, w.price_history)
        
        # Emit a fake event if target price met
        if w.target_price_inr and new_price <= w.target_price_inr:
            event_id = f"evt_{w.watch_id}_{next_date.strftime('%Y%m%d')}"
            events.append({
                "id": event_id,
                "type": "price_drop",
                "watch_id": w.watch_id,
                "sku": w.sku,
                "name": w.name,
                "old_price": w.price_history[-2].price_inr,
                "new_price": new_price,
                "target_price": w.target_price_inr,
                "email_sent": bool(w.email)
            })
            if w.email:
                w.email_sent = True
                
    return events
