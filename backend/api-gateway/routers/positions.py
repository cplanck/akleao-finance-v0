"""API router for managing positions and simulations."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
import sys
import httpx

sys.path.insert(0, "../../shared")
from shared.models.position import Position
from database import get_db

router = APIRouter(prefix="/api/positions", tags=["positions"])


# Pydantic models for API
class PositionCreate(BaseModel):
    stock_symbol: str
    shares: float
    entry_price: float
    entry_date: datetime
    notes: Optional[str] = None


class PositionUpdate(BaseModel):
    exit_date: Optional[datetime] = None
    exit_price: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class PositionResponse(BaseModel):
    id: int
    user_id: str
    stock_symbol: str
    shares: float
    entry_price: float
    entry_date: datetime
    exit_date: Optional[datetime]
    exit_price: Optional[float]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PerformanceData(BaseModel):
    date: str
    stock_value: float
    spy_value: float
    stock_return_pct: float
    spy_return_pct: float
    alpha: float  # Outperformance vs SPY


@router.post("/", response_model=PositionResponse)
async def create_position(
    position_data: PositionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new position."""
    # For now, use a hardcoded user_id (later integrate with auth)
    user_id = "test_user"

    position = Position(
        user_id=user_id,
        stock_symbol=position_data.stock_symbol.upper(),
        shares=position_data.shares,
        entry_price=position_data.entry_price,
        entry_date=position_data.entry_date,
        notes=position_data.notes,
        is_active=True
    )

    db.add(position)
    await db.commit()
    await db.refresh(position)

    return position


@router.get("/", response_model=List[PositionResponse])
async def get_positions(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Get all positions for the current user."""
    user_id = "test_user"

    query = select(Position).where(Position.user_id == user_id)

    if active_only:
        query = query.where(Position.is_active == True)

    query = query.order_by(Position.created_at.desc())

    result = await db.execute(query)
    positions = result.scalars().all()

    return positions


@router.get("/{position_id}", response_model=PositionResponse)
async def get_position(
    position_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific position."""
    user_id = "test_user"

    result = await db.execute(
        select(Position).where(
            Position.id == position_id,
            Position.user_id == user_id
        )
    )
    position = result.scalar_one_or_none()

    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    return position


@router.patch("/{position_id}", response_model=PositionResponse)
async def update_position(
    position_id: int,
    update_data: PositionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a position (e.g., close it)."""
    user_id = "test_user"

    result = await db.execute(
        select(Position).where(
            Position.id == position_id,
            Position.user_id == user_id
        )
    )
    position = result.scalar_one_or_none()

    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    # Update fields
    if update_data.exit_date is not None:
        position.exit_date = update_data.exit_date
    if update_data.exit_price is not None:
        position.exit_price = update_data.exit_price
    if update_data.is_active is not None:
        position.is_active = update_data.is_active
    if update_data.notes is not None:
        position.notes = update_data.notes

    await db.commit()
    await db.refresh(position)

    return position


@router.delete("/{position_id}")
async def delete_position(
    position_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a position."""
    user_id = "test_user"

    result = await db.execute(
        select(Position).where(
            Position.id == position_id,
            Position.user_id == user_id
        )
    )
    position = result.scalar_one_or_none()

    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    await db.delete(position)
    await db.commit()

    return {"status": "success", "message": "Position deleted"}


@router.get("/{position_id}/performance", response_model=List[PerformanceData])
async def get_position_performance(
    position_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Calculate position performance vs SPY benchmark using frontend API."""
    user_id = "test_user"

    # Get the position
    result = await db.execute(
        select(Position).where(
            Position.id == position_id,
            Position.user_id == user_id
        )
    )
    position = result.scalar_one_or_none()

    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    # For now, return mock data since we'll fetch real data from the frontend
    # The frontend will call the /api/stock/chart endpoint directly
    return get_mock_performance_data(position)


def calculate_performance_metrics(position: Position, stock_data: dict, spy_data: dict) -> List[PerformanceData]:
    """Calculate daily performance metrics comparing stock to SPY."""
    stock_time_series = stock_data.get("Time Series (Daily)", {})
    spy_time_series = spy_data.get("Time Series (Daily)", {})

    performance = []

    # Get entry date price for SPY
    entry_date_str = position.entry_date.strftime("%Y-%m-%d")
    spy_entry_price = None

    # Find closest SPY price to entry date
    for date_str in spy_time_series.keys():
        if date_str <= entry_date_str:
            spy_entry_price = float(spy_time_series[date_str]["4. close"])
            break

    if not spy_entry_price:
        return []

    # Calculate metrics for each day
    for date_str, stock_prices in stock_time_series.items():
        if date_str < entry_date_str:
            continue

        # For closed positions, stop at exit date
        if not position.is_active and position.exit_date:
            exit_date_str = position.exit_date.strftime("%Y-%m-%d")
            if date_str > exit_date_str:
                continue

        if date_str not in spy_time_series:
            continue

        stock_close = float(stock_prices["4. close"])
        spy_close = float(spy_time_series[date_str]["4. close"])

        stock_value = position.shares * stock_close
        spy_shares = (position.shares * position.entry_price) / spy_entry_price
        spy_value = spy_shares * spy_close

        stock_return_pct = ((stock_close - position.entry_price) / position.entry_price) * 100
        spy_return_pct = ((spy_close - spy_entry_price) / spy_entry_price) * 100
        alpha = stock_return_pct - spy_return_pct

        performance.append(PerformanceData(
            date=date_str,
            stock_value=stock_value,
            spy_value=spy_value,
            stock_return_pct=stock_return_pct,
            spy_return_pct=spy_return_pct,
            alpha=alpha
        ))

    return sorted(performance, key=lambda x: x.date)


def get_mock_performance_data(position: Position) -> List[PerformanceData]:
    """Generate mock performance data for demo purposes."""
    from datetime import timedelta

    performance = []
    current_date = position.entry_date
    end_date = position.exit_date if position.exit_date else datetime.now()

    days = (end_date - current_date).days
    if days > 365:
        days = 365  # Limit to 1 year for demo

    initial_value = position.shares * position.entry_price

    for i in range(0, days + 1, 7):  # Weekly data points
        date = current_date + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")

        # Mock returns (stock slightly outperforms SPY)
        stock_return = (i / days) * 15  # 15% total return
        spy_return = (i / days) * 10    # 10% total return

        stock_value = initial_value * (1 + stock_return / 100)
        spy_value = initial_value * (1 + spy_return / 100)

        performance.append(PerformanceData(
            date=date_str,
            stock_value=stock_value,
            spy_value=spy_value,
            stock_return_pct=stock_return,
            spy_return_pct=spy_return,
            alpha=stock_return - spy_return
        ))

    return performance
