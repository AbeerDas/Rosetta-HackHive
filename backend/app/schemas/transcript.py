"""Transcript schemas for API request/response models."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SegmentCreate(BaseModel):
    """Schema for creating a transcript segment."""

    text: str = Field(..., min_length=1, description="Transcribed text")
    start_time: float = Field(..., ge=0, description="Start time in seconds")
    end_time: float = Field(..., ge=0, description="End time in seconds")
    confidence: float = Field(default=1.0, ge=0, le=1, description="Recognition confidence")


class CitationBrief(BaseModel):
    """Brief citation info for transcript segments."""

    rank: int
    document_name: str
    page_number: int
    snippet: str

    class Config:
        from_attributes = True


class TranscriptSegmentResponse(BaseModel):
    """Schema for transcript segment response."""

    id: UUID
    text: str
    start_time: float
    end_time: float
    confidence: float
    citations: List[CitationBrief]

    class Config:
        from_attributes = True


class TranscriptResponse(BaseModel):
    """Schema for full transcript response."""

    segments: List[TranscriptSegmentResponse]
    total_duration: float
    word_count: int


# WebSocket message schemas
class TranscriptSegmentMessage(BaseModel):
    """WebSocket message for transcript segment."""

    type: str = "segment"
    segment: SegmentCreate


class CitationsMessage(BaseModel):
    """WebSocket message for citations."""

    type: str = "citations"
    window_index: int
    segment_id: str
    citations: List[CitationBrief]


class SegmentSavedMessage(BaseModel):
    """WebSocket message for segment saved confirmation."""

    type: str = "segment_saved"
    segment_id: str
