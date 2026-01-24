"""Note schemas for API request/response models."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class NoteGenerateRequest(BaseModel):
    """Schema for note generation request."""

    force_regenerate: bool = Field(
        default=False,
        description="Force regeneration even if notes exist",
    )
    output_language: Optional[str] = Field(
        default=None,
        description="Language code for generated notes (e.g., 'en', 'zh', 'hi', 'es', 'fr'). Defaults to English.",
    )


class NoteUpdateRequest(BaseModel):
    """Schema for note update request."""

    content_markdown: str = Field(..., min_length=1, description="Updated note content")


class NoteResponse(BaseModel):
    """Schema for note response."""

    id: UUID
    session_id: UUID
    content_markdown: str
    generated_at: datetime
    last_edited_at: datetime
    version: int
    word_count: int
    citation_count: int

    class Config:
        from_attributes = True


class NoteStatusResponse(BaseModel):
    """Schema for note generation status."""

    status: str  # "not_generated" | "generating" | "ready" | "error"
    progress: int
    error_message: Optional[str]
