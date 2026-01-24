"""Dependency injection for API routes."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.external.chroma import ChromaClient, get_chroma_client
from app.external.elevenlabs import ElevenLabsClient, get_elevenlabs_client
from app.external.embeddings import LocalEmbeddingService, get_local_embedding_service
from app.external.openrouter import OpenRouterClient, get_openrouter_client
from app.repositories.citation import CitationRepository
from app.repositories.document import DocumentChunkRepository, DocumentRepository
from app.repositories.folder import FolderRepository
from app.repositories.note import NoteRepository
from app.repositories.session import SessionRepository
from app.repositories.transcript import TranscriptRepository
from app.services.document import DocumentProcessingService, DocumentService
from app.services.folder import FolderService
from app.services.note import NoteGenerationService, NoteService
from app.services.question import QuestionTranslationService
from app.services.rag import KeywordExtractor, QueryEnrichmentService, RAGService, RerankerService
from app.services.session import SessionService
from app.services.transcript import TranscriptService
from app.services.translation import TranslationService
from app.services.tts import TTSService


# Type alias for dependency injection
AsyncSessionDep = Annotated[AsyncSession, Depends(get_async_session)]


# ===========================================
# Repository Dependencies
# ===========================================
def get_folder_repository(db: AsyncSessionDep) -> FolderRepository:
    """Get FolderRepository instance."""
    return FolderRepository(db)


def get_session_repository(db: AsyncSessionDep) -> SessionRepository:
    """Get SessionRepository instance."""
    return SessionRepository(db)


def get_document_repository(db: AsyncSessionDep) -> DocumentRepository:
    """Get DocumentRepository instance."""
    return DocumentRepository(db)


def get_document_chunk_repository(db: AsyncSessionDep) -> DocumentChunkRepository:
    """Get DocumentChunkRepository instance."""
    return DocumentChunkRepository(db)


def get_transcript_repository(db: AsyncSessionDep) -> TranscriptRepository:
    """Get TranscriptRepository instance."""
    return TranscriptRepository(db)


def get_citation_repository(db: AsyncSessionDep) -> CitationRepository:
    """Get CitationRepository instance."""
    return CitationRepository(db)


def get_note_repository(db: AsyncSessionDep) -> NoteRepository:
    """Get NoteRepository instance."""
    return NoteRepository(db)


# Type aliases for repository dependencies
FolderRepoDep = Annotated[FolderRepository, Depends(get_folder_repository)]
SessionRepoDep = Annotated[SessionRepository, Depends(get_session_repository)]
DocumentRepoDep = Annotated[DocumentRepository, Depends(get_document_repository)]
DocumentChunkRepoDep = Annotated[DocumentChunkRepository, Depends(get_document_chunk_repository)]
TranscriptRepoDep = Annotated[TranscriptRepository, Depends(get_transcript_repository)]
CitationRepoDep = Annotated[CitationRepository, Depends(get_citation_repository)]
NoteRepoDep = Annotated[NoteRepository, Depends(get_note_repository)]


# ===========================================
# External Client Dependencies
# ===========================================
ChromaClientDep = Annotated[ChromaClient, Depends(get_chroma_client)]
ElevenLabsClientDep = Annotated[ElevenLabsClient, Depends(get_elevenlabs_client)]
OpenRouterClientDep = Annotated[OpenRouterClient, Depends(get_openrouter_client)]
LocalEmbeddingServiceDep = Annotated[LocalEmbeddingService, Depends(get_local_embedding_service)]


# ===========================================
# Service Dependencies
# ===========================================
def get_folder_service(folder_repo: FolderRepoDep) -> FolderService:
    """Get FolderService instance."""
    return FolderService(folder_repo)


def get_session_service(
    session_repo: SessionRepoDep,
    folder_repo: FolderRepoDep,
) -> SessionService:
    """Get SessionService instance."""
    return SessionService(session_repo, folder_repo)


def get_document_service(
    document_repo: DocumentRepoDep,
    session_repo: SessionRepoDep,
) -> DocumentService:
    """Get DocumentService instance."""
    return DocumentService(document_repo, session_repo)


def get_document_processing_service(
    document_repo: DocumentRepoDep,
    chunk_repo: DocumentChunkRepoDep,
    chroma_client: ChromaClientDep,
    embedding_service: LocalEmbeddingServiceDep,
) -> DocumentProcessingService:
    """Get DocumentProcessingService instance."""
    return DocumentProcessingService(
        document_repo, chunk_repo, chroma_client, embedding_service
    )


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
    chroma_client: ChromaClientDep,
    embedding_service: LocalEmbeddingServiceDep,
    citation_repo: CitationRepoDep,
    chunk_repo: DocumentChunkRepoDep,
    reranker: Annotated[RerankerService, Depends(get_reranker_service)],
    query_enrichment: Annotated[QueryEnrichmentService, Depends(get_query_enrichment_service)],
) -> RAGService:
    """Get RAGService instance.
    
    Uses local models for low-latency RAG:
    - bge-base-en-v1.5 for embeddings
    - KeyBERT for keyword extraction
    - TinyBERT for re-ranking
    """
    return RAGService(
        chroma_client,
        embedding_service,
        citation_repo,
        chunk_repo,
        reranker,
        query_enrichment,
    )


def get_transcript_service(
    transcript_repo: TranscriptRepoDep,
) -> TranscriptService:
    """Get TranscriptService instance."""
    return TranscriptService(transcript_repo)


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
    note_repo: NoteRepoDep,
    transcript_repo: TranscriptRepoDep,
    citation_repo: CitationRepoDep,
    session_repo: SessionRepoDep,
    generation_service: Annotated[NoteGenerationService, Depends(get_note_generation_service)],
) -> NoteService:
    """Get NoteService instance."""
    return NoteService(
        note_repo,
        transcript_repo,
        citation_repo,
        session_repo,
        generation_service,
    )


# Type aliases for service dependencies
FolderServiceDep = Annotated[FolderService, Depends(get_folder_service)]
SessionServiceDep = Annotated[SessionService, Depends(get_session_service)]
DocumentServiceDep = Annotated[DocumentService, Depends(get_document_service)]
DocumentProcessingServiceDep = Annotated[
    DocumentProcessingService, Depends(get_document_processing_service)
]
RAGServiceDep = Annotated[RAGService, Depends(get_rag_service)]
TranscriptServiceDep = Annotated[TranscriptService, Depends(get_transcript_service)]
TranslationServiceDep = Annotated[TranslationService, Depends(get_translation_service)]
QuestionTranslationServiceDep = Annotated[
    QuestionTranslationService, Depends(get_question_translation_service)
]
TTSServiceDep = Annotated[TTSService, Depends(get_tts_service)]
NoteServiceDep = Annotated[NoteService, Depends(get_note_service)]
