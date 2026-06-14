"""
Local BM25-style product retriever.
Works with in-memory product catalog — no external services needed.
Used for local demo and as fallback when OpenSearch is unavailable.
"""

from __future__ import annotations

import logging
import math
from collections import Counter

from app.catalog.models import ProductCandidate, ProductQuery
from app.db.dynamo import get_all_products

logger = logging.getLogger(__name__)

# Stop words to ignore during tokenization
STOP_WORDS = frozenset({
    "fresh", "organic", "large", "small", "medium", "raw", "whole", "pure",
    "natural", "best", "good", "with", "and", "or", "of", "for", "in", "to",
    "a", "an", "the", "is", "it", "my", "i", "we", "our", "some", "get",
    "buy", "need", "want", "please", "pack", "packet", "bottle", "bag",
})


def _tokenize(text: str) -> list[str]:
    """Split text into lowercase word tokens, removing stop words."""
    tokens = text.lower().replace("-", " ").replace("_", " ").replace(",", " ").split()
    normalized = []
    for token in tokens:
        if token in STOP_WORDS or len(token) <= 1:
            continue
        if len(token) > 3 and token.endswith("s"):
            token = token[:-1]
        normalized.append(token)
    return normalized


def _build_search_text(product: dict) -> str:
    """Build a searchable text string from product fields."""
    parts = [
        product.get("name", ""),
        product.get("brand", ""),
        product.get("category", ""),
        product.get("subcategory", ""),
    ]

    # Keywords
    kw = product.get("keywords", [])
    if isinstance(kw, (set, list)):
        parts.extend(str(k) for k in kw if not isinstance(k, dict))
    elif isinstance(kw, str):
        parts.append(kw)

    # Synonyms
    syn = product.get("synonyms", [])
    if isinstance(syn, (set, list)):
        parts.extend(str(s) for s in syn)

    # Tags
    tags = product.get("tags", [])
    if isinstance(tags, (set, list)):
        parts.extend(str(t) for t in tags)

    # Occasion tags
    occ = product.get("occasion_tags", [])
    if isinstance(occ, (set, list)):
        parts.extend(str(o) for o in occ)

    return " ".join(p for p in parts if p).lower()


def _as_lower_set(value) -> set[str]:
    """Normalize list/set/string metadata to lowercase strings."""
    if isinstance(value, (set, list, tuple)):
        return {str(v).lower() for v in value if v is not None}
    if isinstance(value, str):
        return {value.lower()}
    return set()


def _bm25_score(
    query_tokens: list[str],
    doc_tokens: list[str],
    doc_freq: Counter,
    num_docs: int,
    avg_doc_len: float,
    k1: float = 1.5,
    b: float = 0.75,
) -> float:
    """
    Calculate BM25 score for a single document against query tokens.
    """
    doc_len = len(doc_tokens)
    doc_token_freq = Counter(doc_tokens)
    score = 0.0

    for token in query_tokens:
        if token not in doc_token_freq:
            continue

        tf = doc_token_freq[token]
        df = doc_freq.get(token, 0)

        # IDF: log((N - df + 0.5) / (df + 0.5) + 1)
        idf = math.log((num_docs - df + 0.5) / (df + 0.5) + 1.0)

        # TF normalization
        tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc_len / avg_doc_len))

        score += idf * tf_norm

    return score


