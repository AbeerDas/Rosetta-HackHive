"""Session repository for data access operations."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.session import Session, SessionStatus


class SessionRepository:
    """Repository for session data access operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, session_id: UUID) -> Optional[Session]:
        """Get a session by ID."""
        query = select(Session).where(Session.id == session_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_documents(self, session_id: UUID) -> Optional[Session]:
        """Get a session with its documents."""
        query = (
            select(Session)
            .where(Session.id == session_id)
            .options(selectinload(Session.documents))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_all_relations(self, session_id: UUID) -> Optional[Session]:
        """Get a session with all its relations."""
        query = (
            select(Session)
            .where(Session.id == session_id)
            .options(
                selectinload(Session.documents),
                selectinload(Session.transcripts),
                selectinload(Session.citations),
                selectinload(Session.note),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_folder(
        self,
        folder_id: UUID,
        include_archived: bool = False,
    ) -> list[Session]:
        """List sessions in a folder."""
        query = select(Session).where(Session.folder_id == folder_id)
        if not include_archived:
            query = query.where(Session.archived_at.is_(None))
        query = query.order_by(Session.started_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(
        self,
        folder_id: UUID,
        name: str,
        source_language: str,
        target_language: str,
    ) -> Session:
        """Create a new session."""
        session = Session(
            folder_id=folder_id,
            name=name.strip(),
            source_language=source_language,
            target_language=target_language,
            status=SessionStatus.ACTIVE,
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        return session

    async def update(self, session_id: UUID, name: str) -> Optional[Session]:
        """Update a session's name."""
        session = await self.get_by_id(session_id)
        if session:
            session.name = name.strip()
            await self.db.flush()
            await self.db.refresh(session)
        return session

    async def end_session(self, session_id: UUID) -> Optional[Session]:
        """End a session by setting status and ended_at."""
        session = await self.get_by_id(session_id)
        if session and session.status == SessionStatus.ACTIVE:
            session.status = SessionStatus.COMPLETED
            session.ended_at = datetime.now(timezone.utc)
            await self.db.flush()
            await self.db.refresh(session)
        return session

    async def archive(self, session_id: UUID) -> bool:
        """Soft-delete a session by setting archived_at."""
        session = await self.get_by_id(session_id)
        if session:
            session.archived_at = datetime.now(timezone.utc)
            session.status = SessionStatus.ARCHIVED
            await self.db.flush()
            return True
        return False

    async def is_active(self, session_id: UUID) -> bool:
        """Check if a session is active."""
        session = await self.get_by_id(session_id)
        return session is not None and session.status == SessionStatus.ACTIVE
