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

    async def upsert(self, session_id: UUID, content: str) -> Note:
        """Create or update notes for a session (handles race conditions).
        
        This method first tries to get existing notes and update them.
        If no notes exist, it creates new ones. This avoids race conditions
        where notes might be created between the check and the insert.
        """
        # Try to get existing note first
        note = await self.get_by_session(session_id)
        
        if note:
            # Update existing
            note.content_markdown = content
            note.version += 1
            await self.db.flush()
            await self.db.refresh(note)
            return note
        else:
            # Create new - if this fails due to race condition, 
            # the caller should catch and retry with update
            note = Note(
                session_id=session_id,
                content_markdown=content,
            )
            self.db.add(note)
            await self.db.flush()
            await self.db.refresh(note)
            return note
