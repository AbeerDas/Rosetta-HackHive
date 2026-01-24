"""Transcript repository for data access operations."""

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.transcript import Transcript


class TranscriptRepository:
    """Repository for transcript data access operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        session_id: UUID,
        text: str,
        start_time: float,
        end_time: float,
        confidence: float = 1.0,
    ) -> Transcript:
        """Create a new transcript segment."""
        # Get next segment index
        next_index = await self.get_next_index(session_id)

        transcript = Transcript(
            session_id=session_id,
            segment_index=next_index,
            text=text,
            start_time=start_time,
            end_time=end_time,
            confidence=confidence,
        )
        self.db.add(transcript)
        await self.db.flush()
        await self.db.refresh(transcript)
        return transcript

    async def get_by_id(self, transcript_id: UUID) -> Optional[Transcript]:
        """Get a transcript segment by ID."""
        query = select(Transcript).where(Transcript.id == transcript_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_citations(self, transcript_id: UUID) -> Optional[Transcript]:
        """Get a transcript segment with its citations."""
        query = (
            select(Transcript)
            .where(Transcript.id == transcript_id)
            .options(selectinload(Transcript.citations))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_session(self, session_id: UUID) -> list[Transcript]:
        """List all transcript segments for a session."""
        query = (
            select(Transcript)
            .where(Transcript.session_id == session_id)
            .options(selectinload(Transcript.citations))
            .order_by(Transcript.segment_index)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_next_index(self, session_id: UUID) -> int:
        """Get the next segment index for a session."""
        query = (
            select(func.coalesce(func.max(Transcript.segment_index), -1))
            .where(Transcript.session_id == session_id)
        )
        result = await self.db.execute(query)
        max_index = result.scalar_one()
        return max_index + 1

    async def get_full_text(self, session_id: UUID) -> str:
        """Get the full transcript text for a session."""
        transcripts = await self.list_by_session(session_id)
        return " ".join(t.text for t in transcripts)

    async def get_total_duration(self, session_id: UUID) -> float:
        """Get the total duration of the transcript."""
        query = (
            select(func.max(Transcript.end_time))
            .where(Transcript.session_id == session_id)
        )
        result = await self.db.execute(query)
        max_end_time = result.scalar_one()
        return max_end_time or 0.0

    async def get_word_count(self, session_id: UUID) -> int:
        """Get the total word count for a session."""
        full_text = await self.get_full_text(session_id)
        return len(full_text.split())

    async def delete_by_session(self, session_id: UUID) -> int:
        """Delete all transcript segments for a session."""
        query = select(Transcript).where(Transcript.session_id == session_id)
        result = await self.db.execute(query)
        transcripts = result.scalars().all()
        count = len(list(transcripts))
        for transcript in transcripts:
            await self.db.delete(transcript)
        await self.db.flush()
        return count
