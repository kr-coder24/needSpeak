from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class PriceHistoryPoint(BaseModel):
    date: str
    price_inr: float

class PriceStatus(BaseModel):
    status: Literal["best", "fair", "high"]
    color_key: Literal["green", "yellow", "red"]
    label: str
    explanation: str
    confidence: int
    thirty_day_low_inr: float
    thirty_day_high_inr: float
    current_price_inr: float
    
    # Compatibility fields for existing frontend dots
    deal_status: Optional[str] = None
    deal_color: Optional[str] = None
    deal_label: Optional[str] = None

class Watch(BaseModel):
    watch_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    name: str
    brand: Optional[str] = None
    current_price_inr: float
    target_price_inr: Optional[float] = None
    status: str = "active"
    price_history: List[PriceHistoryPoint] = Field(default_factory=list)
    competitor_price_inr: Optional[float] = None
    competitor_source: Optional[str] = None
    neighbor_match: Optional[str] = None
    email: Optional[str] = None
    email_sent: bool = False
    price_status: Optional[PriceStatus] = None

class CreateWatchRequest(BaseModel):
    sku: str
    name: str
    current_price_inr: float
    brand: Optional[str] = None
    target_price_inr: Optional[float] = None
    competitor_price_inr: Optional[float] = None
    competitor_source: Optional[str] = None
    email: Optional[str] = None

class PriceStatusBatchRequestItem(BaseModel):
    sku: str
    current_price_inr: float

class PriceStatusBatchRequest(BaseModel):
    user_id: str
    items: List[PriceStatusBatchRequestItem]

class PriceStatusBatchResponseItem(BaseModel):
    sku: str
    price_status: PriceStatus

class PriceStatusBatchResponse(BaseModel):
    items: List[PriceStatusBatchResponseItem]
