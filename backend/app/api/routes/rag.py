"""RAG pipeline API routes."""

from fastapi import APIRouter

from app.api.deps import CitationRepoDep, RAGServiceDep
from app.schemas.citation import CitationDetail, CitationListResponse, CitationResponse
from app.schemas.rag import RAGQueryRequest, RAGQueryResponse

router = APIRouter()


@router.post("/query", response_model=RAGQueryResponse)
async def query_rag(
    data: RAGQueryRequest,
    service: RAGServiceDep,
) -> RAGQueryResponse:
    """Execute a RAG query and return citations."""
    return await service.query(
        session_id=data.session_id,
        transcript_text=data.transcript_text,
        window_index=data.window_index,
    )


@router.get("/sessions/{session_id}/citations", response_model=CitationListResponse)
async def list_session_citations(
    session_id,
    citation_repo: CitationRepoDep,
) -> CitationListResponse:
    """List all citations for a session."""
    from uuid import UUID
    citations = await citation_repo.list_by_session(UUID(session_id))
    return CitationListResponse(
        citations=[
            CitationResponse(
                id=c.id,
                window_index=c.window_index,
                rank=c.rank,
                document_name=c.document.name if c.document else "Unknown",
                page_number=c.page_number,
                section_heading=c.section_heading,
                snippet=c.snippet,
                relevance_score=c.relevance_score,
                created_at=c.created_at,
            )
            for c in citations
        ]
    )


@router.get("/citations/{citation_id}", response_model=CitationDetail)
async def get_citation(
    citation_id,
    citation_repo: CitationRepoDep,
) -> CitationDetail:
    """Get citation details."""
    from uuid import UUID
    from fastapi import HTTPException, status

    citation = await citation_repo.get_by_id(UUID(citation_id))
    if not citation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CITATION_NOT_FOUND", "message": "Citation not found"},
        )

    return CitationDetail(
        id=citation.id,
        document_id=citation.document_id,
        document_name=citation.document.name if citation.document else "Unknown",
        page_number=citation.page_number,
        section_heading=citation.section_heading,
        full_chunk_text=citation.chunk.content if citation.chunk else citation.snippet,
        relevance_score=citation.relevance_score,
        created_at=citation.created_at,
    )
