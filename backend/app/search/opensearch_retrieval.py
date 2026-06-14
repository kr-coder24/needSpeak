"""
OpenSearch Retrieval Engine (Phase 7)
Implements ProductRetriever interface for AWS OpenSearch using hybrid vector + text search.
"""
import logging
import json
import boto3
from typing import Optional, Any
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth

from app.config import AWS_REGION
from app.catalog.models import ProductCandidate, ProductQuery
from app.search.retrieval import ProductRetriever

logger = logging.getLogger(__name__)

class OpenSearchRetriever(ProductRetriever):
    """
    Retrieves candidates using OpenSearch hybrid queries (k-NN + BM25).
    """
    def __init__(self, host: str, index_name: str = "product-catalog", mock_mode: bool = False):
        self.mock_mode = mock_mode
        self.index_name = index_name
        self.host = host
        self.client: Optional[OpenSearch] = None

        if not self.mock_mode:
            credentials = boto3.Session().get_credentials()
            auth = AWSV4SignerAuth(credentials, AWS_REGION, 'es')
            self.client = OpenSearch(
                hosts=[{'host': host, 'port': 443}],
                http_auth=auth,
                use_ssl=True,
                verify_certs=True,
                connection_class=RequestsHttpConnection,
                pool_maxsize=20
            )

    def retrieve(self, query: ProductQuery, limit: int = 20) -> list[ProductCandidate]:
        """Execute hybrid search on OpenSearch."""
        if self.mock_mode or not self.client:
            logger.info("OpenSearch mock mode: falling back to empty list")
            return []

        # Example mock embedding extraction
        query_embedding = [0.1] * 384  # Replace with actual embedding model output

        search_body: dict[str, Any] = {
            "size": limit,
            "query": {
                "hybrid": {
                    "queries": [
                        {
                            "match": {
                                "search_text": {
                                    "query": query.query_text,
                                    "boost": 1.0
                                }
                            }
                        },
                        {
                            "knn": {
                                "embedding": {
                                    "vector": query_embedding,
                                    "k": limit
                                }
                            }
                        }
                    ]
                }
            }
        }

        # Apply category filter if present
        if query.category and query.category != "general":
            search_body["query"]["hybrid"]["queries"][0] = {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "search_text": {
                                    "query": query.query_text,
                                    "boost": 1.0
                                }
                            }
                        },
                        {"term": {"category": query.category}}
                    ]
                }
            }

        try:
            response = self.client.search(
                body=search_body,
                index=self.index_name
            )
            hits = response.get("hits", {}).get("hits", [])
            
            results = []
            for hit in hits:
                source = hit["_source"]
                results.append(ProductCandidate(
                    sku=source["sku"],
                    title=source["name"],
                    brand=source["brand"],
                    category=source["category"],
                    subcategory=source.get("subcategory", ""),
                    price_inr=source["price_inr"],
                    unit=source.get("unit", "piece"),
                    unit_quantity=source.get("unit_quantity", 1.0),
                    rating=source.get("rating", 4.0),
                    in_stock=source.get("in_stock", True),
                    dietary_tags=set(source.get("dietary_tags", [])),
                    occasion_tags=set(source.get("occasion_tags", [])),
                    keywords=set(source.get("keywords", [])),
                    image_url=source.get("image_url", ""),
                    review_count=source.get("review_count", 0),
                    text_score=float(hit.get("_score", 0)),
                    semantic_score=float(hit.get("_score", 0)),
                ))
            return results

        except Exception as e:
            logger.error(f"OpenSearch retrieval failed: {e}")
            return []
