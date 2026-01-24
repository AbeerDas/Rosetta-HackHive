"""Folder schemas for API request/response models."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class FolderBase(BaseModel):
    """Base folder schema."""

    name: str = Field(..., min_length=1, max_length=255, description="Folder name")


class FolderCreate(FolderBase):
    """Schema for creating a folder."""

    pass


class FolderUpdate(BaseModel):
    """Schema for updating a folder."""

    name: str = Field(..., min_length=1, max_length=255, description="New folder name")


class SessionSummary(BaseModel):
    """Summary of a session for folder detail view."""

    id: UUID
    name: str
    status: str
    source_language: str
    target_language: str
    started_at: datetime
    ended_at: Optional[datetime]
    has_notes: bool
    document_count: int

    class Config:
        from_attributes = True


class FolderResponse(BaseModel):
    """Schema for folder response."""

    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime
    session_count: int

    class Config:
        from_attributes = True


class FolderDetail(BaseModel):
    """Schema for folder detail response with sessions."""

    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime
    sessions: List[SessionSummary]

    class Config:
        from_attributes = True


class FoldersListResponse(BaseModel):
    """Schema for list of folders response."""

    folders: List[FolderResponse]
