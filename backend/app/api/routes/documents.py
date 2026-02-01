"""Document management API routes.

NOTE: Document metadata is stored in Convex.
This file handles:
1. Document processing (PDF → Pinecone embeddings)
2. Pinecone debug endpoints
"""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import (
    PineconeClientDep,
    ConvexDocumentProcessingServiceDep,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def documents_info():
    """Info endpoint - document metadata is stored in Convex."""
    return {
        "message": "Document metadata is stored in Convex. Document embeddings are stored in Pinecone.",
        "endpoints": {
            "process": "POST /documents/process-convex - Process a document from Convex storage",
            "debug": "GET /documents/debug/pinecone/{session_id} - Debug Pinecone for a session",
        },
    }


# ============================================================================
# CONVEX INTEGRATION - Process documents stored in Convex
# ============================================================================

class ConvexDocumentProcessRequest(BaseModel):
    """Request to process a document from Convex."""
    document_id: str  # Convex document ID (not UUID)
    session_id: str   # Convex session ID (not UUID)
    file_url: str     # Convex Storage URL
    file_name: str    # Original filename


class ConvexDocumentProcessResponse(BaseModel):
    """Response from document processing."""
    document_id: str
    status: str
    page_count: int = 0
    chunk_count: int = 0
    error: str | None = None


@router.post("/process-convex", response_model=ConvexDocumentProcessResponse)
async def process_convex_document(
    request: ConvexDocumentProcessRequest,
    processing_service: ConvexDocumentProcessingServiceDep,
):
    """
    Process a document that's stored in Convex.
    
    This endpoint:
    1. Downloads the PDF from the Convex Storage URL
    2. Extracts text and chunks it
    3. Generates embeddings using local bge-base-en-v1.5 model
    4. Stores embeddings in Pinecone with session_id for filtering
    
    Called by the frontend after uploading to Convex.
    Processing is synchronous so frontend can update Convex status.
    """
    logger.info(f"[ConvexDoc] Processing document {request.document_id} from session {request.session_id}")
    
    # Process synchronously so we can return results
    result = await processing_service.process_convex_document(
        document_id=request.document_id,
        session_id=request.session_id,
        file_url=request.file_url,
        file_name=request.file_name,
    )
    
    return ConvexDocumentProcessResponse(
        document_id=request.document_id,
        status=result.get("status", "error"),
        page_count=result.get("page_count", 0),
        chunk_count=result.get("chunk_count", 0),
        error=result.get("error"),
    )


@router.get("/debug/pinecone/{session_id}")
async def debug_pinecone_by_convex_session(
    session_id: str,
    pinecone_client: PineconeClientDep,
):
    """Debug endpoint to check Pinecone for a Convex session ID."""
    try:
        # Get index stats
        stats = await pinecone_client.get_stats(namespace="documents")
        
        # Query for vectors with this session_id
        # We need to do a dummy query to get vectors (Pinecone doesn't have a "get by filter" without vector)
        # Using a zero vector for now
        results = await pinecone_client.query(
            collection_name="documents",
            query_embeddings=[[0.0] * 768],  # Dummy vector
            n_results=10,
            where={"session_id": session_id},
        )
        
        return {
            "total_in_namespace": stats.get("total_vectors", 0),
            "session_documents_count": len(results.get("ids", [[]])[0]),
            "session_id": session_id,
            "documents": [
                {
                    "id": results["ids"][0][i],
                    "document_name": results["metadatas"][0][i].get("document_name") if results.get("metadatas") else None,
                    "page_number": results["metadatas"][0][i].get("page_number") if results.get("metadatas") else None,
                    "text_preview": (results["documents"][0][i][:100] + "...") if results.get("documents") and results["documents"][0] and len(results["documents"][0][i]) > 100 else (results["documents"][0][i] if results.get("documents") and results["documents"][0] else None),
                }
                for i in range(len(results.get("ids", [[]])[0]))
            ][:10]
        }
    except Exception as e:
        return {"error": str(e)}
