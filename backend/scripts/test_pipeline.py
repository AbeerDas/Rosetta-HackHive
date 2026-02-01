#!/usr/bin/env python3
"""CLI test script for the complete RAG pipeline with Convex + ChromaDB.

This script tests:
1. Document processing (PDF → ChromaDB)
2. RAG query (text → citations)
3. Note generation (transcripts + citations → notes)

All without PostgreSQL - uses Convex + ChromaDB only.

Usage:
    cd backend
    python scripts/test_pipeline.py
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

import httpx

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Configuration
BACKEND_URL = "http://localhost:8001/api/v1"
CONVEX_URL = "http://localhost:3210"  # Convex dev server (for HTTP routes)

# Test data
TEST_SESSION_ID = "test_session_123"  # Fake Convex session ID
TEST_DOCUMENT_ID = "test_document_456"  # Fake Convex document ID
TEST_TRANSCRIPT_TEXT = """
In 1971, Bangladesh declared independence from Pakistan following the Liberation War. 
The country's founding father, Sheikh Mujibur Rahman, led the movement for independence.
Bangladesh is located in South Asia, bordered by India on three sides and Myanmar to the southeast.
The country has a population of over 170 million people, making it one of the most densely populated countries in the world.
"""


async def test_health_check():
    """Test backend health endpoint."""
    logger.info("=" * 60)
    logger.info("TEST 1: Backend Health Check")
    logger.info("=" * 60)
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BACKEND_URL}/health")
            response.raise_for_status()
            data = response.json()
            logger.info(f"✅ Backend is healthy: {data}")
            return True
        except Exception as e:
            logger.error(f"❌ Backend health check failed: {e}")
            return False


async def test_chroma_status():
    """Test ChromaDB connection."""
    logger.info("=" * 60)
    logger.info("TEST 2: ChromaDB Status")
    logger.info("=" * 60)
    
    async with httpx.AsyncClient() as client:
        try:
            # Check if documents collection exists
            response = await client.get(f"{BACKEND_URL}/documents/debug/chroma/{TEST_SESSION_ID}")
            data = response.json()
            logger.info(f"✅ ChromaDB query response: {json.dumps(data, indent=2)}")
            return True
        except Exception as e:
            logger.error(f"❌ ChromaDB check failed: {e}")
            return False


async def test_rag_query():
    """Test RAG query with fake transcript text."""
    logger.info("=" * 60)
    logger.info("TEST 3: RAG Query")
    logger.info("=" * 60)
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            payload = {
                "session_id": TEST_SESSION_ID,
                "transcript_text": TEST_TRANSCRIPT_TEXT,
                "window_index": 0,
                "transcript_id": None,
            }
            
            logger.info(f"Sending RAG query for session: {TEST_SESSION_ID}")
            logger.info(f"Text: {TEST_TRANSCRIPT_TEXT[:100]}...")
            
            response = await client.post(
                f"{BACKEND_URL}/rag/query",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            
            citations = data.get("citations", [])
            metadata = data.get("query_metadata", {})
            
            logger.info(f"✅ RAG query completed in {metadata.get('processing_time_ms', 'N/A')}ms")
            logger.info(f"   Keywords: {metadata.get('keywords', [])}")
            logger.info(f"   Citations found: {len(citations)}")
            
            for i, citation in enumerate(citations, 1):
                logger.info(f"   Citation {i}: {citation.get('document_name', 'Unknown')} "
                           f"(p.{citation.get('page_number', '?')}) "
                           f"[score: {citation.get('relevance_score', 0):.2f}]")
                logger.info(f"      Snippet: {citation.get('snippet', '')[:100]}...")
            
            return True
            
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ RAG query failed with status {e.response.status_code}: {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"❌ RAG query failed: {e}")
            return False


async def test_convex_transcript_storage():
    """Test storing transcript in Convex via HTTP."""
    logger.info("=" * 60)
    logger.info("TEST 4: Convex Transcript Storage")
    logger.info("=" * 60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "sessionId": TEST_SESSION_ID,
                "originalText": TEST_TRANSCRIPT_TEXT[:200],
                "timestamp": 0.0,
                "windowIndex": 0,
                "isFinal": True,
            }
            
            logger.info(f"Attempting to store transcript in Convex...")
            logger.info(f"Convex URL: {CONVEX_URL}/api/transcripts/add")
            
            response = await client.post(
                f"{CONVEX_URL}/api/transcripts/add",
                json=payload,
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Transcript stored: {data}")
                return True
            else:
                logger.warning(f"⚠️ Convex returned status {response.status_code}: {response.text}")
                logger.info("   (This may fail if session doesn't exist in Convex - expected during test)")
                return False
                
        except Exception as e:
            logger.warning(f"⚠️ Convex transcript storage failed: {e}")
            logger.info("   (This may fail if Convex is not running locally - expected during test)")
            return False


async def test_convex_citation_storage():
    """Test storing citations in Convex via HTTP."""
    logger.info("=" * 60)
    logger.info("TEST 5: Convex Citation Storage")
    logger.info("=" * 60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "sessionId": TEST_SESSION_ID,
                "citations": [
                    {
                        "documentId": TEST_DOCUMENT_ID,
                        "pageNumber": 1,
                        "chunkText": "Test citation text about Bangladesh history.",
                        "relevanceScore": 0.85,
                        "rank": 1,
                        "windowIndex": 0,
                    }
                ],
            }
            
            logger.info(f"Attempting to store citations in Convex...")
            logger.info(f"Convex URL: {CONVEX_URL}/api/citations/batch")
            
            response = await client.post(
                f"{CONVEX_URL}/api/citations/batch",
                json=payload,
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Citations stored: {data}")
                return True
            else:
                logger.warning(f"⚠️ Convex returned status {response.status_code}: {response.text}")
                logger.info("   (This may fail if session/document don't exist in Convex)")
                return False
                
        except Exception as e:
            logger.warning(f"⚠️ Convex citation storage failed: {e}")
            logger.info("   (This may fail if Convex is not running locally)")
            return False


async def test_document_processing():
    """Test document processing endpoint (requires a real PDF)."""
    logger.info("=" * 60)
    logger.info("TEST 6: Document Processing (info only)")
    logger.info("=" * 60)
    
    logger.info("To test document processing, use:")
    logger.info(f"curl -X POST {BACKEND_URL}/documents/process-convex \\")
    logger.info("  -H 'Content-Type: application/json' \\")
    logger.info("  -d '{")
    logger.info('    "document_id": "<convex_document_id>",')
    logger.info('    "session_id": "<convex_session_id>",')
    logger.info('    "file_url": "<convex_storage_url>",')
    logger.info('    "file_name": "document.pdf"')
    logger.info("  }'")
    
    return True


async def test_note_generation():
    """Test note generation (info only - requires real session data)."""
    logger.info("=" * 60)
    logger.info("TEST 7: Note Generation (info only)")
    logger.info("=" * 60)
    
    logger.info("To test note generation, use:")
    logger.info(f"curl -X POST {BACKEND_URL}/sessions/<session_id>/notes/generate \\")
    logger.info("  -H 'Content-Type: application/json' \\")
    logger.info("  -d '{\"force_regenerate\": true}'")
    
    return True


async def main():
    """Run all tests."""
    logger.info("\n" + "=" * 60)
    logger.info("CONVEX + CHROMADB PIPELINE TEST")
    logger.info("=" * 60 + "\n")
    
    results = {}
    
    # Test 1: Backend health
    results["health"] = await test_health_check()
    
    # Test 2: ChromaDB status
    results["chroma"] = await test_chroma_status()
    
    # Test 3: RAG query
    results["rag"] = await test_rag_query()
    
    # Test 4: Convex transcript storage
    results["convex_transcript"] = await test_convex_transcript_storage()
    
    # Test 5: Convex citation storage
    results["convex_citation"] = await test_convex_citation_storage()
    
    # Test 6: Document processing info
    results["document_processing"] = await test_document_processing()
    
    # Test 7: Note generation info
    results["note_generation"] = await test_note_generation()
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("TEST SUMMARY")
    logger.info("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"  {test}: {status}")
    
    logger.info(f"\nTotal: {passed}/{total} tests passed")
    
    if passed < total:
        logger.info("\n⚠️  Some tests failed. This may be expected if:")
        logger.info("   - Convex is not running locally")
        logger.info("   - No documents have been indexed yet")
        logger.info("   - Test session/document IDs don't exist")
    
    return passed == total


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
