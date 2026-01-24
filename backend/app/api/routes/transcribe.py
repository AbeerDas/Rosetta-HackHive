"""Transcription API routes and WebSocket handler."""

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.api.deps import RAGServiceDep, TranscriptServiceDep, get_rag_service, get_transcript_service
from app.core.database import get_async_session
from app.schemas.transcript import SegmentCreate, TranscriptResponse
from app.services.transcript import SlidingWindowBuffer

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/sessions/{session_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(
    session_id: UUID,
    service: TranscriptServiceDep,
) -> TranscriptResponse:
    """Get full transcript for a session."""
    return await service.list_segments(session_id)


@router.websocket("/stream")
async def transcription_websocket(
    websocket: WebSocket,
    session_id: UUID,
):
    """WebSocket endpoint for live transcription with RAG citations.

    Query params:
        session_id: Session ID

    Protocol:
        Client → Server: JSON segment messages
        Server → Client: JSON citation messages and confirmations
    """
    await websocket.accept()

    # Initialize sliding window buffer
    window_buffer = SlidingWindowBuffer(target_sentences=3)

    try:
        # Get fresh database session for each request
        async for db in get_async_session():
            from app.repositories.transcript import TranscriptRepository
            from app.repositories.citation import CitationRepository
            from app.repositories.document import DocumentChunkRepository
            from app.services.transcript import TranscriptService
            from app.services.rag import RAGService, RerankerService, QueryEnrichmentService
            from app.external.chroma import get_chroma_client
            from app.external.openrouter import get_openrouter_client

            transcript_repo = TranscriptRepository(db)
            transcript_service = TranscriptService(transcript_repo)

            citation_repo = CitationRepository(db)
            chunk_repo = DocumentChunkRepository(db)
            chroma_client = get_chroma_client()
            openrouter_client = get_openrouter_client()
            reranker = RerankerService()
            query_enrichment = QueryEnrichmentService(openrouter_client)

            rag_service = RAGService(
                chroma_client,
                openrouter_client,
                citation_repo,
                chunk_repo,
                reranker,
                query_enrichment,
            )

            while True:
                message = await websocket.receive_text()

                try:
                    data = json.loads(message)
                    msg_type = data.get("type")

                    if msg_type == "segment":
                        segment_data = data.get("segment", {})

                        # Create segment
                        segment = SegmentCreate(
                            text=segment_data.get("text", ""),
                            start_time=segment_data.get("start_time", 0),
                            end_time=segment_data.get("end_time", 0),
                            confidence=segment_data.get("confidence", 1.0),
                        )

                        # Save segment
                        saved_segment = await transcript_service.save_segment(
                            session_id=session_id,
                            segment=segment,
                        )

                        # Confirm save
                        await websocket.send_json({
                            "type": "segment_saved",
                            "segment_id": str(saved_segment.id),
                        })

                        # Add to window buffer (create a simple object for the buffer)
                        class SegmentWrapper:
                            def __init__(self, id, text):
                                self.id = id
                                self.text = text

                        window_buffer.add(SegmentWrapper(saved_segment.id, segment.text))

                        # Check if RAG should trigger
                        if window_buffer.is_complete():
                            # Execute RAG query
                            window_text = window_buffer.get_text()
                            rag_result = await rag_service.query(
                                session_id=session_id,
                                transcript_text=window_text,
                                window_index=window_buffer.index,
                                transcript_id=saved_segment.id,
                            )

                            # Send citations
                            if rag_result.citations:
                                await websocket.send_json({
                                    "type": "citations",
                                    "window_index": rag_result.window_index,
                                    "segment_id": str(saved_segment.id),
                                    "citations": [
                                        {
                                            "rank": c.rank,
                                            "document_name": c.document_name,
                                            "page_number": c.page_number,
                                            "snippet": c.snippet,
                                        }
                                        for c in rag_result.citations
                                    ],
                                })

                            # Advance window
                            window_buffer.advance()

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
