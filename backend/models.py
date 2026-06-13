"""
Pydantic models for Context-to-Cart API request/response validation.
Matches the API contract exactly — frontend and backend work from these.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class InputType(str, Enum):
    TEXT = "text"
    URL = "url"


class IntentType(str, Enum):
    RECIPE = "recipe"
    DIY = "diy"
    SUPPLIES = "supplies"
    MEDICAL = "medical"
    GENERAL = "general"


class UnavailableReason(str, Enum):
    NOT_IN_CATALOG = "not_in_catalog"
    OUT_OF_STOCK = "out_of_stock"


class ErrorCode(str, Enum):
    UNSUPPORTED_URL = "unsupported_url"
    NO_CONTENT = "no_content"
    EXTRACTION_FAILED = "extraction_failed"
    BEDROCK_TIMEOUT = "bedrock_timeout"
    INTERNAL_ERROR = "internal_error"


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------
class ParseRequest(BaseModel):
    """POST /api/parse request body."""
    input_type: InputType
    content: str = Field(..., min_length=1, max_length=50000)
    servings_override: Optional[int] = Field(None, ge=1, le=50)
    budget_inr: Optional[int] = Field(None, ge=50)


# ---------------------------------------------------------------------------
# Extraction Models (Bedrock Stage 1 output)
# ---------------------------------------------------------------------------
class ExtractedItem(BaseModel):
    """A single item extracted by Bedrock from the input text."""
    name: str
    quantity: float = Field(default=1.0)
    unit: str = Field(default="piece")
    category: str = Field(default="general")
    optional: bool = Field(default=False)
    notes: Optional[str] = None


class ExtractionResult(BaseModel):
    """Full extraction output from Bedrock Stage 1."""
    intent_type: IntentType = IntentType.GENERAL
    context_summary: str = ""
    servings: Optional[int] = None
    items: list[ExtractedItem] = Field(default_factory=list)
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Cart Models (SKU resolution output)
# ---------------------------------------------------------------------------
class CartItem(BaseModel):
    """A resolved product in the cart, mapped from an extracted item."""
    sku: str
    name: str
    brand: str
    quantity_units: int = Field(ge=1)
    unit: str
    unit_quantity: float
    price_per_unit_inr: float
    total_price_inr: float
    optional: bool = False
    substituted: bool = False
    substitution_reason: Optional[str] = None


class UnavailableItem(BaseModel):
    """An item that could not be matched to any product."""
    name: str
    reason: UnavailableReason


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------
class ParseResponse(BaseModel):
    """POST /api/parse success response."""
    session_id: str
    intent_type: IntentType
    context_summary: str
    cart: list[CartItem]
    unavailable_items: list[UnavailableItem] = Field(default_factory=list)
    total_price_inr: float
    budget_exceeded: bool = False
    summary: str = ""


class ErrorResponse(BaseModel):
    """Error response for any endpoint."""
    error_code: ErrorCode
    message: str


class HealthResponse(BaseModel):
    """GET /api/health response."""
    status: str = "ok"
    bedrock: str = "ok"
    dynamodb: str = "ok"


# ---------------------------------------------------------------------------
# Session Model (DynamoDB CartSessions record)
# ---------------------------------------------------------------------------
class SessionRecord(BaseModel):
    """Represents a stored session in CartSessions table."""
    session_id: str
    created_at: str
    input_type: InputType
    raw_input_s3_key: Optional[str] = None
    intent_type: Optional[IntentType] = None
    context_summary: Optional[str] = None
    extracted_items: Optional[list[dict]] = None
    cart_items: Optional[list[dict]] = None
    unavailable_items: Optional[list[dict]] = None
    total_price_inr: Optional[float] = None
    budget_inr: Optional[int] = None
    budget_exceeded: Optional[bool] = None
    summary: Optional[str] = None
    status: str = "pending"
    error_message: Optional[str] = None
