from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()


@router.get("/health", summary="Health check")
async def health_check():
    """Health check endpoint used by AWS App Runner and load balancers."""
    return {
        "status": "ok",
        "service": "CareerPilot AI",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
