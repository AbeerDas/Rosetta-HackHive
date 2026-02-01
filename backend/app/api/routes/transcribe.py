"""Transcription API routes and WebSocket handler.

Uses Convex + Pinecone for all data storage (fully cloud-native).
"""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.api.deps import ConvexClientDep, RAGServiceDep
from app.external.convex import get_convex_client
from app.external.pinecone import get_pinecone_client
from app.external.embeddings import get_local_embedding_service
from app.services.rag import RAGService, RerankerService, QueryEnrichmentService, KeywordExtractor

logger = logging.getLogger(__name__)

router = APIRouter()


class SegmentBuffer:
    """Buffer for processing individual transcript segments for RAG.
    
    Changed from sliding window to per-segment processing for greater
    flexibility and more granular citation matching.
    
    Each segment triggers its own RAG query independently.
    """

    def __init__(self):
        self.current_segment = None
        self.index = 0

    def add(self, segment_id: str, text: str) -> None:
        """Add a segment to the buffer."""
        self.current_segment = {"id": segment_id, "text": text}

    def is_complete(self) -> bool:
        """Check if there's a segment ready for RAG processing.
        
        Returns True if there's a segment with non-empty text.
        Each segment is processed individually for maximum flexibility.
        """
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
        return self.current_segment["text"]

    def get_segment_id(self) -> str | None:
        """Get the current segment's ID."""
        if self.current_segment is None:
            return None
        return self.current_segment["id"]

    def advance(self) -> None:
        """Advance to next segment, clearing the current one."""
        self.current_segment = None
        self.index += 1

    def clear(self) -> None:
        """Clear the buffer."""
        self.current_segment = None


@router.get("/sessions/{session_id}/transcript")
async def get_transcript(
    session_id: str,
    convex_client: ConvexClientDep,
):
    """Get full transcript for a session from Convex."""
    result = await convex_client.get_full_transcript(session_id)
    return result


class UpdateTranslatedTextRequest(BaseModel):
    """Request to update translated text for a segment."""
    translated_text: str


@router.websocket("/stream")
async def transcription_websocket(
    websocket: WebSocket,
    session_id: str,  # Convex session ID
):
    """WebSocket endpoint for live transcription with RAG citations.

    Query params:
        session_id: Convex Session ID

    Protocol:
        Client → Server: JSON segment messages
        Server → Client: JSON citation messages and confirmations
        
    All data is stored in Convex via HTTP (no PostgreSQL).
    """
    await websocket.accept()

    # Initialize segment buffer (processes each segment individually for RAG)
    segment_buffer = SegmentBuffer()

    # Initialize services (no database needed)
    convex_client = get_convex_client()
    pinecone_client = get_pinecone_client()
    embedding_service = get_local_embedding_service()
    reranker = RerankerService()
    keyword_extractor = KeywordExtractor()
    query_enrichment = QueryEnrichmentService(keyword_extractor)

    rag_service = RAGService(
        pinecone_client,
        embedding_service,
        convex_client,
        reranker,
        query_enrichment,
    )

    try:
        while True:
            message = await websocket.receive_text()

            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "segment":
                    segment_data = data.get("segment", {})
                    frontend_id = segment_data.get("id")  # Capture frontend's segment ID
                    
                    text = segment_data.get("text", "")
                    start_time = segment_data.get("start_time", 0)
                    window_index = segment_data.get("window_index", segment_buffer.index)
                    is_final = segment_data.get("is_final", True)

                    # Save transcript to Convex
                    try:
                        transcript_id = await convex_client.add_transcript(
                            session_id=session_id,
                            original_text=text,
                            timestamp=start_time,
                            window_index=window_index,
                            is_final=is_final,
                        )
                        
                        logger.debug(f"[Transcribe] Saved transcript {transcript_id}")

                        # Confirm save - include frontend_id for ID mapping
                        await websocket.send_json({
                            "type": "segment_saved",
                            "segment_id": transcript_id,
                            "frontend_id": frontend_id,
                        })
                    except Exception as save_error:
                        logger.error(f"[Transcribe] Failed to save transcript: {save_error}")
                        await websocket.send_json({
                            "type": "error",
                            "code": "SAVE_ERROR",
                            "message": f"Failed to save transcript: {save_error}",
                        })
                        continue

                    # Add segment to buffer for RAG processing
                    segment_buffer.add(transcript_id, text)
                    logger.debug(f"[Transcribe] Processing segment: '{segment_buffer.get_text()[:50]}...'")

                    # Each segment triggers RAG individually
                    if segment_buffer.is_complete():
                        logger.info(f"[Transcribe] Triggering RAG for segment {segment_buffer.index}")
                        segment_text = segment_buffer.get_text()
                        
                        try:
                            rag_result = await rag_service.query(
                                session_id=session_id,
                                transcript_text=segment_text,
                                window_index=segment_buffer.index,
                                transcript_id=transcript_id,
                            )

                            # Send citations to client
                            if rag_result.citations:
                                logger.info(f"[Transcribe] Sending {len(rag_result.citations)} citations to client")
                                await websocket.send_json({
                                    "type": "citations",
                                    "window_index": rag_result.window_index,
                                    "segment_id": transcript_id,
                                    "citations": [
                                        {
                                            "rank": c.rank,
                                            "document_id": c.document_id,
                                            "document_name": c.document_name,
                                            "page_number": c.page_number,
                                            "snippet": c.snippet,
                                            "relevance_score": c.relevance_score,
                                        }
                                        for c in rag_result.citations
                                    ],
                                })
                            else:
                                logger.info(f"[Transcribe] No citations found for segment {segment_buffer.index}")
                        except Exception as rag_error:
                            logger.error(f"[Transcribe] RAG query failed: {rag_error}")

                        # Advance to next segment
                        segment_buffer.advance()

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "code": "INVALID_MESSAGE",
                    "message": "Invalid JSON message",
                })
            except Exception as e:
                logger.error(f"Error processing segment: {e}")
                await websocket.send_json({
                    "type": "error",
                    "code": "PROCESSING_ERROR",
                    "message": str(e),
                })

    except WebSocketDisconnect:
        logger.info(f"Transcription WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"Transcription WebSocket error: {e}")
