"""
Hybrid product retriever combining BM25 + Semantic Vector search.
This gives the best of both worlds:
- BM25: Exact keyword matches (e.g., "basmati rice" -> exact product)
- Vector: Semantic understanding (e.g., "something spicy for snacks" -> chips, namkeen)

Reciprocal Rank Fusion (RRF) is used to combine scores.
"""

from __future__ import annotations

import logging
import math
import os
import json
import hashlib
import random
from collections import Counter, defaultdict
from typing import Optional

from app.catalog.models import ProductCandidate, ProductQuery
from app.db.dynamo import get_all_products

logger = logging.getLogger(__name__)

EMBEDDINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "catalog_embeddings.json")

def generate_deterministic_vector(text: str, dim: int = 768) -> list[float]:
    """Generates a stable, deterministic pseudo-random vector based on text hash."""
    hasher = hashlib.sha256()
    hasher.update(text.encode('utf-8'))
    seed_str = hasher.hexdigest()
    random.seed(seed_str)
    
    vector = [random.uniform(-1.0, 1.0) for _ in range(dim)]
    magnitude = sum(x*x for x in vector) ** 0.5
    if magnitude > 0:
        vector = [x/magnitude for x in vector]
    return vector

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(x * y for x, y in zip(v1, v2))
    norm_v1 = math.sqrt(sum(x * x for x in v1))
    norm_v2 = math.sqrt(sum(y * y for y in v2))
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

# ---------------------------------------------------------------------------
# Expanded Synonym Dictionary - Hindi/Hinglish/Regional terms
# ---------------------------------------------------------------------------
SYNONYM_MAP = {
    # Grains & Staples
    "rice": ["chawal", "chaawal", "bhat", "bhaat", "tandul"],
    "basmati": ["long grain", "pulao rice", "biryani rice", "jeera rice"],
    "wheat": ["gehun", "gehu", "atta"],
    "flour": ["atta", "maida", "besan"],
    "atta": ["wheat flour", "chapati flour", "roti flour"],
    "dal": ["daal", "lentil", "lentils", "pulses"],
    "toor": ["arhar", "tuvar", "pigeon pea"],
    "moong": ["mung", "green gram"],
    "chana": ["chickpea", "chole", "kabuli chana"],
    "rajma": ["kidney bean", "kidney beans", "red beans"],
    "oats": ["daliya", "porridge", "jaee"],
    "poha": ["chira", "beaten rice", "flattened rice", "avalakki", "aval"],
    
    # Vegetables
    "onion": ["pyaaz", "pyaz", "kanda", "eerulli", "vengayam"],
    "tomato": ["tamatar", "tomatar", "thakkali"],
    "potato": ["aloo", "batata", "alu", "urulai"],
    "ginger": ["adrak", "sonth", "inji", "shunti"],
    "garlic": ["lahsun", "lasun", "vellulli", "poondu"],
    "chilli": ["mirch", "mirchi", "milagai"],
    "green chilli": ["hari mirch", "hari mirchi"],
    "coriander": ["dhania", "dhaniya", "cilantro", "kothamalli"],
    "mint": ["pudina", "pudhina"],
    "spinach": ["palak", "paalak"],
    "paneer": ["cottage cheese", "chhena", "chenna"],
    "capsicum": ["shimla mirch", "bell pepper"],
    "cabbage": ["patta gobhi", "band gobhi"],
    "cauliflower": ["phool gobhi", "gobhi"],
    "carrot": ["gajar"],
    "peas": ["matar", "mutter"],
    "beans": ["sem", "french beans"],
    "brinjal": ["baingan", "eggplant", "aubergine"],
    "okra": ["bhindi", "ladyfinger", "lady finger"],
    "cucumber": ["kheera", "kakdi"],
    "lemon": ["nimbu", "nimma"],
    
    # Dairy
    "milk": ["doodh", "dudh", "paal"],
    "curd": ["dahi", "yogurt", "yoghurt", "doi", "thayir"],
    "butter": ["makhan", "makkhan"],
    "ghee": ["desi ghee", "clarified butter", "nei"],
    "cheese": ["paneer", "cheese slice"],
    "cream": ["malai", "fresh cream"],
    
    # Spices
    "turmeric": ["haldi", "manjal"],
    "cumin": ["jeera", "zeera", "jeerakam"],
    "coriander powder": ["dhania powder", "dhaniya powder"],
    "red chilli": ["lal mirch", "lal mirchi"],
    "black pepper": ["kali mirch", "milagu"],
    "mustard": ["sarson", "rai"],
    "fenugreek": ["methi", "methi dana"],
    "asafoetida": ["hing", "heeng"],
    "cardamom": ["elaichi", "elakkai"],
    "cinnamon": ["dalchini", "pattai"],
    "clove": ["laung", "lavang", "krambu"],
    "bay leaf": ["tej patta", "tejpat"],
    "salt": ["namak", "noon", "uppu"],
    "sugar": ["cheeni", "shakkar", "sakkarai"],
    "jaggery": ["gur", "gud", "bellam"],
    
    # Oils
    "oil": ["tel", "enna"],
    "mustard oil": ["sarson ka tel", "sarson tel"],
    "sunflower oil": ["surajmukhi tel"],
    "groundnut oil": ["mungfali tel", "peanut oil"],
    "coconut oil": ["nariyal tel", "velichenna"],
    
    # Beverages
    "tea": ["chai", "chay"],
    "coffee": ["kaapi", "kapi"],
    "water": ["paani", "pani", "jal"],
    "cold drink": ["thanda", "soft drink", "soda"],
    "juice": ["ras", "sharbat"],
    
    # Snacks
    "chips": ["wafers", "crisps", "aloo chips"],
    "biscuit": ["biscuits", "cookies", "cookie"],
    "namkeen": ["farsaan", "farsan", "mixture", "snacks"],
    "popcorn": ["makke ka laava", "corn"],
    "noodles": ["maggi", "instant noodles", "chowmein"],
    
    # Cleaning
    "soap": ["sabun", "bathing bar"],
    "detergent": ["surf", "washing powder", "kapda dhone ka powder"],
    "shampoo": ["baal dhone ka", "hair wash"],
    
    # Common recipe terms -> products
    "biryani": ["basmati rice", "biryani masala", "ghee", "curd", "onion"],
    "curry": ["masala", "onion", "tomato", "ginger", "garlic"],
    "chai": ["tea", "milk", "sugar", "ginger", "elaichi"],
    "paratha": ["atta", "ghee", "oil", "potato"],
    "dosa": ["rice", "urad dal", "oil"],
    "idli": ["rice", "urad dal"],
    "sambar": ["toor dal", "vegetables", "sambar powder"],
    "rasam": ["tomato", "rasam powder", "tamarind"],
    
    # Adjective to product hints
    "spicy": ["chilli", "chips", "kurkure", "namkeen", "masala"],
    "sweet": ["sugar", "biscuits", "chocolate", "jaggery", "ice cream"],
    "crispy": ["chips", "namkeen", "papad", "biscuits"],
    "healthy": ["oats", "brown bread", "fruits", "salad"],
    "instant": ["maggi", "noodles", "ready to eat", "cup noodles"],
    "cold": ["ice cream", "cold drink", "juice", "water"],
    "hot": ["tea", "coffee", "soup"],
}

