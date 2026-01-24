"""Citation schemas for API request/response models."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class CitationCreate(BaseModel):
    """Schema for creating a citation (internal use)."""

    session_id: UUID
    transcript_id: Optional[UUID]
    document_id: UUID
    chunk_id: UUID
    window_index: int
    rank: int
    page_number: int
    section_heading: Optional[str]
    snippet: str
    relevance_score: float


class CitationResponse(BaseModel):
    """Schema for citation response."""

    id: UUID
    window_index: int
    rank: int
    document_name: str
    page_number: int
    section_heading: Optional[str]
    snippet: str
    relevance_score: float
    created_at: datetime

    class Config:
        from_attributes = True


class CitationDetail(BaseModel):
    """Schema for citation detail response."""

    id: UUID
    document_id: UUID
    document_name: str
    page_number: int
    section_heading: Optional[str]
    full_chunk_text: str
    relevance_score: float
    created_at: datetime


class CitationListResponse(BaseModel):
    """Schema for list of citations response."""

    citations: List[CitationResponse]
