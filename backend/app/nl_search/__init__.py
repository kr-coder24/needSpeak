"""
Natural Language Product Search Module

Lightweight LLM-powered search for hackathon demo.
Integrates ALL mock catalogs (562 V2 products + 25 electronics = 587 total).
Does NOT touch Amazon DynamoDB — all in-memory mock data only.
"""

from app.nl_search.query_parser import parse_product_query, ParsedQuery
from app.nl_search.catalog_matcher import match_products, search_products, MatchedProduct
from app.nl_search.demo_catalog import get_unified_catalog, get_products_by_category, get_catalog_stats

__all__ = [
    "parse_product_query",
    "ParsedQuery",
    "match_products",
    "search_products",
    "MatchedProduct",
    "get_unified_catalog",
    "get_products_by_category",
    "get_catalog_stats",
]