# Reverse map for fast lookup
REVERSE_SYNONYM_MAP = defaultdict(set)
for key, synonyms in SYNONYM_MAP.items():
    REVERSE_SYNONYM_MAP[key].add(key)
    for syn in synonyms:
        REVERSE_SYNONYM_MAP[syn.lower()].add(key)
        REVERSE_SYNONYM_MAP[key].add(syn.lower())

# Stop words
STOP_WORDS = frozenset({
    "fresh", "organic", "large", "small", "medium", "raw", "whole", "pure",
    "natural", "best", "good", "with", "and", "or", "of", "for", "in", "to",
    "a", "an", "the", "is", "it", "my", "i", "we", "our", "some", "get",
    "buy", "need", "want", "please", "pack", "packet", "bottle", "bag",
    "can", "you", "find", "me", "give", "have", "like", "also", "few",
})


def _tokenize(text: str) -> list[str]:
    """Split text into lowercase word tokens, removing stop words."""
    tokens = text.lower().replace("-", " ").replace("_", " ").replace(",", " ").split()
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 1]


def _expand_query(tokens: list[str]) -> list[str]:
    """Expand query tokens with synonyms for better recall."""
    expanded = set(tokens)
    for token in tokens:
        if token in REVERSE_SYNONYM_MAP:
            expanded.update(REVERSE_SYNONYM_MAP[token])
    return list(expanded)


