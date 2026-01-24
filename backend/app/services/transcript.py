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
    """Buffer for accumulating transcript segments into sliding windows.
    
    Per FRD-05 Sliding Window Logic:
    - Trigger after 2-3 complete sentences OR sufficient content
    - Minimum window size: 30 words
    - Maximum window size: 150 words
    - New window starts from last sentence of previous window (overlap)
    
    Note: Web Speech API typically doesn't add punctuation, so we also
    trigger based on segment count and word count as fallback.
    """

    # FRD-05 constants - lowered MIN_WORDS for better triggering with speech
    MIN_WORDS = 15  # Lowered from 30 - speech segments are often short
    MAX_WORDS = 150
    MIN_SEGMENTS = 2  # Fallback: trigger after N segments if no punctuation
    
    # Common abbreviations that don't end sentences
    ABBREVIATIONS = {
        "dr.", "prof.", "mr.", "mrs.", "ms.", "jr.", "sr.",
        "etc.", "e.g.", "i.e.", "vs.", "fig.", "eq.", "ch.",
        "vol.", "no.", "p.", "pp.", "ed.", "eds."
    }

    def __init__(self, target_sentences: int = 3):
        self.segments: list = []
        self.target_sentences = target_sentences
        self.index = 0

    def add(self, segment) -> None:
        """Add a segment to the buffer."""
        self.segments.append(segment)

    def _count_sentences(self, text: str) -> int:
        """Count sentences with abbreviation awareness.
        
        Handles:
        - Standard sentence endings: . ! ?
        - Ignores abbreviations: Dr., Prof., etc.
        - Ignores ellipsis: ...
        """
        import re
        
        # Normalize text
        text_lower = text.lower()
        
        # Find all potential sentence endings
        endings = list(re.finditer(r'[.!?]+', text))
        
        sentence_count = 0
        for match in endings:
            pos = match.start()
            ending_char = match.group()
            
            # Skip ellipsis (... or more)
            if ending_char == '...' or len(ending_char) > 2:
                continue
            
            # Check if this is an abbreviation
            is_abbreviation = False
            if ending_char == '.':
                # Look backwards for a word
                before = text_lower[:pos + 1]
                words_before = before.split()
                if words_before:
                    last_word = words_before[-1]
                    if last_word in self.ABBREVIATIONS:
                        is_abbreviation = True
            
            if not is_abbreviation:
                sentence_count += 1
        
        return sentence_count

    def _count_words(self, text: str) -> int:
        """Count words in text."""
        return len(text.split())

    def is_complete(self) -> bool:
        """Check if the window meets trigger criteria.
        
        Returns True if ANY of these conditions are met:
        1. Has enough sentences (target_sentences) AND minimum words
        2. Max words exceeded (150) - force trigger
        3. Enough segments (2+) AND minimum words - fallback for speech
           recognition which doesn't add punctuation
        
        This ensures RAG triggers for both:
        - Text with punctuation (traditional sentence detection)
        - Speech recognition output (no punctuation, uses segment count)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        text = self.get_text()
        word_count = self._count_words(text)
        sentence_count = self._count_sentences(text)
        segment_count = len(self.segments)
        
        logger.info(f"[SlidingWindow] Check complete: words={word_count}, sentences={sentence_count}, segments={segment_count}")
        
        # Force trigger if max words exceeded
        if word_count >= self.MAX_WORDS:
            logger.info(f"[SlidingWindow] Triggering: max words exceeded ({word_count} >= {self.MAX_WORDS})")
            return True
        
        # Standard trigger: enough sentences AND minimum words
        if sentence_count >= self.target_sentences and word_count >= self.MIN_WORDS:
            logger.info(f"[SlidingWindow] Triggering: sentences={sentence_count}, words={word_count}")
            return True
        
        # Fallback for speech recognition (no punctuation):
        # Trigger after MIN_SEGMENTS segments with enough words
        # Each speech segment is roughly a phrase/clause
        if segment_count >= self.MIN_SEGMENTS and word_count >= self.MIN_WORDS:
            logger.info(f"[SlidingWindow] Triggering: segments={segment_count}, words={word_count}")
            return True
        
        logger.debug(f"[SlidingWindow] Not triggering yet: need {self.MIN_WORDS} words with {self.MIN_SEGMENTS} segments")
        return False

    def get_text(self) -> str:
        """Get concatenated text from buffer."""
        return " ".join(s.text for s in self.segments)

    def advance(self) -> None:
        """Advance to next window, keeping last segment for overlap.
        
        Per FRD-05: New window starts from last sentence of previous window
        to ensure context continuity across queries.
        """
        if self.segments:
            self.segments = [self.segments[-1]]
        self.index += 1

    def clear(self) -> None:
        """Clear the buffer."""
        self.segments = []
