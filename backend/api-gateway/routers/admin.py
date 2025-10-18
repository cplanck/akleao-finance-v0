"""Admin API routes for viewing scraped data."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
import sys
sys.path.insert(0, "../shared")
from shared.models.reddit_post import RedditPost
from shared.models.stock import Stock
from shared.models.scraper_run import ScraperRun

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/reddit-posts")
async def get_reddit_posts(
    subreddit: Optional[str] = None,
    stock: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get Reddit posts with optional filters."""
    # Build query
    stmt = select(RedditPost)

    # Apply filters
    if subreddit:
        stmt = stmt.where(RedditPost.subreddit == subreddit)
    if stock:
        stmt = stmt.where(RedditPost.primary_stock == stock)

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()

    # Get paginated results
    stmt = stmt.order_by(desc(RedditPost.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    posts = result.scalars().all()

    return {
        "posts": [
            {
                "id": post.id,
                "subreddit": post.subreddit,
                "title": post.title,
                "author": post.author,
                "url": post.url,
                "score": post.score,
                "num_comments": post.num_comments,
                "mentioned_stocks": post.mentioned_stocks,
                "primary_stock": post.primary_stock,
                "created_at": post.created_at.isoformat(),
            }
            for post in posts
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/stocks")
async def get_stocks(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get stocks with mention counts."""
    # Get stocks with mention counts
    stmt = (
        select(
            Stock.symbol,
            Stock.name,
            Stock.sector,
            Stock.industry,
            func.count(RedditPost.id).label("mention_count"),
        )
        .outerjoin(RedditPost, Stock.symbol == RedditPost.primary_stock)
        .group_by(Stock.symbol, Stock.name, Stock.sector, Stock.industry)
        .order_by(desc("mention_count"))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    stocks_with_counts = result.all()

    # Get total stock count
    count_stmt = select(func.count(Stock.symbol))
    count_result = await db.execute(count_stmt)
    total = count_result.scalar()

    return {
        "stocks": [
            {
                "symbol": stock.symbol,
                "name": stock.name,
                "sector": stock.sector,
                "industry": stock.industry,
                "mention_count": stock.mention_count,
            }
            for stock in stocks_with_counts
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Get scraper statistics."""
    # Total posts
    count_stmt = select(func.count(RedditPost.id))
    result = await db.execute(count_stmt)
    total_posts = result.scalar()

    # Total stocks
    stock_count_stmt = select(func.count(Stock.symbol))
    stock_result = await db.execute(stock_count_stmt)
    total_stocks = stock_result.scalar()

    # Posts by subreddit
    subreddit_stmt = (
        select(RedditPost.subreddit, func.count(RedditPost.id).label("count"))
        .group_by(RedditPost.subreddit)
    )
    subreddit_result = await db.execute(subreddit_stmt)
    posts_by_subreddit = subreddit_result.all()

    # Top mentioned stocks
    top_stocks_stmt = (
        select(RedditPost.primary_stock, func.count(RedditPost.id).label("mentions"))
        .where(RedditPost.primary_stock.isnot(None))
        .group_by(RedditPost.primary_stock)
        .order_by(desc("mentions"))
        .limit(10)
    )
    top_stocks_result = await db.execute(top_stocks_stmt)
    top_stocks = top_stocks_result.all()

    # Recent activity (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_stmt = select(func.count(RedditPost.id)).where(
        RedditPost.created_at >= yesterday
    )
    recent_result = await db.execute(recent_stmt)
    recent_posts = recent_result.scalar()

    return {
        "total_posts": total_posts,
        "total_stocks": total_stocks,
        "recent_posts_24h": recent_posts,
        "posts_by_subreddit": [
            {"subreddit": row.subreddit, "count": row.count}
            for row in posts_by_subreddit
        ],
        "top_stocks": [
            {"symbol": row.primary_stock, "mentions": row.mentions} for row in top_stocks
        ],
    }


@router.get("/scraper-health")
async def get_scraper_health(db: AsyncSession = Depends(get_db)):
    """Get scraper health and status information."""
    # Get last run
    last_run_stmt = (
        select(ScraperRun)
        .where(ScraperRun.run_type == "reddit")
        .order_by(desc(ScraperRun.started_at))
        .limit(1)
    )
    last_run_result = await db.execute(last_run_stmt)
    last_run = last_run_result.scalar_one_or_none()

    # Get recent runs (last 10)
    recent_runs_stmt = (
        select(ScraperRun)
        .where(ScraperRun.run_type == "reddit")
        .order_by(desc(ScraperRun.started_at))
        .limit(10)
    )
    recent_runs_result = await db.execute(recent_runs_stmt)
    recent_runs = recent_runs_result.scalars().all()

    # Calculate average duration and success rate from recent runs
    completed_runs = [r for r in recent_runs if r.status == "completed"]
    avg_duration = (
        sum(r.duration_seconds for r in completed_runs) / len(completed_runs)
        if completed_runs
        else 0
    )
    success_rate = (
        len(completed_runs) / len(recent_runs) * 100 if recent_runs else 100
    )

    # Determine status
    if not last_run:
        status = "idle"
        status_message = "No runs recorded yet"
    elif last_run.status == "running":
        status = "running"
        status_message = "Scraper is currently running"
    elif last_run.status == "completed":
        status = "healthy"
        status_message = "Last run completed successfully"
    else:
        status = "error"
        status_message = last_run.error_message or "Last run failed"

    # Calculate next run time (based on 15 minute interval)
    if last_run and last_run.completed_at:
        next_run = last_run.completed_at + timedelta(minutes=15)
    elif last_run:
        next_run = last_run.started_at + timedelta(minutes=15)
    else:
        next_run = datetime.utcnow()

    return {
        "status": status,
        "status_message": status_message,
        "last_run": {
            "started_at": last_run.started_at.isoformat() if last_run else None,
            "completed_at": (
                last_run.completed_at.isoformat()
                if last_run and last_run.completed_at
                else None
            ),
            "duration_seconds": last_run.duration_seconds if last_run else None,
            "posts_collected": last_run.posts_collected if last_run else 0,
            "errors_count": last_run.errors_count if last_run else 0,
            "status": last_run.status if last_run else None,
        },
        "next_run": next_run.isoformat(),
        "stats": {
            "avg_duration_seconds": round(avg_duration, 2),
            "success_rate": round(success_rate, 1),
            "total_runs": len(recent_runs),
        },
        "recent_runs": [
            {
                "started_at": run.started_at.isoformat(),
                "status": run.status,
                "duration_seconds": run.duration_seconds,
                "posts_collected": run.posts_collected,
            }
            for run in recent_runs[:5]
        ],
    }
