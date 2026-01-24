"""Folder service for business logic."""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from app.repositories.folder import FolderRepository
from app.schemas.folder import (
    FolderCreate,
    FolderDetail,
    FolderResponse,
    FolderUpdate,
    SessionSummary,
)

logger = logging.getLogger(__name__)


class FolderService:
    """Service for folder business logic."""

    def __init__(self, folder_repo: FolderRepository):
        self.folder_repo = folder_repo

    async def list_folders(self) -> list[FolderResponse]:
        """List all non-archived folders."""
        folders = await self.folder_repo.list_all(include_archived=False)
        return [
            FolderResponse(
                id=folder.id,
                name=folder.name,
                created_at=folder.created_at,
                updated_at=folder.updated_at,
                session_count=await self.folder_repo.get_session_count(folder.id),
            )
            for folder in folders
        ]

    async def get_folder(self, folder_id: UUID) -> FolderDetail:
        """Get folder details with sessions."""
        folder = await self.folder_repo.get_with_sessions(folder_id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"},
            )

        if folder.is_archived:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "FOLDER_ARCHIVED", "message": "Folder is archived"},
            )

        # Build session summaries (non-archived only)
        sessions = [
            SessionSummary(
                id=session.id,
                name=session.name,
                status=session.status.value,
                source_language=session.source_language,
                target_language=session.target_language,
                started_at=session.started_at,
                ended_at=session.ended_at,
                has_notes=session.has_notes,
                document_count=session.document_count,
            )
            for session in folder.sessions
            if not session.is_archived
        ]

        # Sort by started_at descending
        sessions.sort(key=lambda s: s.started_at, reverse=True)

        return FolderDetail(
            id=folder.id,
            name=folder.name,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
            sessions=sessions,
        )

    async def create_folder(self, data: FolderCreate) -> FolderResponse:
        """Create a new folder."""
        # Check if name already exists
        if await self.folder_repo.name_exists(data.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "FOLDER_NAME_EXISTS",
                    "message": "A folder with this name already exists",
                },
            )

        folder = await self.folder_repo.create(data.name)
        logger.info(f"Created folder: {folder.id} - {folder.name}")

        return FolderResponse(
            id=folder.id,
            name=folder.name,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
            session_count=0,
        )

    async def update_folder(
        self,
        folder_id: UUID,
        data: FolderUpdate,
    ) -> FolderResponse:
        """Update a folder."""
        # Check if folder exists
        folder = await self.folder_repo.get_by_id(folder_id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"},
            )

        if folder.is_archived:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "FOLDER_ARCHIVED", "message": "Folder is archived"},
            )

        # Check if new name already exists (excluding current folder)
        if await self.folder_repo.name_exists(data.name, exclude_id=folder_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "FOLDER_NAME_EXISTS",
                    "message": "A folder with this name already exists",
                },
            )

        folder = await self.folder_repo.update(folder_id, data.name)
        logger.info(f"Updated folder: {folder.id} - {folder.name}")

        return FolderResponse(
            id=folder.id,
            name=folder.name,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
            session_count=await self.folder_repo.get_session_count(folder.id),
        )

    async def delete_folder(self, folder_id: UUID) -> None:
        """Delete (archive) a folder."""
        folder = await self.folder_repo.get_by_id(folder_id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"},
            )

        if folder.is_archived:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "FOLDER_ARCHIVED", "message": "Folder is already archived"},
            )

        await self.folder_repo.archive(folder_id)
        logger.info(f"Archived folder: {folder_id}")
