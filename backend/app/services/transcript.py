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
                    translated_text=transcript.translated_text,
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

    async def update_translated_text(
        self,
        transcript_id: UUID,
        translated_text: str,
    ) -> TranscriptSegmentResponse | None:
        """Update the translated text for a transcript segment."""
        transcript = await self.transcript_repo.update_translated_text(
            transcript_id=transcript_id,
            translated_text=translated_text,
        )
        if not transcript:
            return None

        return TranscriptSegmentResponse(
            id=transcript.id,
            text=transcript.text,
            translated_text=transcript.translated_text,
            start_time=transcript.start_time,
            end_time=transcript.end_time,
            confidence=transcript.confidence,
            citations=[],
        )


class SegmentBuffer:
    """Buffer for processing individual transcript segments for RAG.
    
    Changed from sliding window to per-segment processing for greater
    flexibility and more granular citation matching.
    
    Each segment triggers its own RAG query independently.
    """

    def __init__(self):
        self.current_segment = None
        self.index = 0

    def add(self, segment) -> None:
        """Add a segment to the buffer."""
        self.current_segment = segment

    def is_complete(self) -> bool:
        """Check if there's a segment ready for RAG processing.
        
        Returns True if there's a segment with non-empty text.
        Each segment is processed individually for maximum flexibility.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        if self.current_segment is None:
            return False
        
        text = self.get_text()
        has_content = len(text.strip()) > 0
        
        if has_content:
            logger.info(f"[SegmentBuffer] Triggering RAG for segment {self.index}: '{text[:50]}...'")
        
        return has_content

    def get_text(self) -> str:
        """Get the current segment text."""
        if self.current_segment is None:
            return ""
        return self.current_segment.text

    def get_segment_id(self):
        """Get the current segment's ID."""
        if self.current_segment is None:
            return None
        return self.current_segment.id

    def advance(self) -> None:
        """Advance to next segment, clearing the current one."""
        self.current_segment = None
        self.index += 1

    def clear(self) -> None:
        """Clear the buffer."""
        self.current_segment = None


# Keep alias for backward compatibility
SlidingWindowBuffer = SegmentBuffer
