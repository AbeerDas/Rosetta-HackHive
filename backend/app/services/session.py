"""Session service for business logic."""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from app.core.config import settings
from app.repositories.folder import FolderRepository
from app.repositories.session import SessionRepository
from app.schemas.session import (
    SessionCreate,
    SessionDetail,
    SessionEndRequest,
    SessionEndResponse,
    SessionResponse,
    SessionUpdate,
    DocumentSummary,
)

logger = logging.getLogger(__name__)


class SessionService:
    """Service for session business logic."""

    def __init__(
        self,
        session_repo: SessionRepository,
        folder_repo: FolderRepository,
    ):
        self.session_repo = session_repo
        self.folder_repo = folder_repo

    async def get_session(self, session_id: UUID) -> SessionDetail:
        """Get session details with documents."""
        session = await self.session_repo.get_with_documents(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Session not found"},
            )

        # Build document summaries
        documents = [
            DocumentSummary(
                id=doc.id,
                name=doc.name,
                page_count=doc.page_count,
                status=doc.status.value,
            )
            for doc in session.documents
        ]

        return SessionDetail(
            id=session.id,
            folder_id=session.folder_id,
            name=session.name,
            status=session.status.value,
            source_language=session.source_language,
            target_language=session.target_language,
            started_at=session.started_at,
            ended_at=session.ended_at,
            documents=documents,
            has_notes=session.has_notes,
        )

    async def create_session(
        self,
        folder_id: UUID,
        data: SessionCreate,
    ) -> SessionResponse:
        """Create a new session in a folder."""
        # Validate folder exists and is not archived
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

        # Validate languages
        if data.source_language not in settings.supported_languages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_LANGUAGE",
                    "message": f"Source language '{data.source_language}' is not supported",
                },
            )

        if data.target_language not in settings.supported_languages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_LANGUAGE",
                    "message": f"Target language '{data.target_language}' is not supported",
                },
            )

        session = await self.session_repo.create(
            folder_id=folder_id,
            name=data.name,
            source_language=data.source_language,
            target_language=data.target_language,
        )
        logger.info(f"Created session: {session.id} - {session.name}")

        return SessionResponse(
            id=session.id,
            folder_id=session.folder_id,
            name=session.name,
            status=session.status.value,
            source_language=session.source_language,
            target_language=session.target_language,
            started_at=session.started_at,
            ended_at=session.ended_at,
            has_notes=False,
        )

    async def update_session(
        self,
        session_id: UUID,
        data: SessionUpdate,
    ) -> SessionResponse:
        """Update a session."""
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Session not found"},
            )

        if data.name:
            session = await self.session_repo.update(session_id, data.name)
            logger.info(f"Updated session: {session.id} - {session.name}")

        return SessionResponse(
            id=session.id,
            folder_id=session.folder_id,
            name=session.name,
            status=session.status.value,
            source_language=session.source_language,
            target_language=session.target_language,
            started_at=session.started_at,
            ended_at=session.ended_at,
            has_notes=session.has_notes,
        )

    async def end_session(
        self,
        session_id: UUID,
        data: SessionEndRequest,
    ) -> SessionEndResponse:
        """End an active session."""
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Session not found"},
            )

        if not session.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "SESSION_NOT_ACTIVE",
                    "message": "Session is not active",
                },
            )

        session = await self.session_repo.end_session(session_id)
        logger.info(f"Ended session: {session_id}")

        # Note generation will be handled separately via background task
        notes_generated = False
        if data.generate_notes:
            # This will be triggered by the caller with a background task
            logger.info(f"Note generation requested for session: {session_id}")

        return SessionEndResponse(
            id=session.id,
            status=session.status.value,
            ended_at=session.ended_at,
            notes_generated=notes_generated,
        )

    async def delete_session(self, session_id: UUID) -> None:
        """Delete (archive) a session."""
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Session not found"},
            )

        await self.session_repo.archive(session_id)
        logger.info(f"Archived session: {session_id}")
