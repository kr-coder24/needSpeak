"""
URL fetcher for recipe sites with structured schema.org/Recipe JSON-LD.

Only supports server-rendered sites that embed JSON-LD in HTML:
- AllRecipes.com
- BBCGoodFood.com (if time permits)

Does NOT use JavaScript rendering (no Playwright/Puppeteer).
"""

from __future__ import annotations

import json
import logging
import re
from urllib.parse import urlparse
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Known JS-only / login-required sites that cannot be scraped
# ---------------------------------------------------------------------------
JAVASCRIPT_ONLY_DOMAINS = {
    "instagram.com",
    "www.instagram.com",
    "zomato.com",
    "www.zomato.com",
    "swiggy.com",
    "www.swiggy.com",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


# ---------------------------------------------------------------------------
# URL Helpers
# ---------------------------------------------------------------------------
def is_youtube_url(url: str) -> bool:
    """Check if the URL is a YouTube video."""
    try:
        parsed = urlparse(url)
        domain = (parsed.hostname or "").lower()
        return domain in ("youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com")
    except Exception:
        return False


def _is_js_only_domain(url: str) -> bool:
    """Return True for sites that are known to require JavaScript / login."""
    try:
        parsed = urlparse(url)
        domain = (parsed.hostname or "").lower()
        return domain in JAVASCRIPT_ONLY_DOMAINS
    except Exception:
        return False


def _js_only_message(url: str) -> str:
    """Generate a descriptive error for JS-only sites."""
    try:
        parsed = urlparse(url)
        domain = (parsed.hostname or "unknown").lower()
    except Exception:
        domain = "unknown"

    messages = {
        "instagram.com": "Instagram requires login and renders dynamically.",
        "www.instagram.com": "Instagram requires login and renders dynamically.",
        "zomato.com": "Zomato uses React rendering — no content in raw HTML.",
        "www.zomato.com": "Zomato uses React rendering — no content in raw HTML.",
        "swiggy.com": "Swiggy uses React rendering — no content in raw HTML.",
        "www.swiggy.com": "Swiggy uses React rendering — no content in raw HTML.",
    }
    reason = messages.get(domain, "This site requires JavaScript and cannot be scraped.")
    return f"{reason} Please paste the recipe or list text directly instead."


# ---------------------------------------------------------------------------
# Recipe Extraction
# ---------------------------------------------------------------------------
def _extract_json_ld_recipe(html: str) -> Optional[dict]:
    """
    Extract schema.org/Recipe JSON-LD from HTML.
    Returns the Recipe dict if found, None otherwise.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Find all JSON-LD script tags
    ld_scripts = soup.find_all("script", {"type": "application/ld+json"})

    for script in ld_scripts:
        try:
            data = json.loads(script.string or "")

            # Handle single object
            if isinstance(data, dict):
                if data.get("@type") == "Recipe":
                    return data
                # Some sites wrap in @graph
                if "@graph" in data:
                    for item in data["@graph"]:
                        if isinstance(item, dict) and item.get("@type") == "Recipe":
                            return item

            # Handle array of objects
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "Recipe":
                        return item

        except (json.JSONDecodeError, TypeError):
            continue

    return None


def _recipe_to_text(recipe: dict) -> str:
    """
    Convert a schema.org Recipe JSON-LD to plain text for the extractor.
    """
    parts = []

    # Name
    name = recipe.get("name", "Unnamed Recipe")
    parts.append(f"Recipe: {name}")

    # Yield/servings
    recipe_yield = recipe.get("recipeYield")
    if recipe_yield:
        if isinstance(recipe_yield, list):
            recipe_yield = recipe_yield[0]
        parts.append(f"Servings: {recipe_yield}")

    # Ingredients
    ingredients = recipe.get("recipeIngredient", [])
    if ingredients:
        parts.append("\nIngredients:")
        for ing in ingredients:
            parts.append(f"- {ing}")

    # Instructions (for context — helps the extractor understand usage)
    instructions = recipe.get("recipeInstructions", [])
    if instructions:
        parts.append("\nInstructions:")
        for step in instructions:
            if isinstance(step, dict):
                text = step.get("text", "")
            elif isinstance(step, str):
                text = step
            else:
                continue
            if text:
                parts.append(f"- {text}")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Main Fetch Function
# ---------------------------------------------------------------------------
def fetch_url_content(url: str) -> str:
    """
    Fetch a recipe URL and extract its content as plain text.

    Tries any HTTP(S) URL:
    1. JSON-LD schema.org/Recipe extraction (works for most food blogs)
    2. Fallback: raw body text extraction

    Raises ValueError with helpful message if nothing usable is found.
    """
    # Reject known JS-only / login-required sites immediately
    if _is_js_only_domain(url):
        raise ValueError(_js_only_message(url))

    try:
        response = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
    except requests.Timeout:
        raise ValueError("The recipe page took too long to load. Please try again or paste the recipe text directly.")
    except requests.ConnectionError:
        raise ValueError("Could not connect to the recipe site. The site might be down — please paste the recipe text directly.")
    except requests.exceptions.SSLError:
        raise ValueError("Secure connection failed to the recipe site. Please paste the recipe text directly.")
    except requests.exceptions.TooManyRedirects:
        raise ValueError("The recipe URL redirected too many times. Please paste the recipe text directly.")
    except requests.RequestException as e:
        raise ValueError(f"Could not fetch the URL: {e}. Please paste the recipe text directly.")

    # Status-code-specific messages
    if response.status_code == 404:
        raise ValueError("Recipe page not found (404). The URL may be broken — please double-check it or paste the recipe text.")
    if response.status_code == 403:
        raise ValueError("The recipe site blocked our request (403 Forbidden). Please paste the recipe text directly.")
    if response.status_code == 429:
        raise ValueError("Too many requests to the recipe site. Please wait a moment and try again.")
    if response.status_code >= 500:
        raise ValueError("The recipe site is experiencing issues (server error). Please try again later or paste the recipe text.")
    if not response.ok:
        raise ValueError(f"The recipe site returned an error (HTTP {response.status_code}). Please paste the recipe text directly.")

    html = response.text

    # Try JSON-LD extraction
    recipe = _extract_json_ld_recipe(html)
    if recipe:
        text = _recipe_to_text(recipe)
        logger.info(f"Extracted recipe from JSON-LD: {recipe.get('name', 'Unknown')}")
        return text

    # Fallback: try to extract text content from the page body
    soup = BeautifulSoup(html, "html.parser")

    # Remove script and style tags
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()

    body_text = soup.get_text(separator="\n", strip=True)

    if len(body_text) < 50:
        raise ValueError(
            "Could not find recipe content on this page. "
            "The site may use JavaScript rendering. "
            "Please paste the recipe text directly instead."
        )

    # Truncate to reasonable length
    if len(body_text) > 5000:
        body_text = body_text[:5000]

    logger.info(f"Extracted text content from URL (fallback, {len(body_text)} chars)")
    return body_text
