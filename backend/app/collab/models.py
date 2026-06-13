"""
Collaborative Cart Models — Pydantic models for SplitCart feature.

These models are specific to the collaboration feature and do not
conflict with the main models.py (owned by Person A).

Person C owns this file.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


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
    joined_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    items_added: int = 0
    budget_contribution_inr: float = 0.0


class CollabCartItem(BaseModel):
    """An item in the collaborative cart, with contributor attribution."""
    id: str
    name: str
    quantity: float = 1.0
    unit: str = "piece"
    category: str = "general"
    estimated_price_inr: float = 0.0
    added_by: str  # contributor ID
    added_by_name: str
    notes: Optional[str] = None


class CollabSession(BaseModel):
    """A collaborative cart session with shared budget and contributors."""
    session_id: str
    name: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    host_id: str
    host_name: str
    total_budget_inr: float = 0.0
    contributors: list[Contributor] = Field(default_factory=list)
    items: list[CollabCartItem] = Field(default_factory=list)
    share_code: str = ""  # Short code for sharing
    is_active: bool = True

    @property
    def total_estimated_cost(self) -> float:
        return sum(item.estimated_price_inr * item.quantity for item in self.items)

    @property
    def budget_remaining(self) -> float:
        if self.total_budget_inr <= 0:
            return float("inf")
        return self.total_budget_inr - self.total_estimated_cost

    @property
    def contributor_count(self) -> int:
        return len([c for c in self.contributors if c.status == ContributorStatus.ACTIVE])


# ---------------------------------------------------------------------------
# API Request/Response models
# ---------------------------------------------------------------------------
class CreateCollabRequest(BaseModel):
    """Request to create a new collaborative cart."""
    name: str = Field(..., min_length=1, max_length=100)
    host_name: str = Field(..., min_length=1, max_length=50)
    total_budget_inr: float = Field(0.0, ge=0)


class JoinCollabRequest(BaseModel):
    """Request to join an existing collaborative cart."""
    contributor_name: str = Field(..., min_length=1, max_length=50)


class AddCollabItemsRequest(BaseModel):
    """Request to add items to a collaborative cart."""
    contributor_id: str
    items: list[CollabItemInput] = Field(default_factory=list)


class CollabItemInput(BaseModel):
    """Input for a single item to add to the collab cart."""
    name: str
    quantity: float = 1.0
    unit: str = "piece"
    category: str = "general"
    estimated_price_inr: float = 0.0
    notes: Optional[str] = None


# Fix forward reference
AddCollabItemsRequest.model_rebuild()


class CollabSummary(BaseModel):
    """Summary view of a collaborative cart session."""
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
    """Request to remove an item from the collaborative cart."""
    contributor_id: str

class UpdateBudgetRequest(BaseModel):
    """Request to update the total budget."""
    contributor_id: str
    new_budget_inr: float = Field(..., ge=0)

class BudgetSplit(BaseModel):
    """Represents the budget split for a single contributor."""
    contributor_id: str
    name: str
    items_added: int
    amount_spent: float
    fair_share: float
    owes: float  # Positive means owes to pool, negative means gets from pool

class WebSocketMessage(BaseModel):
    """Typed WebSocket message payload."""
    type: str
    data: dict
