"""Note repository for data access operations."""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note


class NoteRepository:
    """Repository for note data access operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_session(self, session_id: UUID) -> Optional[Note]:
        """Get notes for a session."""
        query = select(Note).where(Note.session_id == session_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create(self, session_id: UUID, content: str) -> Note:
        """Create new notes for a session."""
        note = Note(
            session_id=session_id,
            content_markdown=content,
        )
        self.db.add(note)
        await self.db.flush()
        await self.db.refresh(note)
        return note

    async def update(self, note_id: UUID, content: str) -> Optional[Note]:
        """Update note content."""
        query = select(Note).where(Note.id == note_id)
        result = await self.db.execute(query)
        note = result.scalar_one_or_none()

        if note:
            note.content_markdown = content
            note.version += 1
            await self.db.flush()
            await self.db.refresh(note)
        return note

    async def update_by_session(
        self,
        session_id: UUID,
        content: str,
    ) -> Optional[Note]:
        """Update note content by session ID."""
        note = await self.get_by_session(session_id)
        if note:
            note.content_markdown = content
            note.version += 1
            await self.db.flush()
            await self.db.refresh(note)
        return note

    async def delete_by_session(self, session_id: UUID) -> bool:
        """Delete notes for a session."""
        note = await self.get_by_session(session_id)
        if note:
            await self.db.delete(note)
            await self.db.flush()
            return True
        return False

    async def exists_for_session(self, session_id: UUID) -> bool:
        """Check if notes exist for a session."""
        note = await self.get_by_session(session_id)
        return note is not None
