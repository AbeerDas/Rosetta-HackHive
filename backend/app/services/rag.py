"""RAG pipeline service for citation retrieval.

Optimized pipeline using local models:
- KeyBERT for keyword extraction
- bge-base-en-v1.5 for embeddings
- TinyBERT cross-encoder for re-ranking
- Distance-based early exit for efficiency

This version uses Convex + Pinecone (fully cloud-native).
"""

import logging
import time
from typing import List, Optional

from app.core.config import settings
from app.external.pinecone import PineconeClient
from app.external.convex import ConvexClient
from app.external.embeddings import LocalEmbeddingService
from app.schemas.rag import (
    CitationResult,
    QueryMetadata,
    RAGQueryResponse,
)

logger = logging.getLogger(__name__)


class KeywordExtractor:
    """Service for extracting keywords using KeyBERT.
    
    KeyBERT uses embedding similarity to identify semantically important terms,
    which aligns well with vector retrieval.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.keybert_model
        self._model = None

    @property
    def model(self):
        """Lazy load the KeyBERT model."""
        if self._model is None:
            try:
                from keybert import KeyBERT
                logger.info(f"Loading KeyBERT with model: {self.model_name}")
                self._model = KeyBERT(self.model_name)
                logger.info("KeyBERT model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load KeyBERT: {e}")
                self._model = None
        return self._model

    def extract_keywords(self, text: str, top_n: int = 5) -> List[str]:
        """Extract keywords from text.

        Args:
            text: Text to extract keywords from
            top_n: Number of keywords to extract

        Returns:
            List of extracted keywords
        """
        if not text or len(text.strip()) < 10:
            return []

        if self.model is None:
            logger.warning("KeyBERT not available, returning empty keywords")
            return []

        try:
            # Extract keywords with KeyBERT
            # Use n-gram range of 1-2 to capture both single words and phrases
            keywords_with_scores = self.model.extract_keywords(
                text,
                keyphrase_ngram_range=(1, 2),
                stop_words="english",
                top_n=top_n,
                use_maxsum=True,  # Maximize diversity
                nr_candidates=20,
            )
            
            # Extract just the keyword strings
            keywords = [kw for kw, score in keywords_with_scores]
            logger.debug(f"[KeyBERT] Extracted keywords: {keywords}")
            return keywords

        except Exception as e:
            logger.error(f"Keyword extraction failed: {e}")
            return []


class QueryEnrichmentService:
    """Service for enriching RAG queries with keywords.
    
    Uses KeyBERT for local keyword extraction instead of LLM API calls.
    """

    def __init__(self, keyword_extractor: KeywordExtractor):
        self.keyword_extractor = keyword_extractor

    def enrich_query(self, text: str) -> dict:
        """Enrich a query with extracted keywords.

        Args:
            text: Original transcript text

        Returns:
            Dict with keywords and enriched query
        """
        # Extract keywords using KeyBERT
        keywords = self.keyword_extractor.extract_keywords(text, top_n=5)

        # Build enriched query by appending keywords
        enriched_query = self._build_enriched_query(text, keywords)

        return {
            "keywords": keywords,
            "concepts": [],  # No longer using concept expansion
            "enriched_query": enriched_query,
        }

    def _build_enriched_query(self, original_text: str, keywords: List[str]) -> str:
        """Build enriched query from components."""
        if not keywords:
            return original_text
            
        # Append keywords to original text for embedding
        keyword_str = " ".join(keywords)
        return f"{original_text} {keyword_str}"


class RerankerService:
    """Service for re-ranking search results using cross-encoder.
    
    Uses TinyBERT (2 layers) for fast inference while maintaining quality.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.reranker_model
        self._model = None

    @property
    def model(self):
        """Lazy load the cross-encoder model."""
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder
                logger.info(f"Loading cross-encoder: {self.model_name}")
                self._model = CrossEncoder(self.model_name)
                logger.info(f"Cross-encoder loaded: {self.model_name}")
            except Exception as e:
                logger.error(f"Failed to load cross-encoder: {e}")
                self._model = None
        return self._model

    def rerank(
        self,
        query: str,
        candidates: List[dict],
        top_k: int = None,
    ) -> List[dict]:
        """Re-rank candidates using cross-encoder.

        Args:
            query: Query text
            candidates: List of candidate dicts with 'text' key
            top_k: Number of top results to return

        Returns:
            Re-ranked and filtered candidates
        """
        top_k = top_k or settings.rag_top_k_results
        
        if not candidates:
            logger.debug("[Reranker] No candidates to rerank")
            return []

        if self.model is None:
            # Fallback: return candidates based on distance
            logger.warning("[Reranker] Cross-encoder not available, using distance fallback")
            return self._fallback_ranking(candidates, top_k)

        try:
            # Create query-candidate pairs
            pairs = [[query, c.get("text", "")] for c in candidates]

            # Get scores from cross-encoder
            scores = self.model.predict(pairs)
            
            logger.debug(f"[Reranker] Raw scores: {[f'{s:.3f}' for s in scores]}")

            # Combine candidates with scores
            scored_candidates = list(zip(candidates, scores))

            # Sort by score descending
            scored_candidates.sort(key=lambda x: x[1], reverse=True)

            # Filter by threshold and take top_k
            results = []
            for candidate, score in scored_candidates[:top_k]:
                logger.debug(f"[Reranker] Score: {score:.3f} (threshold: {settings.rag_relevance_threshold})")
                if score >= settings.rag_relevance_threshold:
                    candidate["relevance_score"] = float(score)
                    results.append(candidate)

            logger.info(f"[Reranker] {len(results)}/{len(candidates)} passed threshold")
            return results

        except Exception as e:
            logger.error(f"[Reranker] Re-ranking failed: {e}")
            return self._fallback_ranking(candidates, top_k)

    def _fallback_ranking(self, candidates: List[dict], top_k: int) -> List[dict]:
        """Fallback ranking using distance scores."""
        for c in candidates:
            distance = c.get("distance", 1.0)
            # Convert distance to similarity score (0-1 range)
            c["relevance_score"] = max(0, 1.0 - (distance / 2.0))
        return candidates[:top_k]


