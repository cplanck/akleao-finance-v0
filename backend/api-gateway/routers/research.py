"""Research reports API router."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/{symbol}")
async def get_research_reports(symbol: str):
    """Get research reports for a stock."""
    return {
        "symbol": symbol,
        "message": "Research reports endpoint - to be implemented"
    }
