"""RAG pipeline API routes.

Uses Convex + Pinecone for all data storage (fully cloud-native).
"""

from fastapi import APIRouter

from app.api.deps import ConvexClientDep, RAGServiceDep
from app.schemas.rag import RAGQueryRequest, RAGQueryResponse

router = APIRouter()


@router.post("/query", response_model=RAGQueryResponse)
async def query_rag(
    data: RAGQueryRequest,
    service: RAGServiceDep,
) -> RAGQueryResponse:
    """Execute a RAG query and return citations.
    
    Citations are automatically stored in Convex via HTTP.
    """
    return await service.query(
        session_id=data.session_id,
        transcript_text=data.transcript_text,
        window_index=data.window_index,
        transcript_id=data.transcript_id,
    )


@router.get("/sessions/{session_id}/citations")
async def list_session_citations(
    session_id: str,
    convex_client: ConvexClientDep,
):
    """List all citations for a session from Convex."""
    citations = await convex_client.get_citations(session_id)
    return {"citations": citations}
