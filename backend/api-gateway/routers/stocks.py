"""Stocks API router."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/{symbol}")
async def get_stock(symbol: str):
    """Get stock information with sentiment and metrics."""
    return {
        "symbol": symbol,
        "message": "Stock endpoint - to be implemented"
    }


@router.get("/{symbol}/sentiment")
async def get_stock_sentiment(symbol: str):
    """Get aggregated sentiment data for a stock."""
    return {
        "symbol": symbol,
        "message": "Sentiment endpoint - to be implemented"
    }
