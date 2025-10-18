"""Insights API router - powers the 'For You' page."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime

from database import get_db
import sys
sys.path.insert(0, "../../shared")
from shared.models.insight import UserInsight

router = APIRouter()


@router.get("/for-you/{user_id}")
async def get_user_insights(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    priority_min: int = Query(1, ge=1, le=10),
    include_read: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Get personalized insights for a user's 'For You' page.

    Args:
        user_id: User identifier
        limit: Maximum number of insights to return
        priority_min: Minimum priority level (1-10)
        include_read: Whether to include already-read insights
        db: Database session

    Returns:
        List of personalized insights
    """
    query = select(UserInsight).where(
        UserInsight.user_id == user_id,
        UserInsight.is_dismissed == False,  # noqa: E712
        UserInsight.is_expired == False,  # noqa: E712
        UserInsight.priority >= priority_min
    )

    if not include_read:
        query = query.where(UserInsight.is_read == False)  # noqa: E712

    query = query.order_by(
        UserInsight.priority.desc(),
        UserInsight.created_at.desc()
    ).limit(limit)

    result = await db.execute(query)
    insights = result.scalars().all()

    return [
        {
            "id": insight.id,
            "type": insight.insight_type,
            "category": insight.category,
            "stock_symbol": insight.stock_symbol,
            "title": insight.title,
            "summary": insight.summary,
            "priority": insight.priority,
            "urgency_level": insight.urgency_level,
            "relevance_score": insight.relevance_score,
            "created_at": insight.created_at.isoformat(),
            "expires_at": insight.expires_at.isoformat() if insight.expires_at else None
        }
        for insight in insights
    ]


@router.get("/{insight_id}")
async def get_insight_detail(
    insight_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed information about a specific insight."""
    result = await db.execute(
        select(UserInsight).where(UserInsight.id == insight_id)
    )
    insight = result.scalar_one_or_none()

    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    return {
        "id": insight.id,
        "type": insight.insight_type,
        "category": insight.category,
        "stock_symbol": insight.stock_symbol,
        "title": insight.title,
        "summary": insight.summary,
        "detailed_content": insight.detailed_content,
        "action_items": insight.action_items,
        "priority": insight.priority,
        "urgency_level": insight.urgency_level,
        "relevance_score": insight.relevance_score,
        "confidence_score": insight.confidence_score,
        "based_on_sources": insight.based_on_sources,
        "created_at": insight.created_at.isoformat(),
        "expires_at": insight.expires_at.isoformat() if insight.expires_at else None
    }


@router.post("/{insight_id}/mark-read")
async def mark_insight_read(
    insight_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Mark an insight as read."""
    result = await db.execute(
        select(UserInsight).where(UserInsight.id == insight_id)
    )
    insight = result.scalar_one_or_none()

    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    insight.is_read = True
    insight.read_at = datetime.utcnow()
    await db.commit()

    return {"status": "success", "message": "Insight marked as read"}


@router.post("/{insight_id}/dismiss")
async def dismiss_insight(
    insight_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Dismiss an insight."""
    result = await db.execute(
        select(UserInsight).where(UserInsight.id == insight_id)
    )
    insight = result.scalar_one_or_none()

    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    insight.is_dismissed = True
    await db.commit()

    return {"status": "success", "message": "Insight dismissed"}


@router.post("/{insight_id}/bookmark")
async def bookmark_insight(
    insight_id: int,
    bookmarked: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Bookmark or unbookmark an insight."""
    result = await db.execute(
        select(UserInsight).where(UserInsight.id == insight_id)
    )
    insight = result.scalar_one_or_none()

    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    insight.is_bookmarked = bookmarked
    await db.commit()

    return {
        "status": "success",
        "message": f"Insight {'bookmarked' if bookmarked else 'unbookmarked'}"
    }
