"""Pydantic schemas for API request/response models."""

from app.schemas.citation import (
    CitationCreate,
    CitationDetail,
    CitationListResponse,
    CitationResponse,
)
from app.schemas.document import (
    DocumentCreate,
    DocumentResponse,
    DocumentStatusResponse,
    DocumentsListResponse,
)
from app.schemas.folder import (
    FolderCreate,
    FolderDetail,
    FolderResponse,
    FolderUpdate,
    FoldersListResponse,
)
from app.schemas.health import HealthCheckResponse, HealthStatus, ServiceHealth
from app.schemas.note import (
    NoteGenerateRequest,
    NoteResponse,
    NoteStatusResponse,
    NoteUpdateRequest,
)
from app.schemas.rag import RAGQueryRequest, RAGQueryResponse
from app.schemas.session import (
    SessionCreate,
    SessionDetail,
    SessionEndRequest,
    SessionEndResponse,
    SessionResponse,
    SessionUpdate,
)
from app.schemas.transcript import (
    SegmentCreate,
    TranscriptResponse,
    TranscriptSegmentResponse,
)
from app.schemas.translation import (
    LanguageInfo,
    LanguagesResponse,
    QuestionTranslateRequest,
    QuestionTranslateResponse,
    TTSSpeakRequest,
)

__all__ = [
    # Health
    "HealthCheckResponse",
    "HealthStatus",
    "ServiceHealth",
    # Folder
    "FolderCreate",
    "FolderUpdate",
    "FolderResponse",
    "FolderDetail",
    "FoldersListResponse",
    # Session
    "SessionCreate",
    "SessionUpdate",
    "SessionResponse",
    "SessionDetail",
    "SessionEndRequest",
    "SessionEndResponse",
    # Document
    "DocumentCreate",
    "DocumentResponse",
    "DocumentStatusResponse",
    "DocumentsListResponse",
    # Transcript
    "SegmentCreate",
    "TranscriptSegmentResponse",
    "TranscriptResponse",
    # Citation
    "CitationCreate",
    "CitationResponse",
    "CitationDetail",
    "CitationListResponse",
    # RAG
    "RAGQueryRequest",
    "RAGQueryResponse",
    # Note
    "NoteGenerateRequest",
    "NoteUpdateRequest",
    "NoteResponse",
    "NoteStatusResponse",
    # Translation
    "LanguageInfo",
    "LanguagesResponse",
    "QuestionTranslateRequest",
    "QuestionTranslateResponse",
    "TTSSpeakRequest",
]
