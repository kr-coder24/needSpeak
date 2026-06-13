"""
Product retrieval interface.
Defines the protocol that all retrievers must implement.
"""

from __future__ import annotations

from typing import Protocol

from app.catalog.models import ProductCandidate, ProductQuery


class ProductRetriever(Protocol):
    """Interface for product retrieval implementations."""

    def retrieve(
        self,
        query: ProductQuery,
        limit: int = 50,
    ) -> list[ProductCandidate]:
        """
        Retrieve candidate products for a given query.
        Returns up to `limit` products ranked by initial relevance.
        """
        ...
