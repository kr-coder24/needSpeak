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
    WHATSAPP = "whatsapp"
    IMAGE = "image"
    PDF = "pdf"
    PRESCRIPTION = "prescription"


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
    # V2 preference params
    dietary_pref: Optional[str] = Field(None, description="veg, vegan, jain, or None for any")
    preferred_brands: Optional[list[str]] = Field(default=None, description="Brands to boost in ranking")
    avoided_brands: Optional[list[str]] = Field(default=None, description="Brands to filter out")
    budget_mode: Optional[str] = Field(default="balanced", description="value, balanced, or premium")
    occasion: Optional[str] = Field(default=None, description="Occasion tag for relevance boosting")


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
    requires_validation: bool = Field(default=False, description="True for prescription medicines")


class ExtractedIntent(BaseModel):
    """A specific intent extracted with its items."""
    intent_type: IntentType = IntentType.GENERAL
    context_summary: str = ""
    items: list[ExtractedItem] = Field(default_factory=list)


class ExtractionResult(BaseModel):
    """Full extraction output from LLM Stage 1."""
    servings: Optional[int] = None
    confidence: str = "high"
    clarification_question: Optional[str] = None
    intents: list[ExtractedIntent] = Field(default_factory=list)
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
    pending_substitution: Optional[dict] = None
    # Shape: {"name": str, "sku": str, "price_per_unit_inr": float, "reason": str}
    matched_from: list[str] = Field(default_factory=list)
    # V2 additions: explainable ranking
    alternatives: list[dict] = Field(default_factory=list)
    reason_codes: list[str] = Field(default_factory=list)
    display_reason: str = ""
    stock_status: str = "available"
    requires_validation: bool = Field(default=False)



class UnavailableItem(BaseModel):
    """An item that could not be matched to any product."""
    name: str
    reason: UnavailableReason


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------
class IntentGroup(BaseModel):
    """A cart resolved for a specific intent."""
    intent_type: IntentType
    context_summary: str
    cart: list[CartItem]
    unavailable_items: list[UnavailableItem] = Field(default_factory=list)


class ParseResponse(BaseModel):
    """POST /api/parse success response."""
    session_id: str
    confidence: str = "high"
    clarification_question: Optional[str] = None
    intents: list[IntentGroup] = Field(default_factory=list)
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
    s3: str = "ok"



# ---------------------------------------------------------------------------
# Session Model (DynamoDB CartSessions record)
# ---------------------------------------------------------------------------
class SessionRecord(BaseModel):
    """Represents a stored session in CartSessions table."""
    session_id: str
    created_at: str
    input_type: InputType
    raw_input_s3_key: Optional[str] = None
    confidence: Optional[str] = None
    clarification_question: Optional[str] = None
    extracted_intents: Optional[list[dict]] = None
    resolved_intents: Optional[list[dict]] = None
    total_price_inr: Optional[float] = None
    budget_inr: Optional[int] = None
    budget_exceeded: Optional[bool] = None
    summary: Optional[str] = None
    status: str = "pending"
    error_message: Optional[str] = None
