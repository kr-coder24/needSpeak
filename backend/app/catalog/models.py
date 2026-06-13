"""
Product catalog models for NeedSpeak.
Defines the enriched product schema with synonyms, reviews, dietary/occasion tags,
and search text for retrieval.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class Product(BaseModel):
    """Full product schema for the NeedSpeak catalog."""

    sku: str
    title: str  # lowercase normalized product name
    brand: str
    category: str
    subcategory: str = ""
    price_inr: Decimal
    mrp_inr: Optional[Decimal] = None
    discount_pct: Decimal = Decimal("0")
    unit: str  # g, ml, piece, pack, etc.
    unit_quantity: Decimal  # quantity per unit (e.g., 1000 for 1kg)
    rating: Decimal = Decimal("0")
    review_count: int = 0
    review_preview: list[str] = Field(default_factory=list)
    in_stock: bool = True
    keywords: set[str] = Field(default_factory=set)
    synonyms: set[str] = Field(default_factory=set)
    tags: set[str] = Field(default_factory=set)
    dietary_tags: set[str] = Field(default_factory=set)  # veg, vegan, jain, non-veg
    allergen_tags: set[str] = Field(default_factory=set)  # gluten, lactose, nuts, etc.
    occasion_tags: set[str] = Field(default_factory=set)  # party, birthday, picnic, etc.
    image_url: str = ""
    search_text: str = ""  # concatenated text for BM25-style retrieval

    class Config:
        arbitrary_types_allowed = True

    def build_search_text(self) -> str:
        """Generate a searchable text blob combining all text fields."""
        parts = [
            self.title,
            self.brand.lower(),
            self.category,
            self.subcategory,
            " ".join(self.keywords),
            " ".join(self.synonyms),
            " ".join(self.tags),
            " ".join(self.occasion_tags),
        ]
        return " ".join(p for p in parts if p).lower()


class ProductCandidate(BaseModel):
    """A product candidate returned by retrieval, with relevance scores."""

    sku: str
    title: str
    brand: str
    category: str
    subcategory: str = ""
    price_inr: float
    unit: str
    unit_quantity: float
    rating: float = 0
    review_count: int = 0
    in_stock: bool = True
    dietary_tags: set[str] = Field(default_factory=set)
    occasion_tags: set[str] = Field(default_factory=set)
    keywords: set[str] = Field(default_factory=set)
    image_url: str = ""

    # Retrieval scores (set by retriever)
    text_score: float = 0.0
    semantic_score: float = 0.0


class ProductQuery(BaseModel):
    """Query object for product retrieval."""

    query_text: str  # the extracted item name or description
    category: Optional[str] = None
    dietary_filter: Optional[str] = None  # veg, vegan, jain
    max_price: Optional[float] = None
    occasion: Optional[str] = None
    preferred_brands: list[str] = Field(default_factory=list)
    avoided_brands: list[str] = Field(default_factory=list)


class RankedProduct(BaseModel):
    """A product after ranking with score breakdown."""

    sku: str
    title: str
    brand: str
    category: str
    price_inr: float
    unit: str
    unit_quantity: float
    rating: float = 0
    review_count: int = 0
    in_stock: bool = True
    dietary_tags: set[str] = Field(default_factory=set)
    image_url: str = ""

    # Ranking output
    score: float = 0.0
    score_breakdown: dict[str, float] = Field(default_factory=dict)
    reason_codes: list[str] = Field(default_factory=list)
    display_reason: str = ""


class ProductAlternative(BaseModel):
    """An alternative product suggestion."""

    sku: str
    name: str
    brand: str
    price_per_unit_inr: float
    rating: Optional[float] = None
    review_count: Optional[int] = None
    reason: str  # e.g., "Save ₹30", "Higher rated", "Preferred brand"
