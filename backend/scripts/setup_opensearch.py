#!/usr/bin/env python3
"""
OpenSearch Index Setup Script (Phase 7)
Sets up the product-catalog index with KNN vector mappings and text fields.
"""
import os
import sys
import logging
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth
import boto3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INDEX_NAME = "product-catalog"

def get_client(host: str, region: str) -> OpenSearch:
    credentials = boto3.Session().get_credentials()
    auth = AWSV4SignerAuth(credentials, region, 'es')
    return OpenSearch(
        hosts=[{'host': host, 'port': 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        pool_maxsize=20
    )

def create_index(client: OpenSearch):
    mapping = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 100
            }
        },
        "mappings": {
            "properties": {
                "sku": {"type": "keyword"},
                "name": {"type": "text", "analyzer": "standard"},
                "brand": {"type": "keyword"},
                "category": {"type": "keyword"},
                "price_inr": {"type": "float"},
                "rating": {"type": "float"},
                "in_stock": {"type": "boolean"},
                "search_text": {"type": "text", "analyzer": "english"},
                "embedding": {
                    "type": "knn_vector",
                    "dimension": 384,
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "nmslib"
                    }
                }
            }
        }
    }
    
    if client.indices.exists(index=INDEX_NAME):
        logger.info(f"Index {INDEX_NAME} already exists. Deleting...")
        client.indices.delete(index=INDEX_NAME)
        
    logger.info(f"Creating index {INDEX_NAME}...")
    client.indices.create(index=INDEX_NAME, body=mapping)
    logger.info("Index created successfully.")

if __name__ == "__main__":
    if "OPENSEARCH_HOST" not in os.environ:
        logger.warning("OPENSEARCH_HOST not set. Mocking setup execution.")
        sys.exit(0)
        
    host = os.environ["OPENSEARCH_HOST"]
    region = os.environ.get("AWS_REGION", "us-east-1")
    
    client = get_client(host, region)
    create_index(client)
