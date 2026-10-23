"""Health check endpoint."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict:
    """Return a simple success response to confirm the API is running."""
    return {
        "success": True,
        "message": "API is healthy",
        "data": {"status": "ok"},
    }