from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.watchlist.competitor_extractor import extract_competitor_price
from app.watchlist.models import (
    PriceStatus,
    PriceStatusBatchRequest,
    PriceStatusBatchResponse,
    PriceStatusBatchResultItem,
    PriceStatusRequest,
    SimulateResponse,
    WatchCreateRequest,
    WatchEvent,
    WatchedItem,
    WatchStats,
)
from app.watchlist.neighbor_feed import check_neighbor_matches
from app.watchlist.notifications import send_watch_alert_email
from app.watchlist.price_feed import advance_day, check_price_alerts, get_current_day
from app.watchlist.price_status import get_price_status_for_item
from app.watchlist.watch_store import create_watch, find_watch_by_sku, get_aggregate_stats, get_demo_events, get_watches, remove_watch, replace_watches

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.post("/watch", response_model=WatchedItem)
async def create_watch_endpoint(req: WatchCreateRequest):
    competitor = extract_competitor_price(text=req.competitor_text)
    return create_watch(req.user_id, req, competitor)


@router.post("/watch-image", response_model=WatchedItem)
async def create_watch_image_endpoint(
    sku: str = Form(...),
    name: str = Form(...),
    brand: str = Form(""),
    current_price_inr: float = Form(...),
    target_price_inr: float | None = Form(None),
    user_id: str = Form("demo_user"),
    email: str | None = Form(None),
    competitor_text: str | None = Form(None),
    competitor_screenshot: UploadFile | None = File(None),
):
    image_bytes = await competitor_screenshot.read() if competitor_screenshot else None
    competitor = extract_competitor_price(
        text=competitor_text,
        image_bytes=image_bytes,
        mime_type=competitor_screenshot.content_type if competitor_screenshot else None,
    )
    req = WatchCreateRequest(
        sku=sku,
        name=name,
        brand=brand,
        current_price_inr=current_price_inr,
        target_price_inr=target_price_inr,
        user_id=user_id,
        email=email,
        competitor_text=competitor_text,
    )
    return create_watch(user_id, req, competitor)


@router.get("/demo-events", response_model=list[WatchEvent])
async def demo_events_endpoint():
    return get_demo_events()


@router.get("/meta/day")
async def current_day_endpoint():
    return {"current_day": get_current_day()}


@router.post("/price-status", response_model=PriceStatus)
async def price_status_endpoint(req: PriceStatusRequest):
    watch = find_watch_by_sku(req.user_id, req.sku)
    return get_price_status_for_item(
        sku=req.sku,
        current_price_inr=req.current_price_inr,
        history=watch.price_history if watch else None,
    )


@router.post("/price-status/batch", response_model=PriceStatusBatchResponse)
async def price_status_batch_endpoint(req: PriceStatusBatchRequest):
    items: list[PriceStatusBatchResultItem] = []
    for item in req.items:
        watch = find_watch_by_sku(req.user_id, item.sku)
        items.append(
            PriceStatusBatchResultItem(
                sku=item.sku,
                price_status=get_price_status_for_item(
                    sku=item.sku,
                    current_price_inr=item.current_price_inr,
                    history=watch.price_history if watch else None,
                ),
            )
        )
    return PriceStatusBatchResponse(items=items)


@router.get("/{user_id}", response_model=list[WatchedItem])
async def list_watches_endpoint(user_id: str):
    return get_watches(user_id)


@router.delete("/{user_id}/{watch_id}")
async def remove_watch_endpoint(user_id: str, watch_id: str):
    if not remove_watch(user_id, watch_id):
        raise HTTPException(status_code=404, detail="Watch not found")
    return {"status": "removed"}


@router.post("/{user_id}/simulate", response_model=SimulateResponse)
async def simulate_endpoint(user_id: str):
    day = advance_day()
    watches = get_watches(user_id)
    price_events, watches = check_price_alerts(watches, day)
    neighbor_events, watches = check_neighbor_matches(watches, day)

    all_events = [*price_events, *neighbor_events]
    event_by_watch = {event.watch_id: event for event in all_events}
    emailed = []
    for item in watches:
        event = event_by_watch.get(item.watch_id)
        if event and not item.email_sent:
            sent = send_watch_alert_email(item, event)
            event.email_sent = sent
            emailed.append(item.model_copy(update={"email_sent": sent}))
        else:
            emailed.append(item)

    watches = replace_watches(user_id, emailed)
    return SimulateResponse(current_day=day, events=all_events, watches=watches)


@router.get("/{user_id}/stats", response_model=WatchStats)
async def stats_endpoint(user_id: str):
    return get_aggregate_stats(user_id)
