"""Document schemas for API request/response models."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    """Schema for document creation (internal use)."""

    name: str
    file_path: str
    file_size: int


class DocumentResponse(BaseModel):
    """Schema for document response."""

    id: UUID
    name: str
    file_size: int
    page_count: int
    chunk_count: int
    status: str
    processing_progress: int
    error_message: Optional[str]
    uploaded_at: datetime
    processed_at: Optional[datetime]

    class Config:
        from_attributes = True


class DocumentStatusResponse(BaseModel):
    """Schema for document status response."""

    status: str
    progress: int
    error_message: Optional[str]
    chunks_processed: int
    chunks_total: int


class DocumentPreviewResponse(BaseModel):
    """Schema for document preview URL response."""

    url: str
    expires_at: datetime


class DocumentsListResponse(BaseModel):
    """Schema for list of documents response."""

    documents: List[DocumentResponse]
