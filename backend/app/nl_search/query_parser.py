"""
LLM-Powered Query Parser for Natural Language Product Search

Uses Gemini to extract structured intent from natural language product queries.
Designed for hackathon demo: lightweight, fast, focused on user experience.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional
from dataclasses import dataclass, field
from pydantic import BaseModel

from app import config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Parsed Query Schema
# ---------------------------------------------------------------------------

@dataclass
class ParsedQuery:
    """Structured representation of a parsed product query."""
    
    # Core intent
    category: str  # smartphone, laptop, headphones, shoes, etc.
    search_intent: str  # Brief description of what user wants
    
    # Required attributes (must-haves)
    required_specs: dict[str, Any] = field(default_factory=dict)
    # e.g., {"ram_gb": {"min": 8}, "5g": True}
    
    # Preferred attributes (nice-to-haves)
    preferred_features: list[str] = field(default_factory=list)
    # e.g., ["good battery", "fast charging", "gaming"]
    
    # Budget constraints
    max_budget_inr: Optional[int] = None
    budget_preference: str = "balanced"  # budget, balanced, premium
    
    # Brand preferences
    preferred_brands: list[str] = field(default_factory=list)
    avoided_brands: list[str] = field(default_factory=list)
    
    # Use case tags
    use_cases: list[str] = field(default_factory=list)
    # e.g., ["gaming", "coding", "travel", "daily use"]
    
    # Original query for reference
    original_query: str = ""
    
    # LLM confidence
    confidence: float = 0.0


# ---------------------------------------------------------------------------
# Query Parsing Prompt
# ---------------------------------------------------------------------------

QUERY_PARSE_PROMPT = """You are a product search assistant for an Indian retail platform. Analyze the user's natural language query and extract structured information to help find the best products.

INPUT QUERY: "{query}"

AVAILABLE CATEGORIES: smartphone, laptop, headphones, footwear, grains, dairy, snacks, beverages, spices, oils, vegetables, fruits, instant_food, cleaning, hygiene, personal_care, bakery, frozen, stationery, party_supplies, non_veg, breakfast, baby, pet, fashion_men, fashion_women, fashion_kids, accessories, medicines_otc

Extract the following in JSON format:
{{
    "category": "one of: smartphone, laptop, headphones, shoes",
    "search_intent": "brief 1-line summary of what user wants",
    "required_specs": {{
        // Specs the user explicitly mentioned as requirements
        // For smartphones: ram_gb, storage_gb, battery_mah, camera_mp, 5g, etc.
        // For laptops: ram_gb, storage_gb, processor, gpu, battery_hours, etc.
        // For headphones: noise_cancellation, wireless, battery_hours, etc.
        // For footwear/shoes: cushioning, stability, weight_g, etc.
        // For groceries/food: dietary (veg/vegan/jain), organic, sugar_free, etc.
        // For fashion: size, color, material, etc.
        // Use "min"/"max" for ranges, e.g., {{"ram_gb": {{"min": 8}}}}
    }},
    "preferred_features": [
        // Features user mentioned as nice-to-haves
        // e.g., "good battery", "fast charging", "lightweight", "gaming"
    ],
    "max_budget_inr": null_or_number,  // Extract budget if mentioned (convert ₹3000 to 3000)
    "budget_preference": "budget|balanced|premium",  // Infer from words like "cheap", "affordable", "best", "premium"
    "preferred_brands": [],  // Any brands user wants
    "avoided_brands": [],  // Any brands user wants to avoid
    "use_cases": [],  // e.g., ["gaming", "coding", "running", "travel", "daily use", "office"]
    "confidence": 0.0_to_1.0  // How confident you are in this interpretation
}}

EXAMPLES:

Query: "Phone with 8 GB RAM and good battery life"
{{
    "category": "smartphone",
    "search_intent": "Smartphone with 8GB RAM and long battery life",
    "required_specs": {{"ram_gb": {{"min": 8}}}},
    "preferred_features": ["good battery", "long battery life"],
    "max_budget_inr": null,
    "budget_preference": "balanced",
    "preferred_brands": [],
    "avoided_brands": [],
    "use_cases": ["daily use"],
    "confidence": 0.9
}}

Query: "Cheap laptop for coding"
{{
    "category": "laptop",
    "search_intent": "Affordable laptop suitable for programming",
    "required_specs": {{}},
    "preferred_features": ["coding", "programming", "good keyboard"],
    "max_budget_inr": null,
    "budget_preference": "budget",
    "preferred_brands": [],
    "avoided_brands": [],
    "use_cases": ["coding", "programming", "student"],
    "confidence": 0.85
}}

