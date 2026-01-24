"""Transcript service for business logic."""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from app.repositories.transcript import TranscriptRepository
from app.schemas.transcript import (
    CitationBrief,
    SegmentCreate,
    TranscriptResponse,
    TranscriptSegmentResponse,
)

logger = logging.getLogger(__name__)


class TranscriptService:
    """Service for transcript management."""

    def __init__(self, transcript_repo: TranscriptRepository):
        self.transcript_repo = transcript_repo

    async def save_segment(
        self,
        session_id: UUID,
        segment: SegmentCreate,
    ) -> TranscriptSegmentResponse:
        """Save a transcript segment."""
        transcript = await self.transcript_repo.create(
            session_id=session_id,
            text=segment.text,
            start_time=segment.start_time,
            end_time=segment.end_time,
            confidence=segment.confidence,
        )

        logger.debug(f"Saved transcript segment: {transcript.id}")

        return TranscriptSegmentResponse(
            id=transcript.id,
            text=transcript.text,
            start_time=transcript.start_time,
            end_time=transcript.end_time,
            confidence=transcript.confidence,
            citations=[],
        )

    async def list_segments(
        self,
        session_id: UUID,
    ) -> TranscriptResponse:
        """List all transcript segments for a session with citations."""
        transcripts = await self.transcript_repo.list_by_session(session_id)

        segments = []
        for transcript in transcripts:
            # Build citation briefs
            citations = [
                CitationBrief(
                    rank=c.rank,
                    document_name=c.document.name if c.document else "Unknown",
                    page_number=c.page_number,
                    snippet=c.snippet,
                )
                for c in transcript.citations
            ]
            citations.sort(key=lambda x: x.rank)

            segments.append(
                TranscriptSegmentResponse(
                    id=transcript.id,
                    text=transcript.text,
                    start_time=transcript.start_time,
                    end_time=transcript.end_time,
                    confidence=transcript.confidence,
                    citations=citations,
                )
            )

        total_duration = await self.transcript_repo.get_total_duration(session_id)
        word_count = await self.transcript_repo.get_word_count(session_id)

        return TranscriptResponse(
            segments=segments,
            total_duration=total_duration,
            word_count=word_count,
        )

    async def get_full_text(self, session_id: UUID) -> str:
        """Get the full transcript text for a session."""
        return await self.transcript_repo.get_full_text(session_id)


class SlidingWindowBuffer:
    """Buffer for accumulating transcript segments into sliding windows."""

    def __init__(self, target_sentences: int = 3):
        self.segments: list = []
        self.target_sentences = target_sentences
        self.index = 0

    def add(self, segment) -> None:
        """Add a segment to the buffer."""
        self.segments.append(segment)

    def is_complete(self) -> bool:
        """Check if the window has enough sentences."""
        text = self.get_text()
        # Count sentence endings
        import re
        sentence_count = len(re.findall(r"[.!?]", text))
        return sentence_count >= self.target_sentences

    def get_text(self) -> str:
        """Get concatenated text from buffer."""
        return " ".join(s.text for s in self.segments)

    def advance(self) -> None:
        """Advance to next window, keeping last segment for overlap."""
        if self.segments:
            self.segments = [self.segments[-1]]
        self.index += 1

    def clear(self) -> None:
        """Clear the buffer."""
        self.segments = []