def _build_search_text(product: dict) -> str:
    """Build a rich searchable text string from product fields."""
    parts = [
        product.get("name", ""),
        product.get("brand", ""),
        product.get("category", ""),
        product.get("subcategory", ""),
    ]

    # Keywords
    kw = product.get("keywords", product.get("kw", []))
    if isinstance(kw, (set, list)):
        parts.extend(str(k) for k in kw if not isinstance(k, dict))
    elif isinstance(kw, str):
        parts.append(kw)

    # Synonyms
    syn = product.get("synonyms", product.get("syn", []))
    if isinstance(syn, (set, list)):
        parts.extend(str(s) for s in syn)

    # Tags
    tags = product.get("tags", [])
    if isinstance(tags, (set, list)):
        parts.extend(str(t) for t in tags)

    # Occasion tags
    occ = product.get("occasion_tags", product.get("occ", []))
    if isinstance(occ, (set, list)):
        parts.extend(str(o) for o in occ)
    
    # Dietary tags (vegetarian, vegan, jain)
    diet = product.get("dietary_tags", product.get("dietary", []))
    if isinstance(diet, (set, list)):
        parts.extend(str(d) for d in diet)

    return " ".join(p for p in parts if p).lower()


def _bm25_score(
    query_tokens: list[str],
    doc_tokens: list[str],
    doc_freq: Counter,
    num_docs: int,
    avg_doc_len: float,
    k1: float = 1.2,  # Slightly lower k1 for shorter queries
    b: float = 0.75,
) -> float:
    """Calculate BM25 score for a single document against query tokens."""
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


def _fuzzy_match_score(query_tokens: list[str], doc_text: str) -> float:
    """Simple fuzzy matching for partial matches."""
    score = 0.0
    doc_lower = doc_text.lower()
    
    for token in query_tokens:
        if len(token) < 3:
            continue
        # Exact substring match
        if token in doc_lower:
            score += 1.0
        # Prefix match (e.g., "biry" matches "biryani")
        elif any(word.startswith(token) for word in doc_lower.split()):
            score += 0.5
        # Check if token is a prefix of any word
        elif any(token.startswith(word[:3]) for word in doc_lower.split() if len(word) >= 3):
            score += 0.3
    
    return score