Query: "Wireless headphones with noise cancellation"
{{
    "category": "headphones",
    "search_intent": "Wireless headphones with active noise cancellation",
    "required_specs": {{"wireless": true, "noise_cancellation": true}},
    "preferred_features": [],
    "max_budget_inr": null,
    "budget_preference": "balanced",
    "preferred_brands": [],
    "avoided_brands": [],
    "use_cases": ["travel", "work from home"],
    "confidence": 0.95
}}

Query: "Running shoes under ₹3000"
{{
    "category": "shoes",
    "search_intent": "Running shoes within ₹3000 budget",
    "required_specs": {{}},
    "preferred_features": ["running", "comfortable"],
    "max_budget_inr": 3000,
    "budget_preference": "budget",
    "preferred_brands": [],
    "avoided_brands": [],
    "use_cases": ["running", "jogging"],
    "confidence": 0.9
}}

Now parse this query and return ONLY valid JSON (no markdown, no explanation):"""


# ---------------------------------------------------------------------------
# Mock Response for Testing
# ---------------------------------------------------------------------------

MOCK_RESPONSES: dict[str, dict] = {
    "phone with 8 gb ram": {
        "category": "smartphone",
        "search_intent": "Smartphone with 8GB RAM",
        "required_specs": {"ram_gb": {"min": 8}},
        "preferred_features": [],
        "max_budget_inr": None,
        "budget_preference": "balanced",
        "preferred_brands": [],
        "avoided_brands": [],
        "use_cases": ["daily use"],
        "confidence": 0.9
    },
    "cheap laptop for coding": {
        "category": "laptop",
        "search_intent": "Affordable laptop for programming",
        "required_specs": {},
        "preferred_features": ["coding", "programming"],
        "max_budget_inr": None,
        "budget_preference": "budget",
        "preferred_brands": [],
        "avoided_brands": [],
        "use_cases": ["coding", "student"],
        "confidence": 0.85
    },
    "wireless headphones with noise cancellation": {
        "category": "headphones",
        "search_intent": "Wireless headphones with ANC",
        "required_specs": {"wireless": True, "noise_cancellation": True},
        "preferred_features": [],
        "max_budget_inr": None,
        "budget_preference": "balanced",
        "preferred_brands": [],
        "avoided_brands": [],
        "use_cases": ["travel"],
        "confidence": 0.95
    },
    "running shoes under 3000": {
        "category": "shoes",
        "search_intent": "Budget running shoes",
        "required_specs": {},
        "preferred_features": ["running"],
        "max_budget_inr": 3000,
        "budget_preference": "budget",
        "preferred_brands": [],
        "avoided_brands": [],
        "use_cases": ["running"],
        "confidence": 0.9
    },
}


def _extract_budget(query_lower: str) -> int | None:
    """Extract budget from any query using multiple patterns."""
    import re
    patterns = [
        r'(?:under|below|within|less than|upto|up to|max(?:imum)?)\s*(?:rs\.?|₹|inr)?\s*(\d[\d,]*)',
        r'budget\s+(?:of\s+)?(?:rs\.?|₹|inr)?\s*(\d[\d,]*)',
        r'(?:rs\.?|₹|inr)\s*(\d[\d,]*)',
        r'(\d[\d,]*)\s*(?:rs\.?|₹|inr|rupees?)',
    ]
    for pat in patterns:
        m = re.search(pat, query_lower, re.IGNORECASE)
        if m:
            num = int(m.group(1).replace(',', ''))
            if num >= 100:  # sanity: ignore small numbers like "2 chips"
                return num
    return None


def _get_mock_response(query: str) -> dict:
    """Return a mock response based on query keywords."""
    query_lower = query.lower()
    
    # Always extract budget first — universal across all categories
    budget = _extract_budget(query_lower)
    
    # Check for keyword matches - ORDER MATTERS!
    # Check headphone/earphone BEFORE phone (since "headphone" contains "phone")
    if "headphone" in query_lower or "earphone" in query_lower or "earbud" in query_lower:
        response = {
            "category": "headphones",
            "search_intent": "Wireless headphones with noise cancellation",
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": budget,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["travel"],
            "confidence": 0.95
        }
        if "noise" in query_lower and "cancel" in query_lower:
            response["required_specs"]["noise_cancellation"] = True
        if "wireless" in query_lower:
            response["required_specs"]["wireless"] = True
        if "budget" in query_lower or "cheap" in query_lower:
            response["budget_preference"] = "budget"
        return response
    
    if "phone" in query_lower or "mobile" in query_lower or "smartphone" in query_lower:
        response = {
            "category": "smartphone",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": budget,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["daily use"],
            "confidence": 0.9
        }
        if "8" in query_lower and ("gb" in query_lower or "ram" in query_lower):
            response["required_specs"]["ram_gb"] = {"min": 8}
        if "12" in query_lower and ("gb" in query_lower or "ram" in query_lower):
            response["required_specs"]["ram_gb"] = {"min": 12}
        if "5g" in query_lower:
            response["required_specs"]["5g"] = True
        if "battery" in query_lower:
            response["preferred_features"].append("good battery")
        if "camera" in query_lower:
            response["preferred_features"].append("good camera")
        if "gaming" in query_lower:
            response["preferred_features"].append("gaming")
            response["use_cases"].append("gaming")
        if budget or "budget" in query_lower or "cheap" in query_lower or "affordable" in query_lower or "within" in query_lower:
            response["budget_preference"] = "budget"
        if "premium" in query_lower or "flagship" in query_lower:
            response["budget_preference"] = "premium"
        return response
    
    if "laptop" in query_lower:
        response = {
            "category": "laptop",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": budget,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": [],
            "confidence": 0.85
        }
        if "gaming" in query_lower:
            response["preferred_features"].append("gaming")
            response["use_cases"].append("gaming")
        if "coding" in query_lower or "programming" in query_lower:
            response["preferred_features"].append("coding")
            response["use_cases"].append("coding")
        if "cheap" in query_lower or "budget" in query_lower or "affordable" in query_lower:
            response["budget_preference"] = "budget"
        if "premium" in query_lower:
            response["budget_preference"] = "premium"
        if "rtx" in query_lower or "gpu" in query_lower:
            response["preferred_features"].append("RTX")
        return response
    
    if "shoe" in query_lower or "sneaker" in query_lower or "footwear" in query_lower or "joote" in query_lower:
        response = {
            "category": "footwear",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": [],
            "confidence": 0.9
        }
        import re
        budget_match = re.search(r'(?:under|below|within|max|budget)?\s*[₹rs.]*\s*(\d+)', query_lower)
        if budget_match:
            response["max_budget_inr"] = int(budget_match.group(1))
        if "running" in query_lower or "jogging" in query_lower:
            response["use_cases"].append("running")
            response["preferred_features"].append("running")
        if "walking" in query_lower:
            response["use_cases"].append("walking")
        if "budget" in query_lower or "cheap" in query_lower:
            response["budget_preference"] = "budget"
        return response

    # =========================================================================
    # GROCERY / FOOD categories
    # =========================================================================
    if any(kw in query_lower for kw in ["rice", "atta", "flour", "dal", "wheat", "grain", "oats", "poha", "rajma"]):
        response = {
            "category": "grains",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["cooking"],
            "confidence": 0.9
        }
        if "veg" in query_lower or "vegetarian" in query_lower:
            response["required_specs"]["dietary"] = "veg"
        if "organic" in query_lower:
            response["preferred_features"].append("organic")
        return response

    if any(kw in query_lower for kw in ["milk", "curd", "paneer", "butter", "ghee", "cheese", "yogurt", "dahi", "dairy"]):
        return {
            "category": "dairy",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["cooking", "everyday"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["chips", "biscuit", "namkeen", "noodles", "maggi", "snack", "kurkure"]):
        return {
            "category": "snacks",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["snack", "party"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["juice", "cold drink", "coffee", "tea", "water", "coke", "pepsi", "drink", "beverage"]):
        return {
            "category": "beverages",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["party", "everyday"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["masala", "spice", "haldi", "turmeric", "chilli", "jeera", "cumin", "salt"]):
        return {
            "category": "spices",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["cooking"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["oil", "cooking oil", "mustard oil", "sunflower", "olive"]):
        return {
            "category": "oils",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["cooking"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["onion", "tomato", "potato", "vegetable", "sabzi", "bhindi", "palak"]):
        return {
            "category": "vegetables",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["cooking"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["fruit", "apple", "banana", "mango", "orange", "grape"]):
        return {
            "category": "fruits",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["healthy"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["soap", "shampoo", "toothpaste", "face wash", "body wash", "hygiene"]):
        return {
            "category": "hygiene",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["everyday"],
            "confidence": 0.85
        }

    if any(kw in query_lower for kw in ["detergent", "floor cleaner", "toilet cleaner", "dishwash", "cleaning"]):
        return {
            "category": "cleaning",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["household"],
            "confidence": 0.85
        }

    if any(kw in query_lower for kw in ["shirt", "t-shirt", "tshirt", "jeans", "trouser", "kurta", "men"]):
        return {
            "category": "fashion_men",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["casual"],
            "confidence": 0.8
        }

    if any(kw in query_lower for kw in ["dress", "saree", "kurti", "legging", "women"]):
        return {
            "category": "fashion_women",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["casual"],
            "confidence": 0.8
        }

    if any(kw in query_lower for kw in ["medicine", "tablet", "syrup", "paracetamol", "cough", "pain relief", "band-aid"]):
        return {
            "category": "medicines_otc",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["health"],
            "confidence": 0.85
        }

    if any(kw in query_lower for kw in ["baby", "diaper", "wipes", "cerelac", "baby food"]):
        return {
            "category": "baby",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["baby care"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["pet", "dog food", "cat food", "pet food"]):
        return {
            "category": "pet",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["pet care"],
            "confidence": 0.9
        }

    if any(kw in query_lower for kw in ["breakfast", "cereal", "muesli", "cornflakes", "chocos", "oats"]):
        return {
            "category": "breakfast",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["breakfast"],
            "confidence": 0.9
        }
    
    if any(kw in query_lower for kw in ["party", "balloon", "decoration", "candle", "plate", "cup", "napkin"]):
        return {
            "category": "party_supplies",
            "search_intent": query,
            "required_specs": {},
            "preferred_features": [],
            "max_budget_inr": None,
            "budget_preference": "balanced",
            "preferred_brands": [],
            "avoided_brands": [],
            "use_cases": ["party"],
            "confidence": 0.85
        }
    
    # Extract budget from any query
    import re
    budget_match = re.search(r'(?:under|below|within|max|budget)?\s*[₹rs.]*\s*(\d+)', query_lower)
    
    # Default: general search across all categories
    return {
        "category": "general",
        "search_intent": query,
        "required_specs": {},
        "preferred_features": [],
        "max_budget_inr": int(budget_match.group(1)) if budget_match else None,
        "budget_preference": "budget" if any(w in query_lower for w in ["cheap", "budget", "affordable", "sasta"]) else "balanced",
        "preferred_brands": [],
        "avoided_brands": [],
        "use_cases": [],
        "confidence": 0.5
    }


# ---------------------------------------------------------------------------
# LLM Query Parsing
# ---------------------------------------------------------------------------

def parse_product_query(query: str, mock_mode: bool = False) -> ParsedQuery:
    """
    Parse a natural language product query using the LLM.
    
    Args:
        query: Natural language product query
        mock_mode: If True, return mock response without calling LLM
    
    Returns:
        ParsedQuery with extracted intent and filters
    """
    if not query or not query.strip():
        return ParsedQuery(
            category="general",
            search_intent="Empty query",
            original_query=query,
            confidence=0.0
        )
    
    query = query.strip()
    
    # Mock mode for testing
    if mock_mode or config.MOCK_MODE:
        logger.info(f"[NL Search] Mock mode: parsing query '{query}'")
        mock_result = _get_mock_response(query)
        return ParsedQuery(
            category=mock_result.get("category", "general"),
            search_intent=mock_result.get("search_intent", query),
            required_specs=mock_result.get("required_specs", {}),
            preferred_features=mock_result.get("preferred_features", []),
            max_budget_inr=mock_result.get("max_budget_inr"),
            budget_preference=mock_result.get("budget_preference", "balanced"),
            preferred_brands=mock_result.get("preferred_brands", []),
            avoided_brands=mock_result.get("avoided_brands", []),
            use_cases=mock_result.get("use_cases", []),
            original_query=query,
            confidence=mock_result.get("confidence", 0.8)
        )
    
    # Use Gemini for LLM parsing
    try:
        from app.pipeline.gemini_client import get_gemini_client
        
        client = get_gemini_client()
        prompt = QUERY_PARSE_PROMPT.format(query=query)
        
        response = client.models.generate_content(
            model=config.GEMINI_MODEL_ID,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        
        response_text = response.text.strip() if response.text else ""
        
        # Clean up response (remove markdown code blocks if present)
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        
        # Parse JSON
        try:
            result = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.warning(f"[NL Search] Failed to parse LLM response as JSON: {e}")
            logger.debug(f"[NL Search] Raw response: {response_text}")
            # Fall back to mock
            return parse_product_query(query, mock_mode=True)
        
        logger.info(f"[NL Search] Parsed query: category={result.get('category')}, intent={result.get('search_intent')}")
        
        return ParsedQuery(
            category=result.get("category", "general"),
            search_intent=result.get("search_intent", query),
            required_specs=result.get("required_specs", {}),
            preferred_features=result.get("preferred_features", []),
            max_budget_inr=result.get("max_budget_inr"),
            budget_preference=result.get("budget_preference", "balanced"),
            preferred_brands=result.get("preferred_brands", []),
            avoided_brands=result.get("avoided_brands", []),
            use_cases=result.get("use_cases", []),
            original_query=query,
            confidence=result.get("confidence", 0.8)
        )
        
    except Exception as e:
        logger.error(f"[NL Search] LLM parsing failed: {e}")
        # Fall back to mock response
        return parse_product_query(query, mock_mode=True)
