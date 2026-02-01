"""Dependency injection for API routes.

Uses Convex + Pinecone for all data storage (fully cloud-native).
"""

from typing import Annotated

from fastapi import Depends

from app.external.pinecone import PineconeClient, get_pinecone_client
from app.external.convex import ConvexClient, get_convex_client
from app.external.elevenlabs import ElevenLabsClient, get_elevenlabs_client
from app.external.embeddings import LocalEmbeddingService, get_local_embedding_service
from app.external.openrouter import OpenRouterClient, get_openrouter_client
from app.services.document import ConvexDocumentProcessingService
from app.services.note import NoteGenerationService, NoteService
from app.services.question import QuestionTranslationService
from app.services.rag import KeywordExtractor, QueryEnrichmentService, RAGService, RerankerService
from app.services.translation import TranslationService
from app.services.tts import TTSService


# ===========================================
# External Client Dependencies
# ===========================================
PineconeClientDep = Annotated[PineconeClient, Depends(get_pinecone_client)]
ConvexClientDep = Annotated[ConvexClient, Depends(get_convex_client)]
ElevenLabsClientDep = Annotated[ElevenLabsClient, Depends(get_elevenlabs_client)]
OpenRouterClientDep = Annotated[OpenRouterClient, Depends(get_openrouter_client)]
LocalEmbeddingServiceDep = Annotated[LocalEmbeddingService, Depends(get_local_embedding_service)]


# ===========================================
# Service Dependencies
# ===========================================

def get_convex_document_processing_service(
    pinecone_client: PineconeClientDep,
    embedding_service: LocalEmbeddingServiceDep,
) -> ConvexDocumentProcessingService:
    """Get ConvexDocumentProcessingService instance.
    
    This service processes documents stored in Convex Storage
    and stores embeddings in Pinecone.
    """
    return ConvexDocumentProcessingService(pinecone_client, embedding_service)


def get_reranker_service() -> RerankerService:
    """Get RerankerService instance (TinyBERT cross-encoder)."""
    return RerankerService()


def get_keyword_extractor() -> KeywordExtractor:
    """Get KeywordExtractor instance (KeyBERT)."""
    return KeywordExtractor()


def get_query_enrichment_service(
    keyword_extractor: Annotated[KeywordExtractor, Depends(get_keyword_extractor)],
) -> QueryEnrichmentService:
    """Get QueryEnrichmentService instance (uses KeyBERT for local keyword extraction)."""
    return QueryEnrichmentService(keyword_extractor)


def get_rag_service(
    pinecone_client: PineconeClientDep,
    embedding_service: LocalEmbeddingServiceDep,
    convex_client: ConvexClientDep,
    reranker: Annotated[RerankerService, Depends(get_reranker_service)],
    query_enrichment: Annotated[QueryEnrichmentService, Depends(get_query_enrichment_service)],
) -> RAGService:
    """Get RAGService instance.
    
    Uses local models for low-latency RAG:
    - bge-base-en-v1.5 for embeddings
    - KeyBERT for keyword extraction
    - TinyBERT for re-ranking
    - Pinecone for vector search
    - Convex for citation storage
    """
    return RAGService(
        pinecone_client,
        embedding_service,
        convex_client,
        reranker,
        query_enrichment,
    )


def get_translation_service(
    elevenlabs_client: ElevenLabsClientDep,
) -> TranslationService:
    """Get TranslationService instance."""
    return TranslationService(elevenlabs_client)


def get_question_translation_service(
    openrouter_client: OpenRouterClientDep,
) -> QuestionTranslationService:
    """Get QuestionTranslationService instance."""
    return QuestionTranslationService(openrouter_client)


def get_tts_service(
    elevenlabs_client: ElevenLabsClientDep,
) -> TTSService:
    """Get TTSService instance."""
    return TTSService(elevenlabs_client)


def get_note_generation_service(
    openrouter_client: OpenRouterClientDep,
) -> NoteGenerationService:
    """Get NoteGenerationService instance."""
    return NoteGenerationService(openrouter_client)


def get_note_service(
    convex_client: ConvexClientDep,
    generation_service: Annotated[NoteGenerationService, Depends(get_note_generation_service)],
) -> NoteService:
    """Get NoteService instance.
    
    Uses Convex for all data storage.
    """
    return NoteService(
        convex_client,
        generation_service,
    )


# Type aliases for service dependencies
ConvexDocumentProcessingServiceDep = Annotated[
    ConvexDocumentProcessingService, Depends(get_convex_document_processing_service)
]
RAGServiceDep = Annotated[RAGService, Depends(get_rag_service)]
TranslationServiceDep = Annotated[TranslationService, Depends(get_translation_service)]
QuestionTranslationServiceDep = Annotated[
    QuestionTranslationService, Depends(get_question_translation_service)
]
TTSServiceDep = Annotated[TTSService, Depends(get_tts_service)]
NoteServiceDep = Annotated[NoteService, Depends(get_note_service)]
