"""Pinned stocks API router."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from typing import List

from database import get_db
from auth import get_current_user
import sys
sys.path.insert(0, "../../shared")
from shared.models.user import User

router = APIRouter()


class PinnedStock(BaseModel):
    """Pinned stock response model."""
    symbol: str
    position: int
    pinned_at: str


class PinStockRequest(BaseModel):
    """Request to pin a stock."""
    symbol: str


class PinnedStocksResponse(BaseModel):
    """Response with pinned stocks."""
    pinnedStocks: List[PinnedStock]


@router.get("/pinned-stocks", response_model=PinnedStocksResponse)
async def get_pinned_stocks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's pinned stocks."""
    query = text("""
        SELECT symbol, position, pinned_at
        FROM pinned_stocks
        WHERE user_id = :user_id
        ORDER BY position ASC
    """)

    result = await db.execute(query, {"user_id": current_user.id})
    rows = result.fetchall()

    pinned_stocks = [
        PinnedStock(
            symbol=row.symbol,
            position=row.position,
            pinned_at=row.pinned_at.isoformat()
        )
        for row in rows
    ]

    return PinnedStocksResponse(pinnedStocks=pinned_stocks)


@router.post("/pinned-stocks")
async def pin_stock(
    request: PinStockRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pin a stock."""
    symbol = request.symbol.upper()

    # Get the current max position
    max_position_query = text("""
        SELECT COALESCE(MAX(position), -1) as max_position
        FROM pinned_stocks
        WHERE user_id = :user_id
    """)

    result = await db.execute(max_position_query, {"user_id": current_user.id})
    max_position = result.scalar()
    next_position = (max_position if max_position is not None else -1) + 1

    # Insert the pinned stock
    insert_query = text("""
        INSERT INTO pinned_stocks (user_id, symbol, position)
        VALUES (:user_id, :symbol, :position)
        ON CONFLICT (user_id, symbol) DO NOTHING
    """)

    await db.execute(
        insert_query,
        {"user_id": current_user.id, "symbol": symbol, "position": next_position}
    )
    await db.commit()

    return {"success": True, "symbol": symbol}


@router.delete("/pinned-stocks")
async def unpin_stock(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unpin a stock."""
    symbol = symbol.upper()

    # Delete the pinned stock
    delete_query = text("""
        DELETE FROM pinned_stocks
        WHERE user_id = :user_id AND symbol = :symbol
    """)

    await db.execute(delete_query, {"user_id": current_user.id, "symbol": symbol})

    # Reorder remaining pins
    reorder_query = text("""
        UPDATE pinned_stocks
        SET position = subquery.new_position
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 as new_position
            FROM pinned_stocks
            WHERE user_id = :user_id
        ) AS subquery
        WHERE pinned_stocks.id = subquery.id
    """)

    await db.execute(reorder_query, {"user_id": current_user.id})
    await db.commit()

    return {"success": True}
