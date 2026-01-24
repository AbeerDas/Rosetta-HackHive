"""RAG pipeline service for citation retrieval."""

import logging
import time
from typing import Optional
from uuid import UUID

from app.core.config import settings
from app.external.chroma import ChromaClient
from app.external.openrouter import OpenRouterClient
from app.repositories.citation import CitationRepository
from app.repositories.document import DocumentChunkRepository
from app.schemas.rag import (
    CitationResult,
    QueryMetadata,
    RAGQueryRequest,
    RAGQueryResponse,
)

logger = logging.getLogger(__name__)

# Minimum relevance score threshold
RELEVANCE_THRESHOLD = 0.5


class RerankerService:
    """Service for re-ranking search results using cross-encoder."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model_name = model_name
        self._model = None

    @property
    def model(self):
        """Lazy load the cross-encoder model."""
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder
                self._model = CrossEncoder(self.model_name)
                logger.info(f"Loaded cross-encoder model: {self.model_name}")
            except Exception as e:
                logger.error(f"Failed to load cross-encoder: {e}")
                self._model = None
        return self._model

    def rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int = 3,
    ) -> list[dict]:
        """Re-rank candidates using cross-encoder.

        Args:
            query: Query text
            candidates: List of candidate dicts with 'text' key
            top_k: Number of top results to return

        Returns:
            Re-ranked and filtered candidates
        """
        if not candidates:
            return []

        if self.model is None:
            # Fallback: return candidates as-is based on original order
            logger.warning("Cross-encoder not available, using original ranking")
            return candidates[:top_k]

        try:
            # Create query-candidate pairs
            pairs = [[query, c.get("text", "")] for c in candidates]

            # Get scores from cross-encoder
            scores = self.model.predict(pairs)

            # Combine candidates with scores
            scored_candidates = list(zip(candidates, scores))

            # Sort by score descending
            scored_candidates.sort(key=lambda x: x[1], reverse=True)

            # Filter by threshold and take top_k
            results = []
            for candidate, score in scored_candidates[:top_k]:
                if score >= RELEVANCE_THRESHOLD:
                    candidate["relevance_score"] = float(score)
                    results.append(candidate)

            return results

        except Exception as e:
            logger.error(f"Re-ranking failed: {e}")
            # Fallback: return candidates as-is
            return candidates[:top_k]


class QueryEnrichmentService:
    """Service for enriching RAG queries with keywords and concepts."""

    def __init__(self, openrouter_client: OpenRouterClient):
        self.openrouter_client = openrouter_client

    async def enrich_query(self, text: str) -> dict:
        """Enrich a query with extracted keywords and expanded concepts.

        Args:
            text: Original transcript text

        Returns:
            Dict with keywords, concepts, and enriched query
        """
        try:
            # Extract keywords
            keywords = await self.openrouter_client.extract_keywords(text)

            # Expand concepts
            concepts = await self.openrouter_client.expand_concepts(keywords)

            # Build enriched query
            enriched_query = self._build_enriched_query(text, keywords, concepts)

            return {
                "keywords": keywords,
                "concepts": concepts,
                "enriched_query": enriched_query,
            }

        except Exception as e:
            logger.error(f"Query enrichment failed: {e}")
            # Fallback: use original text
            return {
                "keywords": [],
                "concepts": [],
                "enriched_query": text,
            }

    def _build_enriched_query(
        self,
        original_text: str,
        keywords: list[str],
        concepts: list[str],
    ) -> str:
        """Build enriched query from components."""
        # Combine original text with keywords and concepts
        # Weight keywords higher by repeating them
        parts = [original_text]
        if keywords:
            parts.append(" ".join(keywords))
            parts.append(" ".join(keywords))  # Repeat for emphasis
        if concepts:
            parts.append(" ".join(concepts))

        return " ".join(parts)


class RAGService:
    """Service for RAG-based citation retrieval."""

    def __init__(
        self,
        chroma_client: ChromaClient,
        openrouter_client: OpenRouterClient,
        citation_repo: CitationRepository,
        chunk_repo: DocumentChunkRepository,
        reranker: RerankerService,
        query_enrichment: QueryEnrichmentService,
    ):
        self.chroma_client = chroma_client
        self.openrouter_client = openrouter_client
        self.citation_repo = citation_repo
        self.chunk_repo = chunk_repo
        self.reranker = reranker
        self.query_enrichment = query_enrichment

    async def query(
        self,
        session_id: UUID,
        transcript_text: str,
        window_index: int,
        transcript_id: Optional[UUID] = None,
    ) -> RAGQueryResponse:
        """Execute RAG query and return citations.

        Args:
            session_id: Session ID for document filtering
            transcript_text: Transcript window text
            window_index: Window index for ordering
            transcript_id: Optional transcript segment ID

        Returns:
            RAG query response with citations
        """
        start_time = time.time()

        # Enrich query
        enrichment = await self.query_enrichment.enrich_query(transcript_text)
        enriched_query = enrichment["enriched_query"]

        # Generate query embedding
        query_embedding = await self.openrouter_client.create_embedding(
            text=enriched_query,
            model=settings.embedding_model_realtime,
        )

        # Search Chroma for candidates
        search_results = await self.chroma_client.query(
            query_embedding=query_embedding,
            n_results=10,
            where={"session_id": str(session_id)},
        )

        # Build candidate list
        candidates = []
        for i in range(len(search_results["ids"])):
            candidates.append({
                "id": search_results["ids"][i],
                "text": search_results["documents"][i] if search_results["documents"] else "",
                "metadata": search_results["metadatas"][i] if search_results["metadatas"] else {},
                "distance": search_results["distances"][i] if search_results["distances"] else 1.0,
            })

        # Re-rank candidates
        reranked = self.reranker.rerank(
            query=transcript_text,
            candidates=candidates,
            top_k=3,
        )

        # Build citations
        citations = []
        for rank, candidate in enumerate(reranked, start=1):
            metadata = candidate.get("metadata", {})
            relevance_score = candidate.get("relevance_score", 1.0 - candidate.get("distance", 0))

            # Create citation record in database
            citation = await self.citation_repo.create(
                session_id=session_id,
                transcript_id=transcript_id,
                document_id=UUID(metadata.get("document_id")) if metadata.get("document_id") else None,
                chunk_id=UUID(candidate["id"].split("_")[0]) if "_" in candidate["id"] else None,
                window_index=window_index,
                rank=rank,
                page_number=metadata.get("page_number", 1),
                section_heading=metadata.get("section_heading"),
                snippet=candidate.get("text", "")[:200],
                relevance_score=relevance_score,
            ) if metadata.get("document_id") else None

            citations.append(
                CitationResult(
                    rank=rank,
                    document_id=UUID(metadata.get("document_id")) if metadata.get("document_id") else UUID(int=0),
                    document_name=metadata.get("document_name", "Unknown"),
                    page_number=metadata.get("page_number", 1),
                    section_heading=metadata.get("section_heading"),
                    snippet=candidate.get("text", "")[:200],
                    relevance_score=relevance_score,
                )
            )

        processing_time = int((time.time() - start_time) * 1000)

        return RAGQueryResponse(
            window_index=window_index,
            citations=citations,
            query_metadata=QueryMetadata(
                keywords=enrichment["keywords"],
                expanded_concepts=enrichment["concepts"],
                processing_time_ms=processing_time,
            ),
        )
