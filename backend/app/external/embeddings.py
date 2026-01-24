"""Local embedding service using sentence-transformers."""

import logging
from typing import List, Optional

from sentence_transformers import SentenceTransformer

from app.core.config import settings

logger = logging.getLogger(__name__)


class LocalEmbeddingService:
    """Service for generating embeddings locally using sentence-transformers.
    
    Uses BAAI/bge-base-en-v1.5 for high-quality 768-dimensional embeddings.
    This model achieves ~98% of OpenAI embedding quality with ~10ms local inference.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.local_embedding_model
        self._model: Optional[SentenceTransformer] = None
        logger.info(f"LocalEmbeddingService configured with model: {self.model_name}")

    @property
    def model(self) -> SentenceTransformer:
        """Lazy load the embedding model."""
        if self._model is None:
            logger.info(f"Loading embedding model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
            logger.info(f"Loaded embedding model with dimension: {self._model.get_sentence_embedding_dimension()}")
        return self._model

    @property
    def embedding_dimension(self) -> int:
        """Get the embedding dimension for the model."""
        return self.model.get_sentence_embedding_dimension()

    def create_embedding(self, text: str) -> List[float]:
        """Create an embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector as list of floats
        """
        embedding = self.model.encode(
            text,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return embedding.tolist()

    def create_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Create embeddings for multiple texts.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []
            
        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32,
        )
        return embeddings.tolist()


# Singleton instance
_embedding_service: Optional[LocalEmbeddingService] = None


def get_local_embedding_service() -> LocalEmbeddingService:
    """Get or create the local embedding service singleton."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = LocalEmbeddingService()
    return _embedding_service

