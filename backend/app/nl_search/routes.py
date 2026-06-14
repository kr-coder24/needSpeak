"""
API Routes for Natural Language Product Search

Endpoints for the hackathon demo intelligent shopping assistant.
"""

from __future__ import annotations

import logging
from typing import Optional, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.nl_search.query_parser import parse_product_query, ParsedQuery
from app.nl_search.catalog_matcher import match_products, search_products, MatchedProduct
from app.nl_search.demo_catalog import get_unified_catalog, get_products_by_category, get_catalog_stats

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nl-search", tags=["Natural Language Search"])


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class NLSearchRequest(BaseModel):
    """Request for natural language product search."""
    query: str = Field(..., description="Natural language product query", min_length=1, max_length=500)
    limit: int = Field(default=5, ge=1, le=20, description="Maximum number of results")
    mock_mode: bool = Field(default=False, description="Use mock LLM responses for testing")


class ParsedQueryResponse(BaseModel):
    """LLM-parsed query structure."""
    category: str
    search_intent: str
    required_specs: dict[str, Any]
    preferred_features: list[str]
    max_budget_inr: Optional[int]
    budget_preference: str
    preferred_brands: list[str]
    avoided_brands: list[str]
    use_cases: list[str]
    confidence: float


class ProductResult(BaseModel):
    """Single product result."""
    sku: str
    name: str
    brand: str
    category: str
    price_inr: int
    specs: dict[str, Any]
    features: list[str]
    tags: list[str]
    rating: float
    review_count: int
    in_stock: bool
    image_url: str
    relevance_score: float
    match_reasons: list[str]
    missing_requirements: list[str]
    explanation: str


class NLSearchResponse(BaseModel):
    """Response from natural language search."""
    success: bool
    query: str
    parsed_query: ParsedQueryResponse
    products: list[ProductResult]
    total_found: int
    search_summary: str


class CatalogOverviewResponse(BaseModel):
    """Overview of available products in the demo catalog."""
    total_products: int
    categories: dict[str, int]
    price_range: dict[str, int]
    brands: list[str]


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.post("/search", response_model=NLSearchResponse)
async def natural_language_search(request: NLSearchRequest):
    """
    Search products using natural language queries.
    
    The LLM extracts intent, required specs, preferences, and budget from your query,
    then matches against our curated product catalog.
    
    Examples:
    - "Phone with 8 GB RAM and good battery life"
    - "Cheap laptop for coding"
    - "Wireless headphones with noise cancellation"
    - "Running shoes under ₹3000"
    """
    logger.info(f"[NL Search API] Query: '{request.query}'")
    
    try:
        # Parse query and match products
        parsed, results = search_products(
            query=request.query,
            mock_mode=request.mock_mode,
            limit=request.limit,
        )
        
        # Build response
        parsed_response = ParsedQueryResponse(
            category=parsed.category,
            search_intent=parsed.search_intent,
            required_specs=parsed.required_specs,
            preferred_features=parsed.preferred_features,
            max_budget_inr=parsed.max_budget_inr,
            budget_preference=parsed.budget_preference,
            preferred_brands=parsed.preferred_brands,
            avoided_brands=parsed.avoided_brands,
            use_cases=parsed.use_cases,
            confidence=parsed.confidence,
        )
        
        product_results = [
            ProductResult(
                sku=p.sku,
                name=p.name,
                brand=p.brand,
                category=p.category,
                price_inr=p.price_inr,
                specs=p.specs,
                features=p.features,
                tags=p.tags,
                rating=p.rating,
                review_count=p.review_count,
                in_stock=p.in_stock,
                image_url=p.image_url,
                relevance_score=round(p.relevance_score, 2),
                match_reasons=p.match_reasons,
                missing_requirements=p.missing_requirements,
                explanation=p.explanation,
            )
            for p in results
        ]
        
        # Generate search summary
        summary = _generate_search_summary(parsed, results)
        
        return NLSearchResponse(
            success=True,
            query=request.query,
            parsed_query=parsed_response,
            products=product_results,
            total_found=len(results),
            search_summary=summary,
        )
        
    except Exception as e:
        logger.error(f"[NL Search API] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/catalog", response_model=CatalogOverviewResponse)
async def get_catalog_overview():
    """
    Get an overview of the unified demo product catalog.
    
    Returns category counts, price ranges, and available brands.
    Includes both grocery (562 products) and electronics (25 products).
    """
    stats = get_catalog_stats()
    
    return CatalogOverviewResponse(
        total_products=stats["total_products"],
        categories=stats["categories"],
        price_range=stats["price_range"],
        brands=stats["brands"],
    )


@router.get("/products")
async def list_products(
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(20, ge=1, le=50, description="Maximum results"),
):
    """
    List products from the unified demo catalog.
    
    Filter by any category: smartphone, laptop, headphones, footwear,
    grains, dairy, snacks, beverages, spices, oils, vegetables, fruits,
    cleaning, hygiene, fashion_men, fashion_women, medicines_otc, etc.
    """
    if category:
        products = get_products_by_category(category)
    else:
        products = get_unified_catalog()
    
    return {
        "total": len(products),
        "products": products[:limit],
    }


@router.post("/parse-query")
async def parse_query_only(request: NLSearchRequest):
    """
    Parse a natural language query without searching.
    
    Useful for debugging or understanding how the LLM interprets queries.
    """
    parsed = parse_product_query(request.query, mock_mode=request.mock_mode)
    
    return {
        "query": request.query,
        "parsed": {
            "category": parsed.category,
            "search_intent": parsed.search_intent,
            "required_specs": parsed.required_specs,
            "preferred_features": parsed.preferred_features,
            "max_budget_inr": parsed.max_budget_inr,
            "budget_preference": parsed.budget_preference,
            "preferred_brands": parsed.preferred_brands,
            "avoided_brands": parsed.avoided_brands,
            "use_cases": parsed.use_cases,
            "confidence": parsed.confidence,
        }
    }


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _generate_search_summary(parsed: ParsedQuery, results: list[MatchedProduct]) -> str:
    """Generate a human-readable search summary."""
    if not results:
        return f"No products found matching '{parsed.search_intent}'. Try broadening your search criteria."
    
    parts = []
    
    # Opening
    parts.append(f"Found {len(results)} {parsed.category}s matching your requirements")
    
    # Best match highlight
    best = results[0]
    if best.relevance_score > 50:
        parts.append(f". Top recommendation: {best.brand} {best.name} at ₹{best.price_inr:,}")
        if best.rating >= 4.5:
            parts.append(f" ({best.rating}★ rating)")
    
    # Budget context
    if parsed.max_budget_inr:
        in_budget = sum(1 for r in results if r.price_inr <= parsed.max_budget_inr)
        if in_budget == len(results):
            parts.append(f". All {len(results)} options are within your ₹{parsed.max_budget_inr:,} budget")
        elif in_budget > 0:
            parts.append(f". {in_budget} of {len(results)} options are within your ₹{parsed.max_budget_inr:,} budget")
        else:
            parts.append(f". Note: All results exceed your ₹{parsed.max_budget_inr:,} budget")
    
    # Key filters applied
    if parsed.required_specs:
        spec_names = list(parsed.required_specs.keys())
        parts.append(f". Filtered for: {', '.join(spec_names[:3])}")
    
    return "".join(parts) + "."
