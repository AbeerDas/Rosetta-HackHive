"""Folder management API routes.

NOTE: Folder CRUD operations are handled by Convex.
This file is kept for potential future ML-related folder operations.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_folders_info():
    """Info endpoint - folder management is handled by Convex."""
    return {
        "message": "Folder management is handled by Convex.",
        "hint": "Use Convex queries for folder CRUD operations.",
    }
