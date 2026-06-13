"""
OpenSearch Retrieval Engine (Phase 7)
Implements ProductRetriever interface for AWS OpenSearch using hybrid vector + text search.
"""
import logging
import json
import boto3
from typing import Optional
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth

from app.config import AWS_REGION
from app.catalog.models import ProductQuery
from app.search.retrieval import ProductRetriever
from app.catalog.models import RankedProduct

logger = logging.getLogger(__name__)

class OpenSearchRetriever(ProductRetriever):
    """
    Retrieves candidates using OpenSearch hybrid queries (k-NN + BM25).
    """
    def __init__(self, host: str, index_name: str = "product-catalog", mock_mode: bool = False):
        self.mock_mode = mock_mode
        self.index_name = index_name
        self.host = host

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
        else:
            self.client = None

    def retrieve(self, query: ProductQuery, limit: int = 20) -> list[RankedProduct]:
        """Execute hybrid search on OpenSearch."""
        if self.mock_mode or not self.client:
            logger.info("OpenSearch mock mode: falling back to empty list")
            return []

        # Example mock embedding extraction
        query_embedding = [0.1] * 384  # Replace with actual embedding model output

        search_body = {
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
            search_body["query"]["hybrid"]["queries"][0]["match"] = {
                "bool": {
                    "must": [
                        {"match": {"search_text": query.query_text}},
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
                results.append(RankedProduct(
                    sku=source["sku"],
                    title=source["name"],
                    brand=source["brand"],
                    category=source["category"],
                    price_inr=source["price_inr"],
                    unit=source["unit"],
                    unit_quantity=source["unit_quantity"],
                    rating=source.get("rating", 4.0),
                    in_stock=source.get("in_stock", True),
                    tags=source.get("tags", []),
                    score=hit["_score"]
                ))
            return results

        except Exception as e:
            logger.error(f"OpenSearch retrieval failed: {e}")
            return []
