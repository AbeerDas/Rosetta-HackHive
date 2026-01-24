"""Session schemas for API request/response models."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.config import settings


class SessionBase(BaseModel):
    """Base session schema."""

    name: str = Field(..., min_length=1, max_length=255, description="Session name")


class SessionCreate(SessionBase):
    """Schema for creating a session."""

    source_language: str = Field(default="en", description="Source language code")
    target_language: str = Field(..., description="Target language code")

    @property
    def is_valid_source_language(self) -> bool:
        """Validate source language."""
        return self.source_language in settings.supported_languages

    @property
    def is_valid_target_language(self) -> bool:
        """Validate target language."""
        return self.target_language in settings.supported_languages


class SessionUpdate(BaseModel):
    """Schema for updating a session."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)


class SessionEndRequest(BaseModel):
    """Schema for ending a session."""

    generate_notes: bool = Field(default=False, description="Generate notes on session end")


class SessionEndResponse(BaseModel):
    """Schema for end session response."""

    id: UUID
    status: str
    ended_at: datetime
    notes_generated: bool


class DocumentSummary(BaseModel):
    """Summary of a document for session detail view."""

    id: UUID
    name: str
    page_count: int
    status: str

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    """Schema for session response."""

    id: UUID
    folder_id: UUID
    name: str
    status: str
    source_language: str
    target_language: str
    started_at: datetime
    ended_at: Optional[datetime]
    has_notes: bool

    class Config:
        from_attributes = True


class SessionDetail(BaseModel):
    """Schema for session detail response with documents."""

    id: UUID
    folder_id: UUID
    name: str
    status: str
    source_language: str
    target_language: str
    started_at: datetime
    ended_at: Optional[datetime]
    documents: List[DocumentSummary]
    has_notes: bool

    class Config:
        from_attributes = True
