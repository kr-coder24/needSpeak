from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


WatchStatus = Literal["watching", "price_dropped", "neighbor_match", "already_cheaper"]
WatchEventType = Literal["now_watching", "price_dropped", "neighbor_match", "already_cheaper", "email_sent"]
DealStatus = Literal["best", "fair", "high"]
DealColor = Literal["green", "yellow", "red"]


class PricePoint(BaseModel):
    day: int
    price: float


class NeighborMatch(BaseModel):
    product_id: str
    distance_km: float
    original_price_inr: float
    logistics_cost_saved_inr: float
    neighbor_price_inr: float
    co2_saved_kg: float
    day_appeared: int


class PriceStatus(BaseModel):
    status: DealStatus
    color_key: DealColor
    label: str
    explanation: str
    confidence: int
    thirty_day_low_inr: float
    thirty_day_high_inr: float
    current_price_inr: float
    deal_status: DealStatus
    deal_color: DealColor
    deal_label: str


class PriceStatusRequest(BaseModel):
    sku: str
    current_price_inr: float = Field(..., ge=0)
    user_id: str = "demo_user"


class PriceStatusBatchItem(BaseModel):
    sku: str
    current_price_inr: float = Field(..., ge=0)


class PriceStatusBatchRequest(BaseModel):
    user_id: str = "demo_user"
    items: list[PriceStatusBatchItem] = Field(default_factory=list)


class PriceStatusBatchResultItem(BaseModel):
    sku: str
    price_status: PriceStatus


class PriceStatusBatchResponse(BaseModel):
    items: list[PriceStatusBatchResultItem]


class WatchCreateRequest(BaseModel):
    sku: str
    name: str
    brand: str = ""
    current_price_inr: float = Field(..., ge=0)
    target_price_inr: float | None = Field(default=None, ge=0)
    competitor_text: str | None = None
    user_id: str = "demo_user"
    email: str | None = None


class WatchedItem(BaseModel):
    watch_id: str
    sku: str
    name: str
    brand: str = ""
    current_price_inr: float
    target_price_inr: float
    competitor_price_inr: float | None = None
    competitor_source: str | None = None
    status: WatchStatus = "watching"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    price_history: list[PricePoint] = Field(default_factory=list)
    neighbor_match: NeighborMatch | None = None
    co2_saved_kg: float = 0.0
    logistics_saved_inr: float = 0.0
    email: str | None = None
    email_sent: bool = False
    price_status: PriceStatus | None = None


class WatchEvent(BaseModel):
    id: str
    type: WatchEventType
    watch_id: str
    sku: str
    name: str
    message: str
    day: int
    savings_inr: float = 0.0
    co2_saved_kg: float = 0.0
    email_sent: bool = False


class SimulateResponse(BaseModel):
    current_day: int
    events: list[WatchEvent]
    watches: list[WatchedItem]


class WatchStats(BaseModel):
    total_saved_inr: float
    total_co2_saved_kg: float
    count: int
    alerts: int
