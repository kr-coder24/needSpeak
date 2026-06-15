from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any

from .models import (
    Watch, 
    CreateWatchRequest, 
    PriceStatusBatchRequest, 
    PriceStatusBatchResponse,
    PriceStatusBatchResponseItem
)
from .watch_store import (
    get_user_watchlist, 
    create_watch, 
    simulate_next_day
)
from .price_status import (
    get_price_status_for_item,
    get_price_status_batch
)

router = APIRouter()

@router.get("/{user_id}", response_model=List[Watch])
def get_watchlist(user_id: str):
    return get_user_watchlist(user_id)

@router.post("/{user_id}", response_model=Watch)
def add_to_watchlist(user_id: str, req: CreateWatchRequest):
    return create_watch(user_id, req)

@router.post("/price-status")
def price_status_single(payload: Dict[str, Any]):
    sku = payload.get("sku", "")
    current_price_inr = payload.get("current_price_inr", 0.0)
    user_id = payload.get("user_id")
    
    # Optional: fetch real history if the user has it watched
    history = None
    if user_id:
        from .watch_store import find_watch_by_sku
        watch = find_watch_by_sku(user_id, sku)
        if watch:
            history = watch.price_history
            
    status = get_price_status_for_item(sku, current_price_inr, history)
    return status

@router.post("/price-status/batch", response_model=PriceStatusBatchResponse)
def price_status_batch(req: PriceStatusBatchRequest):
    # Convert request items to dicts
    items_dict = [{"sku": i.sku, "current_price_inr": i.current_price_inr} for i in req.items]
    batch_results = get_price_status_batch(items_dict)
    
    return PriceStatusBatchResponse(
        items=[PriceStatusBatchResponseItem(**res) for res in batch_results]
    )

@router.post("/demo-events")
def demo_events(payload: Dict[str, Any]):
    user_id = payload.get("user_id", "demo_user")
    events = simulate_next_day(user_id)
    return {"events": events}
