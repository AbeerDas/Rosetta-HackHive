"""Pinecone vector database client.

This module provides a client for interacting with Pinecone's serverless
vector database. It replaces ChromaDB for cloud-native deployment.
"""

import logging
from typing import List, Dict, Any, Optional

from pinecone import Pinecone, ServerlessSpec

from app.core.config import settings

logger = logging.getLogger(__name__)


class PineconeClient:
    """Client for interacting with Pinecone vector database.
    
    Uses the Pinecone Python SDK v3+ for serverless index management.
    Provides the same interface as ChromaClient for easy migration.
    """

    def __init__(self, api_key: str = None, index_name: str = None):
        self.api_key = api_key or settings.pinecone_api_key
        self.index_name = index_name or settings.pinecone_index_name
        self._client: Optional[Pinecone] = None
        self._index = None
        logger.info(f"PineconeClient configured for index: {self.index_name}")

    def _get_client(self) -> Pinecone:
        """Get or create the Pinecone client."""
        if self._client is None:
            self._client = Pinecone(api_key=self.api_key)
        return self._client

    def _get_index(self):
        """Get the index. Creates it if it doesn't exist."""
        if self._index is None:
            client = self._get_client()
            
            # Check if index exists
            existing_indexes = [idx.name for idx in client.list_indexes()]
            
            if self.index_name not in existing_indexes:
                logger.info(f"Creating Pinecone index: {self.index_name}")
                client.create_index(
                    name=self.index_name,
                    dimension=768,  # bge-base-en-v1.5 embedding dimension
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )
                logger.info(f"Created Pinecone index: {self.index_name}")
            
            self._index = client.Index(self.index_name)
            logger.info(f"Connected to Pinecone index: {self.index_name}")
        
        return self._index

    async def health_check(self) -> bool:
        """Check if Pinecone is healthy."""
        try:
            client = self._get_client()
            client.list_indexes()
            return True
        except Exception as e:
            logger.error(f"Pinecone health check failed: {e}")
            return False

    async def heartbeat(self) -> bool:
        """Alias for health_check for compatibility."""
        return await self.health_check()

    async def create_collection(self, name: str, metadata: Optional[Dict] = None) -> Dict:
        """Create a collection (Pinecone uses namespaces within an index).
        
        In Pinecone, we use a single index with namespaces.
        This is a no-op for compatibility with ChromaDB interface.
        """
        return {"id": name, "name": name}

    async def get_collection(self, name: str) -> Optional[Dict]:
        """Get collection (returns namespace info)."""
        return {"id": name, "name": name}

    async def add_embeddings(
        self,
        collection_name: str,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: Optional[List[Dict]] = None,
    ) -> None:
        """Add embeddings to Pinecone index.
        
        Args:
            collection_name: Used as namespace in Pinecone
            ids: Vector IDs
            embeddings: Vector values (768-dim for bge-base-en-v1.5)
            documents: Original text (stored in metadata)
            metadatas: Additional metadata per vector
        """
        try:
            index = self._get_index()
            
            # Prepare vectors for Pinecone
            vectors = []
            for i, (vec_id, embedding, doc_text) in enumerate(zip(ids, embeddings, documents)):
                metadata = {
                    "document": doc_text[:1000],  # Pinecone metadata limit ~40KB
                    **(metadatas[i] if metadatas and i < len(metadatas) else {})
                }
                vectors.append({
                    "id": vec_id,
                    "values": embedding,
                    "metadata": metadata
                })
            
            # Upsert in batches of 100 (Pinecone recommendation)
            batch_size = 100
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                index.upsert(vectors=batch, namespace=collection_name)
            
            logger.info(f"Added {len(vectors)} embeddings to Pinecone namespace '{collection_name}'")
        except Exception as e:
            logger.error(f"Error adding embeddings to Pinecone: {e}")
            raise

    async def query(
        self,
        collection_name: str,
        query_embeddings: List[List[float]],
        n_results: int = 10,
        where: Optional[Dict] = None,
    ) -> Dict:
        """Query Pinecone index.
        
        Args:
            collection_name: Namespace to query
            query_embeddings: Query vectors (list of lists)
            n_results: Number of results to return
            where: Metadata filter (e.g., {"session_id": "abc123"})
        
        Returns:
            Dict with keys: ids, documents, metadatas, distances
            Format matches ChromaDB for compatibility.
        """
        try:
            index = self._get_index()
            
            # Pinecone queries one embedding at a time
            query_embedding = query_embeddings[0]
            
            # Convert ChromaDB-style where to Pinecone filter format
            filter_dict = None
            if where:
                filter_dict = self._convert_filter(where)
            
            # Query Pinecone
            results = index.query(
                vector=query_embedding,
                top_k=n_results,
                include_metadata=True,
                namespace=collection_name,
                filter=filter_dict
            )
            
            # Convert to ChromaDB-compatible format
            ids = [[match.id for match in results.matches]]
            documents = [[match.metadata.get("document", "") for match in results.matches]]
            metadatas = [[match.metadata for match in results.matches]]
            # Pinecone returns similarity scores (higher = better)
            # Convert to distances (lower = better) for ChromaDB compatibility
            distances = [[1.0 - match.score for match in results.matches]]
            
            num_results = len(results.matches)
            logger.debug(f"[Pinecone] Query on '{collection_name}' returned {num_results} results")
            
            return {
                "ids": ids,
                "documents": documents,
                "metadatas": metadatas,
                "distances": distances,
            }
        except Exception as e:
            logger.error(f"Error querying Pinecone: {e}")
            raise

    def _convert_filter(self, where: Dict) -> Dict:
        """Convert ChromaDB-style filter to Pinecone format.
        
        ChromaDB format: {"field": "value"} or {"field": {"$eq": "value"}}
        Pinecone format: {"field": {"$eq": "value"}}
        """
        filter_dict = {}
        for key, value in where.items():
            if isinstance(value, dict):
                # Already in operator format
                filter_dict[key] = value
            else:
                # Simple equality
                filter_dict[key] = {"$eq": value}
        return filter_dict

    async def delete_collection(self, name: str) -> None:
        """Delete all vectors in a namespace."""
        try:
            index = self._get_index()
            index.delete(delete_all=True, namespace=name)
            logger.info(f"Deleted all vectors in namespace '{name}'")
        except Exception as e:
            logger.error(f"Error deleting namespace: {e}")
            raise

    async def delete_by_document(
        self,
        collection_name: str,
        document_id: str,
    ) -> None:
        """Delete all embeddings for a document.
        
        Args:
            collection_name: Namespace
            document_id: Document ID to delete vectors for
        """
        try:
            index = self._get_index()
            
            # Pinecone requires deleting by ID or filter
            # We'll use filter to delete by document_id metadata
            index.delete(
                filter={"document_id": {"$eq": document_id}},
                namespace=collection_name
            )
            logger.info(f"Deleted embeddings for document {document_id} from namespace '{collection_name}'")
        except Exception as e:
            logger.error(f"Error deleting embeddings for document {document_id}: {e}")
            raise

    async def get_stats(self, namespace: str = None) -> Dict:
        """Get index statistics.
        
        Args:
            namespace: Optional namespace to get stats for
            
        Returns:
            Dict with vector count and other stats
        """
        try:
            index = self._get_index()
            stats = index.describe_index_stats()
            
            if namespace:
                ns_stats = stats.namespaces.get(namespace, {})
                return {
                    "total_vectors": ns_stats.get("vector_count", 0),
                    "namespace": namespace
                }
            
            return {
                "total_vectors": stats.total_vector_count,
                "namespaces": {k: v.vector_count for k, v in stats.namespaces.items()}
            }
        except Exception as e:
            logger.error(f"Error getting index stats: {e}")
            return {"total_vectors": 0}

    async def close(self):
        """Close the client."""
        self._client = None
        self._index = None


_pinecone_client: Optional[PineconeClient] = None


def get_pinecone_client() -> PineconeClient:
    """Get global Pinecone client instance."""
    global _pinecone_client
    if _pinecone_client is None:
        _pinecone_client = PineconeClient()
    return _pinecone_client
