"""Inventory and reservation data models."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

class ReservationItem(BaseModel):
    sku: str
    qty: int = Field(ge=1)
    location_id: str = "DEFAULT"

class ReserveRequest(BaseModel):
    items: list[ReservationItem]
    idempotency_key: str | None = None

class ReservationResponse(BaseModel):
    reservation_id: str
    status: Literal["reserved", "partial_failed", "failed"]
    reserved_items: list[dict] = Field(default_factory=list)
    failed_items: list[dict] = Field(default_factory=list)
    total_amount: float
    expires_at: str
    message: str

class PaymentIntentRequest(BaseModel):
    reservation_id: str
    customer_email: str | None = None

class PaymentIntentResponse(BaseModel):
    client_secret: str
    amount: float
    currency: str = "INR"
    reservation_id: str