class LocalRetriever:
    """
    In-memory BM25-style product retriever.
    Loads all products, tokenizes them, and scores against query.
    """

    def __init__(self, mock_mode: bool = False):
        self._mock_mode = mock_mode
        self._products: list[dict] = []
        self._doc_tokens: list[list[str]] = []
        self._doc_freq: Counter = Counter()
        self._avg_doc_len: float = 0.0
        self._loaded = False

    def _ensure_loaded(self):
        """Load and index products on first use."""
        if self._loaded:
            return

        self._products = get_all_products(mock_mode=self._mock_mode)
        self._doc_tokens = []

        for product in self._products:
            search_text = _build_search_text(product)
            tokens = _tokenize(search_text)
            self._doc_tokens.append(tokens)

            # Document frequency: count unique tokens per doc
            for token in set(tokens):
                self._doc_freq[token] += 1

        total_tokens = sum(len(t) for t in self._doc_tokens)
        self._avg_doc_len = total_tokens / max(len(self._products), 1)
        self._loaded = True

        logger.info(f"LocalRetriever indexed {len(self._products)} products")

    def retrieve(
        self,
        query: ProductQuery,
        limit: int = 50,
    ) -> list[ProductCandidate]:
        """
        Retrieve candidate products using BM25-style text scoring.
        Applies filters for dietary, price, and brand preferences.
        """
        self._ensure_loaded()

        query_tokens = _tokenize(query.query_text)
        if not query_tokens:
            return []

        num_docs = len(self._products)
        scored: list[tuple[float, int]] = []

        for idx, (product, doc_tokens) in enumerate(zip(self._products, self._doc_tokens)):
            # Skip out-of-stock
            if not product.get("in_stock", True):
                continue

            # Apply dietary filter
            if query.dietary_filter and query.dietary_filter != "any":
                product_dietary = _as_lower_set(
                    product.get("dietary_tags", product.get("dietary", set()))
                )
                if query.dietary_filter.lower() not in product_dietary:
                    continue

            # Apply brand avoidance filter
            if query.avoided_brands:
                product_brand = product.get("brand", "").lower()
                if any(b.lower() == product_brand for b in query.avoided_brands):
                    continue

            # Apply broad category avoidance without removing unrelated matches.
            if query.avoided_categories:
                product_category = product.get("category", "").lower()
                product_subcategory = product.get("subcategory", "").lower()
                if any(
                    c.lower() in (product_category, product_subcategory)
                    for c in query.avoided_categories
                ):
                    continue

            # Apply max price filter
            if query.max_price is not None:
                product_price = float(product.get("price_inr", 0))
                if product_price > query.max_price:
                    continue

            product_category = product.get("category", "").lower()
            product_subcategory = product.get("subcategory", "").lower()
            overlap_tokens = set(query_tokens) & set(doc_tokens)
            if len(query_tokens) >= 2 and not overlap_tokens:
                continue
            if (
                len(query_tokens) >= 2
                and len(overlap_tokens) < 2
                and query.category
                and query.category.lower() not in (product_category, product_subcategory)
            ):
                continue

            # Calculate BM25 score
            score = _bm25_score(
                query_tokens=query_tokens,
                doc_tokens=doc_tokens,
                doc_freq=self._doc_freq,
                num_docs=num_docs,
                avg_doc_len=self._avg_doc_len,
            )

            # Category match bonus
            if query.category:
                if product.get("category", "").lower() == query.category.lower():
                    score += 2.0
                elif query.category.lower() in _build_search_text(product):
                    score += 1.0

            # Occasion match bonus
            if query.occasion:
                occ_tags = product.get("occasion_tags", set())
                if isinstance(occ_tags, (list, set)):
                    if query.occasion.lower() in {str(t).lower() for t in occ_tags}:
                        score += 1.5

            # Preferred category/subcategory bonus for generalized profiles.
            if query.preferred_categories:
                product_category = product.get("category", "").lower()
                product_subcategory = product.get("subcategory", "").lower()
                for category in query.preferred_categories:
                    category_lower = category.lower()
                    if category_lower in (product_category, product_subcategory):
                        score += 0.8
                        break

            # Preferred brand bonus
            if query.preferred_brands:
                product_brand = product.get("brand", "").lower()
                if any(b.lower() == product_brand for b in query.preferred_brands):
                    score += 1.0

            if score > 0:
                scored.append((score, idx))

        # Sort by score descending, take top `limit`
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:limit]

        candidates: list[ProductCandidate] = []
        for score, idx in top:
            product = self._products[idx]
            candidates.append(ProductCandidate(
                sku=product["sku"],
                title=product.get("name", ""),
                brand=product.get("brand", ""),
                category=product.get("category", ""),
                subcategory=product.get("subcategory", ""),
                price_inr=float(product.get("price_inr", 0)),
                unit=product.get("unit", "piece"),
                unit_quantity=float(product.get("unit_quantity", 1)),
                rating=float(product.get("rating", 0)),
                review_count=int(product.get("review_count", 0)),
                in_stock=product.get("in_stock", True),
                dietary_tags=set(product.get("dietary_tags", [])) if isinstance(product.get("dietary_tags"), (list, set)) else set(),
                occasion_tags=set(product.get("occasion_tags", [])) if isinstance(product.get("occasion_tags"), (list, set)) else set(),
                keywords=set(str(k) for k in product.get("keywords", []) if not isinstance(k, dict)) if isinstance(product.get("keywords"), (list, set)) else set(),
                image_url=product.get("image_url", ""),
                text_score=score,
                semantic_score=0.0,  # No vector search in local mode
            ))

        logger.debug(f"LocalRetriever: query='{query.query_text}' -> {len(candidates)} candidates")
        return candidates
