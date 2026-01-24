"""RAG pipeline schemas for API request/response models."""

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RAGQueryRequest(BaseModel):
    """Schema for RAG query request."""

    session_id: UUID = Field(..., description="Session ID for document filtering")
    transcript_text: str = Field(..., min_length=1, description="Transcript window text")
    window_index: int = Field(..., ge=0, description="Window index for ordering")


class CitationResult(BaseModel):
    """Schema for individual citation result."""

    rank: int
    document_id: UUID
    document_name: str
    page_number: int
    section_heading: Optional[str]
    snippet: str
    relevance_score: float


class QueryMetadata(BaseModel):
    """Schema for query processing metadata."""

    keywords: List[str]
    expanded_concepts: List[str]
    processing_time_ms: int


class RAGQueryResponse(BaseModel):
    """Schema for RAG query response."""

    window_index: int
    citations: List[CitationResult]
    query_metadata: QueryMetadata
