"""Convex HTTP client for calling Convex backend endpoints.

This client allows FastAPI to communicate with Convex for storing
transcripts, citations, and notes without using PostgreSQL.
"""

import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class ConvexClient:
    """Client for calling Convex HTTP endpoints.
    
    All data storage (transcripts, citations, notes) goes through Convex.
    Pinecone is only used for vector embeddings.
    """

    def __init__(self, base_url: Optional[str] = None):
        """Initialize Convex client.
        
        Args:
            base_url: Convex HTTP endpoint URL. Defaults to settings.convex_http_url.
        """
        self.base_url = base_url or settings.convex_http_url
        self._client = httpx.AsyncClient(timeout=30.0)
        logger.info(f"[ConvexClient] Initialized with URL: {self.base_url}")

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()

    async def _post(self, path: str, data: dict) -> dict:
        """Make a POST request to Convex HTTP endpoint.
        
        Args:
            path: API path (e.g., "/api/transcripts/add")
            data: Request body
            
        Returns:
            Response JSON
        """
        url = f"{self.base_url}{path}"
        try:
            response = await self._client.post(url, json=data)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"[ConvexClient] HTTP error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"[ConvexClient] Request failed: {e}")
            raise

    # =========================================================================
    # TRANSCRIPT OPERATIONS
    # =========================================================================

    async def add_transcript(
        self,
        session_id: str,
        original_text: str,
        timestamp: float,
        window_index: int,
        is_final: bool = True,
        translated_text: Optional[str] = None,
    ) -> str:
        """Add a transcript segment to Convex.
        
        Args:
            session_id: Convex session ID
            original_text: Original transcript text
            timestamp: Timestamp in seconds
            window_index: Window/segment index
            is_final: Whether this is a final transcript
            translated_text: Optional translated text
            
        Returns:
            Created transcript ID
        """
        data = {
            "sessionId": session_id,
            "originalText": original_text,
            "timestamp": timestamp,
            "windowIndex": window_index,
            "isFinal": is_final,
        }
        if translated_text:
            data["translatedText"] = translated_text

        result = await self._post("/api/transcripts/add", data)
        transcript_id = result.get("transcriptId")
        logger.debug(f"[ConvexClient] Added transcript: {transcript_id}")
        return transcript_id

    async def get_full_transcript(self, session_id: str) -> dict:
        """Get full transcript text for a session.
        
        Args:
            session_id: Convex session ID
            
        Returns:
            Dict with originalText and translatedText
        """
        result = await self._post("/api/transcripts/full-text", {
            "sessionId": session_id,
        })
        return result

    # =========================================================================
    # CITATION OPERATIONS
    # =========================================================================

    async def add_citations(
        self,
        session_id: str,
        citations: list[dict],
    ) -> list[str]:
        """Add a batch of citations to Convex.
        
        Args:
            session_id: Convex session ID
            citations: List of citation dicts with:
                - documentId: Convex document ID
                - pageNumber: Page number
                - chunkText: Text snippet
                - relevanceScore: Relevance score (0-1)
                - rank: Rank (1 = most relevant)
                - windowIndex: Transcript window index
                - transcriptId: Optional Convex transcript ID
                - sectionHeading: Optional section heading
                
        Returns:
            List of created citation IDs
        """
        result = await self._post("/api/citations/batch", {
            "sessionId": session_id,
            "citations": citations,
        })
        citation_ids = result.get("citationIds", [])
        logger.debug(f"[ConvexClient] Added {len(citation_ids)} citations")
        return citation_ids

    async def get_citations(self, session_id: str) -> list[dict]:
        """Get all citations for a session.
        
        Args:
            session_id: Convex session ID
            
        Returns:
            List of citation dicts with document info
        """
        result = await self._post("/api/citations/session", {
            "sessionId": session_id,
        })
        return result.get("citations", [])

    # =========================================================================
    # NOTE OPERATIONS
    # =========================================================================

    async def upsert_notes(
        self,
        session_id: str,
        content_markdown: str,
        content_markdown_translated: Optional[str] = None,
        target_language: Optional[str] = None,
    ) -> str:
        """Create or update notes for a session.
        
        Args:
            session_id: Convex session ID
            content_markdown: Markdown content (English)
            content_markdown_translated: Markdown content (target language)
            target_language: Language code for translated version
            
        Returns:
            Note ID
        """
        data = {
            "sessionId": session_id,
            "contentMarkdown": content_markdown,
        }
        if content_markdown_translated:
            data["contentMarkdownTranslated"] = content_markdown_translated
        if target_language:
            data["targetLanguage"] = target_language
        
        logger.info(f"[ConvexClient] Upserting notes - has translated: {bool(content_markdown_translated)}, targetLang: {target_language}")
            
        result = await self._post("/api/notes/upsert", data)
        note_id = result.get("noteId")
        logger.debug(f"[ConvexClient] Upserted notes: {note_id}")
        return note_id

    async def get_notes(self, session_id: str) -> Optional[dict]:
        """Get notes for a session.
        
        Args:
            session_id: Convex session ID
            
        Returns:
            Notes dict or None if not found
        """
        result = await self._post("/api/notes/session", {
            "sessionId": session_id,
        })
        return result.get("notes")


# Global client instance (lazy initialized)
_convex_client: Optional[ConvexClient] = None


def get_convex_client() -> ConvexClient:
    """Get or create the global Convex client instance."""
    global _convex_client
    if _convex_client is None:
        _convex_client = ConvexClient()
    return _convex_client


async def close_convex_client():
    """Close the global Convex client."""
    global _convex_client
    if _convex_client is not None:
        await _convex_client.close()
        _convex_client = None