class RAGService:
    """Service for RAG-based citation retrieval.
    
    Optimized pipeline using Convex + Pinecone (fully cloud-native):
    1. KeyBERT keyword extraction (~15ms)
    2. Local embedding with bge-base-en-v1.5 (~10ms)
    3. Pinecone vector search, top 5 (~20-30ms)
    4. Distance-based early exit (0ms)
    5. TinyBERT re-ranking (~30-40ms)
    6. Store citations in Convex via HTTP
    
    Total: ~75-100ms (vs ~500ms with API calls)
    """

    def __init__(
        self,
        pinecone_client: PineconeClient,
        embedding_service: LocalEmbeddingService,
        convex_client: ConvexClient,
        reranker: RerankerService,
        query_enrichment: QueryEnrichmentService,
    ):
        self.pinecone_client = pinecone_client
        self.embedding_service = embedding_service
        self.convex_client = convex_client
        self.reranker = reranker
        self.query_enrichment = query_enrichment

    async def query(
        self,
        session_id: str,  # Convex session ID (string)
        transcript_text: str,
        window_index: int,
        transcript_id: Optional[str] = None,  # Convex transcript ID (string)
    ) -> RAGQueryResponse:
        """Execute RAG query and return citations.

        Args:
            session_id: Convex session ID for document filtering
            transcript_text: Transcript window text
            window_index: Window index for ordering
            transcript_id: Optional Convex transcript ID

        Returns:
            RAG query response with citations
        """
        start_time = time.time()
        logger.info(f"[RAG] Starting query for session {session_id}, window {window_index}")
        logger.debug(f"[RAG] Transcript text: {transcript_text[:100]}...")

        # Step 1: Enrich query with KeyBERT keywords
        enrichment = self.query_enrichment.enrich_query(transcript_text)
        enriched_query = enrichment["enriched_query"]
        logger.debug(f"[RAG] Keywords: {enrichment['keywords']}")

        # Step 2: Generate embedding locally with bge-base-en-v1.5
        query_embedding = self.embedding_service.create_embedding(enriched_query)
        logger.debug(f"[RAG] Generated embedding with {len(query_embedding)} dimensions")

        # Step 3: Search Pinecone for top 5 candidates
        search_results = await self.pinecone_client.query(
            collection_name="documents",
            query_embeddings=[query_embedding],
            n_results=settings.rag_top_k_candidates,
            where={"session_id": session_id},  # Filter by Convex session ID (string)
        )

        # Build candidate list from Pinecone results
        candidates = self._build_candidates(search_results)
        logger.info(f"[RAG] Pinecone returned {len(candidates)} candidates")

        # Step 4: Distance-based early exit
        if self._should_early_exit(candidates):
            processing_time = int((time.time() - start_time) * 1000)
            logger.info(f"[RAG] Early exit - no candidates within distance threshold")
            return RAGQueryResponse(
                window_index=window_index,
                citations=[],
                query_metadata=QueryMetadata(
                    keywords=enrichment["keywords"],
                    expanded_concepts=[],
                    processing_time_ms=processing_time,
                ),
            )

        # Step 5: Re-rank candidates with TinyBERT cross-encoder
        reranked = self.reranker.rerank(
            query=transcript_text,
            candidates=candidates,
            top_k=settings.rag_top_k_results,
        )
        logger.info(f"[RAG] Re-ranked to {len(reranked)} citations above threshold")

        # Step 6: Build citations from Pinecone metadata
        citations = self._build_citations(reranked)

        # Step 7: Store citations in Convex (async, best-effort)
        if citations:
            await self._store_citations_in_convex(
                session_id=session_id,
                transcript_id=transcript_id,
                citations=citations,
                window_index=window_index,
            )

        processing_time = int((time.time() - start_time) * 1000)
        logger.info(f"[RAG] Pipeline completed in {processing_time}ms")

        return RAGQueryResponse(
            window_index=window_index,
            citations=citations,
            query_metadata=QueryMetadata(
                keywords=enrichment["keywords"],
                expanded_concepts=[],
                processing_time_ms=processing_time,
            ),
        )

    def _build_candidates(self, search_results: dict) -> List[dict]:
        """Build candidate list from Pinecone search results."""
        candidates = []
        
        result_ids = search_results.get("ids", [[]])[0]
        result_docs = search_results.get("documents", [[]])[0] if search_results.get("documents") else []
        result_metas = search_results.get("metadatas", [[]])[0] if search_results.get("metadatas") else []
        result_dists = search_results.get("distances", [[]])[0] if search_results.get("distances") else []

        for i in range(len(result_ids)):
            candidate = {
                "id": result_ids[i],
                "text": result_docs[i] if i < len(result_docs) else "",
                "metadata": result_metas[i] if i < len(result_metas) else {},
                "distance": result_dists[i] if i < len(result_dists) else 1.0,
            }
            candidates.append(candidate)
            
            if i < 3:  # Log first 3 for debugging
                logger.debug(
                    f"[RAG] Candidate {i}: distance={candidate['distance']:.3f}, "
                    f"doc={candidate['metadata'].get('document_name', 'N/A')}"
                )

        return candidates

    def _should_early_exit(self, candidates: List[dict]) -> bool:
        """Check if we should skip re-ranking due to poor matches.
        
        If all candidates have distance > threshold, skip re-ranking entirely.
        """
        if not candidates:
            return True
            
        distances = [c.get("distance", float("inf")) for c in candidates]
        min_distance = min(distances)
        
        should_exit = min_distance > settings.rag_distance_threshold
        
        if should_exit:
            logger.debug(
                f"[RAG] Early exit: min_distance={min_distance:.3f} > "
                f"threshold={settings.rag_distance_threshold}"
            )
        
        return should_exit

    def _build_citations(self, reranked: List[dict]) -> List[CitationResult]:
        """Build citation results from Pinecone metadata.
        
        All document info comes from Pinecone metadata - no database lookup needed.
        """
        citations = []

        for rank, candidate in enumerate(reranked, start=1):
            metadata = candidate.get("metadata", {})
            relevance_score = candidate.get("relevance_score", 0.5)

            # Get document info from Pinecone metadata
            document_id = metadata.get("document_id")
            document_name = metadata.get("document_name", "Unknown")
            page_number = metadata.get("page_number", 0)
            section_heading = metadata.get("section_heading")
            
            if not document_id:
                logger.warning(f"[RAG] No document_id in metadata for candidate: {candidate['id']}")
                continue

            citations.append(
                CitationResult(
                    rank=rank,
                    document_id=document_id,  # Convex document ID (string)
                    document_name=document_name,
                    page_number=page_number,
                    section_heading=section_heading,
                    snippet=candidate.get("text", "")[:200],
                    relevance_score=relevance_score,
                )
            )
            
            logger.debug(
                f"[RAG] Citation {rank}: {document_name} p.{page_number} "
                f"(score: {relevance_score:.3f})"
            )

        return citations

    async def _store_citations_in_convex(
        self,
        session_id: str,
        transcript_id: Optional[str],
        citations: List[CitationResult],
        window_index: int,
    ) -> None:
        """Store citations in Convex via HTTP.
        
        Best-effort storage - failures are logged but don't fail the RAG query.
        """
        try:
            citations_data = [
                {
                    "documentId": c.document_id,
                    "pageNumber": c.page_number,
                    "chunkText": c.snippet,
                    "relevanceScore": c.relevance_score,
                    "rank": c.rank,
                    "windowIndex": window_index,
                    "transcriptId": transcript_id,
                    "sectionHeading": c.section_heading,
                }
                for c in citations
            ]
            
            await self.convex_client.add_citations(
                session_id=session_id,
                citations=citations_data,
            )
            logger.debug(f"[RAG] Stored {len(citations)} citations in Convex")
            
        except Exception as e:
            # Don't fail the RAG query if Convex storage fails
            logger.error(f"[RAG] Failed to store citations in Convex: {e}")
