"""Chroma vector database client using official chromadb-client."""

import logging
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChromaClient:
    """Client for interacting with ChromaDB using official async client."""

    def __init__(self, host: str = None, port: int = None):
        self.host = host or settings.chroma_host
        self.port = port or settings.chroma_port
        self._client: Optional[chromadb.AsyncClientAPI] = None
        self._collections: Dict[str, Any] = {}  # Cache collections
        logger.info(f"ChromaDB client configured for: {self.host}:{self.port}")

    async def _get_client(self) -> chromadb.AsyncClientAPI:
        """Get or create the async client."""
        if self._client is None:
            self._client = await chromadb.AsyncHttpClient(
                host=self.host,
                port=self.port,
            )
        return self._client

    async def _get_or_create_collection(self, name: str):
        """Get or create a collection by name."""
        if name not in self._collections:
            client = await self._get_client()
            self._collections[name] = await client.get_or_create_collection(name=name)
        return self._collections[name]

    async def health_check(self) -> bool:
        """Check if Chroma server is healthy."""
        try:
            client = await self._get_client()
            await client.heartbeat()
            return True
        except Exception:
            return False

    async def heartbeat(self) -> bool:
        """Alias for health_check for compatibility with health routes."""
        return await self.health_check()

    async def create_collection(self, name: str, metadata: Optional[Dict] = None) -> Dict:
        """Create a collection."""
        try:
            client = await self._get_client()
            collection = await client.get_or_create_collection(name=name, metadata=metadata)
            self._collections[name] = collection
            return {"id": str(collection.id), "name": collection.name}
        except Exception as e:
            logger.error(f"Error creating collection: {e}")
            raise

    async def get_collection(self, name: str) -> Optional[Dict]:
        """Get collection by name."""
        try:
            client = await self._get_client()
            collection = await client.get_collection(name=name)
            return {"id": str(collection.id), "name": collection.name}
        except Exception:
            return None

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
            collection = await self._get_or_create_collection(collection_name)
            await collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
            )
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
        """Query collection.
        
        Returns:
            Dict with keys: ids, documents, metadatas, distances
            Each is a list of lists (one per query embedding)
        """
        try:
            collection = await self._get_or_create_collection(collection_name)
            results = await collection.query(
                query_embeddings=query_embeddings,
                n_results=n_results,
                where=where,
                include=["documents", "metadatas", "distances"],  # Explicitly include all needed fields
            )
            
            # Normalize results to dict format (chromadb can return typed objects)
            # Handle both dict-like access and attribute access
            def get_field(obj: Any, key: str, default: Any = None) -> Any:
                if isinstance(obj, dict):
                    return obj.get(key, default)
                return getattr(obj, key, default)
            
            normalized = {
                "ids": get_field(results, "ids", [[]]),
                "documents": get_field(results, "documents", [[]]),
                "metadatas": get_field(results, "metadatas", [[]]),
                "distances": get_field(results, "distances", [[]]),
            }
            
            num_results = len(normalized["ids"][0]) if normalized["ids"] and normalized["ids"][0] else 0
            logger.debug(f"[Chroma] Query on '{collection_name}' returned {num_results} results")
            
            return normalized
        except Exception as e:
            logger.error(f"Error querying collection {collection_name}: {e}")
            raise

    async def delete_collection(self, name: str) -> None:
        """Delete collection."""
        try:
            client = await self._get_client()
            await client.delete_collection(name=name)
            self._collections.pop(name, None)
        except Exception as e:
            logger.error(f"Error deleting collection: {e}")
            raise

    async def delete_by_document(
        self,
        collection_name: str,
        document_id: str,
    ) -> None:
        """Delete all embeddings for a document from a collection."""
        try:
            collection = await self._get_or_create_collection(collection_name)
            await collection.delete(
                where={"document_id": str(document_id)},
            )
            logger.info(f"Deleted embeddings for document {document_id} from collection {collection_name}")
        except Exception as e:
            if "does not exist" in str(e).lower():
                logger.warning(f"Collection {collection_name} not found, skipping embedding deletion")
                return
            logger.error(f"Error deleting embeddings for document {document_id}: {e}")
            raise

    async def close(self):
        """Close the client."""
        self._client = None
        self._collections.clear()


_chroma_client: Optional[ChromaClient] = None


def get_chroma_client() -> ChromaClient:
    """Get global Chroma client instance."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = ChromaClient()
    return _chroma_client
