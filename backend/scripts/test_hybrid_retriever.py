import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.search.hybrid_retrieval import HybridRetriever
from app.catalog.models import ProductQuery

def test_hybrid():
    retriever = HybridRetriever(mock_mode=True)
    query = ProductQuery(query_text="spicy chips for party")
    
    candidates = retriever.retrieve(query, limit=5)
    
    print(f"Top candidates for '{query.query_text}':")
    for rank, c in enumerate(candidates, 1):
        print(f"{rank}. {c.title} ({c.brand})")
        print(f"   text_score: {c.text_score:.3f}, semantic_score: {c.semantic_score:.3f}")

if __name__ == "__main__":
    test_hybrid()
