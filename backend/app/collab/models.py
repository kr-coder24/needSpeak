"""Pydantic models for the real-time SplitCart feature."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class CollabRole(str, Enum):
    HOST = "host"
    CONTRIBUTOR = "contributor"


class ContributorStatus(str, Enum):
    ACTIVE = "active"
    LEFT = "left"


class Contributor(BaseModel):
    """A participant in a collaborative cart session."""

    id: str
    name: str
    role: CollabRole = CollabRole.CONTRIBUTOR
    status: ContributorStatus = ContributorStatus.ACTIVE
    joined_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    items_added: int = 0
    budget_contribution_inr: float = 0.0


class CollabDemand(BaseModel):
    """One contributor's requested amount for a resolved catalog product."""

    contributor_id: str
    contributor_name: str
    requested_name: str
    requested_quantity: float = Field(gt=0)
    requested_unit: str
    requested_base_amount: float = Field(gt=0)
    requested_base_unit: str
    standalone_quantity_units: int = Field(ge=1)
    notes: Optional[str] = None


class ProductSuggestion(BaseModel):
    """A close catalog match that the user can explicitly add."""

    sku: str
    name: str
    brand: str = ""
    price_per_unit_inr: float
    unit: str
    unit_quantity: float
    reason: str
    confidence: float = Field(ge=0, le=1)


class CollabCartItem(BaseModel):
    """A merged SKU with every contributor's demand preserved."""

    id: str
    sku: str
    name: str
    brand: str = ""
    quantity: int = Field(default=1, ge=1)
    unit: str = "piece"
    unit_quantity: float = Field(default=1.0, gt=0)
    category: str = "general"
    estimated_price_inr: float = Field(default=0.0, ge=0)
    added_by: str
    added_by_name: str
    notes: Optional[str] = None
    matched_from: list[str] = Field(default_factory=list)
    demands: list[CollabDemand] = Field(default_factory=list)
    pending_substitution: Optional[dict] = None
    substitution_reason: Optional[str] = None
    merge_savings_inr: float = 0.0

    @property
    def total_price_inr(self) -> float:
        return self.estimated_price_inr * self.quantity


class CollabSession(BaseModel):
    """A collaborative cart session with shared budget and contributors."""

    session_id: str
    name: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    host_id: str
    host_name: str
    total_budget_inr: float = 0.0
    contributors: list[Contributor] = Field(default_factory=list)
    items: list[CollabCartItem] = Field(default_factory=list)
    share_code: str = ""
    is_active: bool = True

    @property
    def total_estimated_cost(self) -> float:
        return sum(item.total_price_inr for item in self.items)

    @property
    def budget_remaining(self) -> float:
        if self.total_budget_inr <= 0:
            return 0.0
        return self.total_budget_inr - self.total_estimated_cost

    @property
    def contributor_count(self) -> int:
        return len(
            [
                contributor
                for contributor in self.contributors
                if contributor.status == ContributorStatus.ACTIVE
            ]
        )


class CreateCollabRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    host_name: str = Field(..., min_length=1, max_length=50)
    total_budget_inr: float = Field(0.0, ge=0)


class JoinCollabRequest(BaseModel):
    contributor_name: str = Field(..., min_length=1, max_length=50)


class CollabItemInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    quantity: float = Field(default=1.0, gt=0, le=100000)
    unit: str = Field(default="piece", min_length=1, max_length=24)
    category: str = Field(default="general", max_length=50)
    estimated_price_inr: float = Field(default=0.0, ge=0)
    notes: Optional[str] = Field(default=None, max_length=200)


class AddCollabItemsRequest(BaseModel):
    contributor_id: str
    items: list[CollabItemInput] = Field(default_factory=list, max_length=20)


class CollabSummary(BaseModel):
    session_id: str
    name: str
    share_code: str
    host_name: str
    contributor_count: int
    item_count: int
    total_budget_inr: float
    total_estimated_cost: float
    budget_remaining: float
    is_active: bool


class RemoveCollabItemRequest(BaseModel):
    contributor_id: str


class UpdateBudgetRequest(BaseModel):
    contributor_id: str
    new_budget_inr: float = Field(..., ge=0)


class BudgetSplit(BaseModel):
    """The cost attributable to one contributor's requested demand."""

    contributor_id: str
    name: str
    items_added: int
    amount_spent: float
    fair_share: float
    owes: float
    amount_owed: float
    percent_of_total: float
    merge_savings_inr: float


class WebSocketMessage(BaseModel):
    type: str
    data: dict