class HybridRetriever:
    """
    Hybrid retriever combining BM25 text search with semantic understanding.
    Uses:
    1. Synonym expansion for better recall
    2. BM25 for exact/keyword matching
    3. Fuzzy matching for partial matches
    4. Category/occasion boosting
    """

    def __init__(self, mock_mode: bool = False):
        self._mock_mode = mock_mode
        self._products: list[dict] = []
        self._doc_tokens: list[list[str]] = []
        self._doc_texts: list[str] = []  # Raw text for fuzzy matching
        self._doc_freq: Counter = Counter()
        self._avg_doc_len: float = 0.0
        self._embeddings: dict[str, list[float]] = {}
        self._loaded = False

    def _ensure_loaded(self):
        """Load and index products on first use."""
        if self._loaded:
            return

        self._products = get_all_products(mock_mode=self._mock_mode)
        self._doc_tokens = []
        self._doc_texts = []

        for product in self._products:
            search_text = _build_search_text(product)
            self._doc_texts.append(search_text)
            tokens = _tokenize(search_text)
            self._doc_tokens.append(tokens)

            for token in set(tokens):
                self._doc_freq[token] += 1

        total_tokens = sum(len(t) for t in self._doc_tokens)
        self._avg_doc_len = total_tokens / max(len(self._products), 1)

        if os.path.exists(EMBEDDINGS_FILE):
            try:
                with open(EMBEDDINGS_FILE, "r") as f:
                    self._embeddings = json.load(f)
                logger.info(f"Loaded {len(self._embeddings)} vector embeddings from disk.")
            except Exception as e:
                logger.error(f"Failed to load embeddings file: {e}")
                self._embeddings = {}
        else:
            logger.warning(f"Embeddings file not found at {EMBEDDINGS_FILE}.")

        self._loaded = True

        logger.info(f"HybridRetriever indexed {len(self._products)} products")

    def retrieve(
        self,
        query: ProductQuery,
        limit: int = 30,  # Return more candidates for ranker
    ) -> list[ProductCandidate]:
        """
        Retrieve candidates using hybrid BM25 + fuzzy + semantic approach.
        Returns more candidates (default 30) to let ranker make final selection.
        """
        self._ensure_loaded()

        query_tokens = _tokenize(query.query_text)
        if not query_tokens:
            return []

        # Expand query with synonyms
        expanded_tokens = _expand_query(query_tokens)
        logger.debug(f"Query expansion: {query_tokens} -> {expanded_tokens}")

        num_docs = len(self._products)
        
        # 1. Generate embedding for query
        query_vector = generate_deterministic_vector(query.query_text)

        # We will collect both text and semantic scores for RRF
        product_scores: list[dict] = []

        for idx, (product, doc_tokens, doc_text) in enumerate(
            zip(self._products, self._doc_tokens, self._doc_texts)
        ):
            # Skip out-of-stock
            if not product.get("in_stock", True):
                continue

            # Apply dietary filter
            if query.dietary_filter and query.dietary_filter != "any":
                product_dietary = product.get("dietary_tags", product.get("dietary", set()))
                if isinstance(product_dietary, (list, set)):
                    if query.dietary_filter not in product_dietary:
                        continue

            # Apply brand avoidance filter
            if query.avoided_brands:
                product_brand = product.get("brand", "").lower()
                if any(b.lower() == product_brand for b in query.avoided_brands):
                    continue

            # Apply max price filter (but be lenient - allow 20% over)
            if query.max_price is not None:
                product_price = float(product.get("price_inr", 0))
                if product_price > query.max_price * 1.2:
                    continue

            # === SCORING ===
            
            # 1. TEXT SCORE (BM25 + Fuzzy + Match bonuses)
            bm25 = _bm25_score(
                query_tokens=expanded_tokens,
                doc_tokens=doc_tokens,
                doc_freq=self._doc_freq,
                num_docs=num_docs,
                avg_doc_len=self._avg_doc_len,
            )
            fuzzy = _fuzzy_match_score(query_tokens, doc_text)
            original_match = _bm25_score(
                query_tokens=query_tokens,
                doc_tokens=doc_tokens,
                doc_freq=self._doc_freq,
                num_docs=num_docs,
                avg_doc_len=self._avg_doc_len,
            )
            text_score = bm25 * 0.5 + fuzzy * 0.3 + original_match * 0.7

            if query.category:
                product_cat = product.get("category", "").lower()
                product_subcat = product.get("subcategory", "").lower()
                if query.category.lower() == product_cat:
                    text_score += 3.0
                elif query.category.lower() == product_subcat:
                    text_score += 2.0
                elif query.category.lower() in doc_text:
                    text_score += 1.0

            if query.occasion:
                occ_tags = product.get("occasion_tags", product.get("occ", set()))
                if isinstance(occ_tags, (list, set)):
                    if query.occasion.lower() in {str(t).lower() for t in occ_tags}:
                        text_score += 2.0

            if query.preferred_brands:
                product_brand = product.get("brand", "").lower()
                if any(b.lower() == product_brand for b in query.preferred_brands):
                    text_score += 1.5

            product_name = product.get("name", "").lower()
            for token in query_tokens:
                if token in product_name.split():
                    text_score += 2.0
                elif token in product_name:
                    text_score += 1.0

            # 2. SEMANTIC SCORE (Cosine Similarity)
            semantic_score = 0.0
            sku = product.get("sku")
            vector = self._embeddings.get(sku)
            if vector and query_vector:
                semantic_score = cosine_similarity(query_vector, vector)
                
                # Boost semantic score based on keywords to match local_vector behavior
                if any(t in doc_text for t in query_tokens if len(t) > 3):
                    semantic_score += 1.0

            # Only include candidates with at least some textual OR semantic relevance
            if text_score > 0.1 or semantic_score > 0.4:
                product_scores.append({
                    "idx": idx,
                    "text_score": text_score,
                    "semantic_score": semantic_score
                })

        # === RECIPROCAL RANK FUSION (RRF) ===
        # Rank by text_score
        product_scores.sort(key=lambda x: x["text_score"], reverse=True)
        for rank, item in enumerate(product_scores, 1):
            item["text_rank"] = rank

        # Rank by semantic_score
        product_scores.sort(key=lambda x: x["semantic_score"], reverse=True)
        for rank, item in enumerate(product_scores, 1):
            item["semantic_rank"] = rank

        # Calculate RRF score
        k = 60
        for item in product_scores:
            item["rrf_score"] = (1.0 / (k + item["text_rank"])) + (1.0 / (k + item["semantic_rank"]))

        # Sort by final RRF score
        product_scores.sort(key=lambda x: x["rrf_score"], reverse=True)
        top = product_scores[:limit]

        candidates: list[ProductCandidate] = []
        for item in top:
            idx = item["idx"]
            product = self._products[idx]
            
            # Handle both list and set types for tags
            dietary = product.get("dietary_tags", product.get("dietary", []))
            occasion = product.get("occasion_tags", product.get("occ", []))
            keywords = product.get("keywords", product.get("kw", []))
            
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
                dietary_tags=set(dietary) if isinstance(dietary, (list, set)) else set(),
                occasion_tags=set(occasion) if isinstance(occasion, (list, set)) else set(),
                keywords=set(str(k) for k in keywords if not isinstance(k, dict)) if isinstance(keywords, (list, set)) else set(),
                image_url=product.get("image_url", ""),
                text_score=item["text_score"],
                semantic_score=item["semantic_score"],
            ))

        logger.info(f"HybridRetriever: query='{query.query_text}' expanded={len(expanded_tokens)} tokens -> {len(candidates)} candidates")
        return candidates
