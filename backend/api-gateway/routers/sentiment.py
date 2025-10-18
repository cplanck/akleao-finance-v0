"""Sentiment analysis API router."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/{symbol}")
async def get_sentiment_analysis(symbol: str):
    """Get detailed sentiment analysis for a stock."""
    return {
        "symbol": symbol,
        "message": "Sentiment analysis endpoint - to be implemented"
    }
