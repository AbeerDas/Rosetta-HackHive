"""Chroma vector database HTTP client - Python 3.14 compatible."""

import logging
from typing import List, Dict, Any, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChromaClient:
    """HTTP client for interacting with ChromaDB API."""

    def __init__(self, host: str = None, port: int = None):
        self.host = host or settings.chroma_host
        self.port = port or settings.chroma_port
        self.base_url = f"http://{self.host}:{self.port}/api/v1"
        self.client = httpx.AsyncClient(timeout=30.0)
        logger.info(f"ChromaDB HTTP client: {self.base_url}")

    async def health_check(self) -> bool:
        """Check if Chroma server is healthy."""
        try:
            response = await self.client.get(f"http://{self.host}:{self.port}/api/v1/heartbeat")
            return response.status_code == 200
        except:
            return False

    async def create_collection(self, name: str, metadata: Optional[Dict] = None) -> Dict:
        """Create a collection."""
        try:
            response = await self.client.post(
                f"{self.base_url}/collections",
                json={"name": name, "metadata": metadata or {}}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error creating collection: {e}")
            raise

    async def get_collection(self, name: str) -> Optional[Dict]:
        """Get collection by name."""
        try:
            response = await self.client.get(f"{self.base_url}/collections/{name}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def add_embeddings(
        self,
        collection_name: str,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: Optional[List[Dict]] = None,
    ) -> None:
        """Add embeddings to collection."""
        try:
            response = await self.client.post(
                f"{self.base_url}/collections/{collection_name}/add",
                json={
                    "ids": ids,
                    "embeddings": embeddings,
                    "documents": documents,
                    "metadatas": metadatas or [{} for _ in ids],
                }
            )
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Error adding embeddings: {e}")
            raise

    async def query(
        self,
        collection_name: str,
        query_embeddings: List[List[float]],
        n_results: int = 10,
        where: Optional[Dict] = None,
    ) -> Dict:
        """Query collection."""
        try:
            response = await self.client.post(
                f"{self.base_url}/collections/{collection_name}/query",
                json={
                    "query_embeddings": query_embeddings,
                    "n_results": n_results,
                    "where": where,
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error querying: {e}")
            raise

    async def delete_collection(self, name: str) -> None:
        """Delete collection."""
        try:
            response = await self.client.delete(f"{self.base_url}/collections/{name}")
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Error deleting collection: {e}")
            raise

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()


_chroma_client: Optional[ChromaClient] = None


def get_chroma_client() -> ChromaClient:
    """Get global Chroma client instance."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = ChromaClient()
    return _chroma_client
