#!/usr/bin/env python3
"""
Test script for Natural Language Product Search API

Run this after starting the server:
    uvicorn app.main:app --reload --port 8000

Then in another terminal:
    python test_nl_search.py
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/nl-search"

def test_search(query: str, mock_mode: bool = True) -> None:
    """Test the natural language search endpoint."""
    print(f"\n{'=' * 60}")
    print(f"🔍 Query: \"{query}\"")
    print("=" * 60)
    
    response = requests.post(
        f"{BASE_URL}/search",
        json={"query": query, "limit": 5, "mock_mode": mock_mode}
    )
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    parsed = data["parsed_query"]
    products = data["products"]
    
    print(f"\n📋 Parsed Query:")
    print(f"   Category: {parsed['category']}")
    print(f"   Intent: {parsed['search_intent']}")
    print(f"   Required Specs: {parsed['required_specs']}")
    print(f"   Preferred Features: {parsed['preferred_features']}")
    if parsed.get("max_budget_inr"):
        print(f"   Budget: ₹{parsed['max_budget_inr']:,}")
    print(f"   Confidence: {parsed['confidence']:.0%}")
    
    print(f"\n📦 Results ({data['total_found']} found):")
    for i, product in enumerate(products[:3], 1):
        print(f"\n   {i}. {product['name']}")
        print(f"      Brand: {product['brand']}")
        print(f"      Price: ₹{product['price_inr']:,}")
        print(f"      Rating: {product['rating']}★ ({product['review_count']:,} reviews)")
        print(f"      Score: {product['relevance_score']}")
        if product['match_reasons']:
            print(f"      Matches: {', '.join(product['match_reasons'][:3])}")
        print(f"      💡 {product['explanation']}")
    
    print(f"\n📝 Summary: {data['search_summary']}")


def test_catalog_overview() -> None:
    """Test the catalog overview endpoint."""
    print("\n" + "=" * 60)
    print("📊 Catalog Overview")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/catalog")
    data = response.json()
    
    print(f"   Total Products: {data['total_products']}")
    print(f"   Categories: {data['categories']}")
    print(f"   Price Range: ₹{data['price_range']['min']:,} - ₹{data['price_range']['max']:,}")
    print(f"   Brands: {', '.join(data['brands'][:10])}...")


def main():
    print("\n" + "🚀 NATURAL LANGUAGE PRODUCT SEARCH - API TEST")
    print("=" * 60)
    
    # Test catalog overview
    try:
        test_catalog_overview()
    except requests.exceptions.ConnectionError:
        print("❌ Server not running! Start with: uvicorn app.main:app --reload --port 8000")
        return
    
    # Test various queries
    test_queries = [
        "Phone with 8 GB RAM and good battery life",
        "Cheap laptop for coding",
        "Wireless headphones with noise cancellation",
        "Running shoes under ₹3000",
        "Gaming laptop with RTX",
    ]
    
    for query in test_queries:
        test_search(query, mock_mode=True)
    
    print("\n\n✅ All tests completed!")


if __name__ == "__main__":
    main()
