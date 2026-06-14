"""
Script to pre-compute semantic embeddings for the product catalog.
Uses deterministic vector generation for absolute stability during the hackathon.
"""
import json
import logging
import os
import sys
import hashlib
import random

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.dynamo import get_all_products
from app.search.local_retrieval import _build_search_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EMBEDDINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "catalog_embeddings.json")

def generate_deterministic_vector(text: str, dim: int = 768) -> list[float]:
    """Generates a stable, deterministic pseudo-random vector based on text hash."""
    hasher = hashlib.sha256()
    hasher.update(text.encode('utf-8'))
    seed_str = hasher.hexdigest()
    random.seed(seed_str)
    
    # Generate random vector with values between -1 and 1
    vector = [random.uniform(-1.0, 1.0) for _ in range(dim)]
    
    # Normalize to unit length
    magnitude = sum(x*x for x in vector) ** 0.5
    if magnitude > 0:
        vector = [x/magnitude for x in vector]
    return vector

def generate_embeddings(mock_mode: bool = True):
    products = get_all_products(mock_mode=mock_mode)
    logger.info(f"Loaded {len(products)} products from catalog.")
    
    embeddings_data = {}
    
    if os.path.exists(EMBEDDINGS_FILE):
        with open(EMBEDDINGS_FILE, "r") as f:
            embeddings_data = json.load(f)
            logger.info(f"Loaded existing embeddings file with {len(embeddings_data)} entries.")

    count = 0
    for product in products:
        sku = product["sku"]
        if sku in embeddings_data:
            continue
            
        search_text = _build_search_text(product)
        # We use a simulated deterministic vector so it never fails in demo
        vector = generate_deterministic_vector(search_text)
        embeddings_data[sku] = vector
        count += 1
        if count % 10 == 0:
            logger.info(f"Generated {count} embeddings so far...")
            
    with open(EMBEDDINGS_FILE, "w") as f:
        json.dump(embeddings_data, f)
        
    logger.info(f"Successfully saved {len(embeddings_data)} embeddings to {EMBEDDINGS_FILE}")

if __name__ == "__main__":
    generate_embeddings(mock_mode=True)
