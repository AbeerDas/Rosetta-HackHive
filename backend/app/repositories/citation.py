"""Citation repository for data access operations."""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.citation import Citation


class CitationRepository:
    """Repository for citation data access operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        session_id: UUID,
        document_id: UUID,
        chunk_id: UUID,
        window_index: int,
        rank: int,
        page_number: int,
        snippet: str,
        relevance_score: float,
        transcript_id: Optional[UUID] = None,
        section_heading: Optional[str] = None,
    ) -> Citation:
        """Create a new citation."""
        citation = Citation(
            session_id=session_id,
            transcript_id=transcript_id,
            document_id=document_id,
            chunk_id=chunk_id,
            window_index=window_index,
            rank=rank,
            page_number=page_number,
            section_heading=section_heading,
            snippet=snippet,
            relevance_score=relevance_score,
        )
        self.db.add(citation)
        await self.db.flush()
        await self.db.refresh(citation)
        return citation

    async def create_batch(self, citations_data: list[dict]) -> list[Citation]:
        """Create multiple citations."""
        citations = []
        for data in citations_data:
            citation = Citation(**data)
            self.db.add(citation)
            citations.append(citation)
        await self.db.flush()
        for citation in citations:
            await self.db.refresh(citation)
        return citations

    async def get_by_id(self, citation_id: UUID) -> Optional[Citation]:
        """Get a citation by ID."""
        query = (
            select(Citation)
            .where(Citation.id == citation_id)
            .options(
                selectinload(Citation.document),
                selectinload(Citation.chunk),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_session(self, session_id: UUID) -> list[Citation]:
        """List all citations for a session."""
        query = (
            select(Citation)
            .where(Citation.session_id == session_id)
            .options(selectinload(Citation.document))
            .order_by(Citation.window_index, Citation.rank)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_by_transcript(self, transcript_id: UUID) -> list[Citation]:
        """List all citations for a transcript segment."""
        query = (
            select(Citation)
            .where(Citation.transcript_id == transcript_id)
            .options(selectinload(Citation.document))
            .order_by(Citation.rank)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_by_window(
        self,
        session_id: UUID,
        window_index: int,
    ) -> list[Citation]:
        """List all citations for a specific window."""
        query = (
            select(Citation)
            .where(
                Citation.session_id == session_id,
                Citation.window_index == window_index,
            )
            .options(selectinload(Citation.document))
            .order_by(Citation.rank)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def delete_by_session(self, session_id: UUID) -> int:
        """Delete all citations for a session."""
        query = select(Citation).where(Citation.session_id == session_id)
        result = await self.db.execute(query)
        citations = result.scalars().all()
        count = len(list(citations))
        for citation in citations:
            await self.db.delete(citation)
        await self.db.flush()
        return count

    async def delete_by_document(self, document_id: UUID) -> int:
        """Delete all citations for a document."""
        query = select(Citation).where(Citation.document_id == document_id)
        result = await self.db.execute(query)
        citations = result.scalars().all()
        count = len(list(citations))
        for citation in citations:
            await self.db.delete(citation)
        await self.db.flush()
        return count

    async def get_citation_count_for_session(self, session_id: UUID) -> int:
        """Get the total number of citations for a session."""
        citations = await self.list_by_session(session_id)
        return len(citations)
