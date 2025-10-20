"""Admin API routes for viewing scraped data."""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
import sys
import json
import ast
import os
sys.path.insert(0, "../shared")
from shared.models.reddit_post import RedditPost, RedditComment
from shared.models.post_analysis import PostAnalysis
from shared.models.stock import Stock
from shared.models.scraper_run import ScraperRun
from shared.models.tracked_subreddit import TrackedSubreddit
from shared.ai_analysis import (
    score_comment_quality,
    analyze_post_preprocessed,
    analyze_post_direct,
    get_openai_client,
    get_user_api_key,
    COMMENT_SCORING_MODEL,
    POST_ANALYSIS_MODEL,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def parse_mentioned_stocks(mentioned_stocks):
    """Parse mentioned_stocks field which may be JSON or Python list syntax."""
    if not mentioned_stocks or not mentioned_stocks.strip():
        return []
    try:
        # Try JSON first
        return json.loads(mentioned_stocks)
    except:
        try:
            # Try Python literal eval (handles single quotes)
            return ast.literal_eval(mentioned_stocks)
        except:
            # If all else fails, return empty list
            return []


@router.get("/reddit-posts")
async def get_reddit_posts(
    subreddit: Optional[str] = None,
    stock: Optional[str] = None,
    tracked_only: bool = False,
    limit: int = Query(50, le=10000),  # Allow fetching all posts
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get Reddit posts with optional filters."""
    from datetime import datetime as dt

    # Build query
    stmt = select(RedditPost)

    # Apply filters
    if subreddit:
        stmt = stmt.where(RedditPost.subreddit == subreddit)
    if stock:
        stmt = stmt.where(RedditPost.primary_stock == stock)
    if tracked_only:
        stmt = stmt.where(
            RedditPost.track_comments == True,
            RedditPost.track_until > dt.utcnow()
        )

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()

    # Get paginated results
    # Order by: tracked posts first (track_comments DESC), then by posted_at DESC (newest posts first)
    stmt = stmt.order_by(
        desc(RedditPost.track_comments),
        desc(RedditPost.posted_at)
    ).offset(offset).limit(limit)
    result = await db.execute(stmt)
    posts = result.scalars().all()

    return {
        "posts": [
            {
                "id": post.id,
                "subreddit": post.subreddit,
                "title": post.title,
                "content": post.content,
                "author": post.author,
                "url": post.url,
                "score": post.score,
                "num_comments": post.num_comments,
                "initial_num_comments": post.initial_num_comments,
                "mentioned_stocks": json.loads(post.mentioned_stocks) if post.mentioned_stocks else [],
                "primary_stock": post.primary_stock,
                "posted_at": post.posted_at.isoformat(),  # When posted on Reddit
                "created_at": post.created_at.isoformat(),  # When we first indexed it
                "track_comments": post.track_comments,
                "track_until": post.track_until.isoformat() if post.track_until else None,
                "last_comment_scrape_at": post.last_comment_scrape_at.isoformat() if post.last_comment_scrape_at else None,
                "comment_scrape_count": post.comment_scrape_count,
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

    # Total comments
    comment_count_stmt = select(func.count(RedditComment.id))
    comment_result = await db.execute(comment_count_stmt)
    total_comments = comment_result.scalar()

    # Total stocks
    stock_count_stmt = select(func.count(Stock.symbol))
    stock_result = await db.execute(stock_count_stmt)
    total_stocks = stock_result.scalar()

    # Tracked subreddits count (active only)
    tracked_subreddits_stmt = select(func.count(TrackedSubreddit.id)).where(
        TrackedSubreddit.is_active == True
    )
    tracked_subreddits_result = await db.execute(tracked_subreddits_stmt)
    tracked_subreddits_count = tracked_subreddits_result.scalar()

    # Tracked posts (currently being tracked for comments)
    now = datetime.utcnow()
    tracked_posts_stmt = select(func.count(RedditPost.id)).where(
        RedditPost.track_comments == True,
        RedditPost.track_until > now
    )
    tracked_posts_result = await db.execute(tracked_posts_stmt)
    tracked_posts = tracked_posts_result.scalar()

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
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)

    recent_posts_stmt = select(func.count(RedditPost.id)).where(
        RedditPost.created_at >= yesterday
    )
    recent_posts_result = await db.execute(recent_posts_stmt)
    recent_posts = recent_posts_result.scalar()

    # Recent comments (last 24 hours)
    recent_comments_stmt = select(func.count(RedditComment.id)).where(
        RedditComment.created_at >= yesterday
    )
    recent_comments_result = await db.execute(recent_comments_stmt)
    recent_comments = recent_comments_result.scalar()

    # Recent comments (last 1 hour)
    recent_comments_1h_stmt = select(func.count(RedditComment.id)).where(
        RedditComment.created_at >= one_hour_ago
    )
    recent_comments_1h_result = await db.execute(recent_comments_1h_stmt)
    recent_comments_1h = recent_comments_1h_result.scalar()

    # Comment growth (posts with new comments in last hour)
    comment_growth_stmt = select(func.count(RedditPost.id)).where(
        RedditPost.last_comment_scrape_at >= one_hour_ago,
        RedditPost.num_comments > RedditPost.initial_num_comments
    )
    comment_growth_result = await db.execute(comment_growth_stmt)
    posts_with_growth = comment_growth_result.scalar()

    # Total new comments added (sum of comment growth)
    growth_sum_stmt = select(
        func.sum(RedditPost.num_comments - RedditPost.initial_num_comments)
    ).where(
        RedditPost.num_comments > RedditPost.initial_num_comments
    )
    growth_sum_result = await db.execute(growth_sum_stmt)
    total_new_comments = growth_sum_result.scalar() or 0

    return {
        "total_posts": total_posts,
        "total_comments": total_comments,
        "total_stocks": total_stocks,
        "tracked_posts": tracked_posts,
        "tracked_subreddits_count": tracked_subreddits_count,
        "recent_posts_24h": recent_posts,
        "recent_comments_24h": recent_comments,
        "recent_comments_1h": recent_comments_1h,
        "posts_with_growth_1h": posts_with_growth,
        "total_new_comments": total_new_comments,
        "posts_by_subreddit": [
            {"subreddit": row.subreddit, "count": row.count}
            for row in posts_by_subreddit
        ],
        "top_stocks": [
            {"symbol": row.primary_stock, "mentions": row.mentions} for row in top_stocks
        ],
    }


@router.get("/comments")
async def get_comments(
    stock: Optional[str] = None,
    sentiment: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get Reddit comments with optional filters."""
    # Build query with join to get post info
    stmt = (
        select(
            RedditComment,
            RedditPost.title.label("post_title"),
            RedditPost.subreddit.label("subreddit"),
        )
        .join(RedditPost, RedditComment.post_id == RedditPost.id)
    )

    # Apply filters
    if stock:
        stmt = stmt.where(RedditComment.mentioned_stocks.contains(f'"{stock}"'))
    if sentiment:
        stmt = stmt.where(RedditComment.sentiment_label == sentiment)

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()

    # Get paginated results
    stmt = stmt.order_by(desc(RedditComment.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()

    return {
        "comments": [
            {
                "id": row.RedditComment.id,
                "post_id": row.RedditComment.post_id,
                "post_title": row.post_title,
                "subreddit": row.subreddit,
                "author": row.RedditComment.author,
                "content": row.RedditComment.content,
                "score": row.RedditComment.score,
                "mentioned_stocks": parse_mentioned_stocks(row.RedditComment.mentioned_stocks),
                "sentiment_label": row.RedditComment.sentiment_label,
                "sentiment_score": row.RedditComment.sentiment_score,
                "created_at": row.RedditComment.created_at.isoformat(),
            }
            for row in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/reddit-posts/{post_id}/comments")
async def get_post_comments(
    post_id: str,
    threaded: bool = Query(True, description="Return comments in threaded tree structure"),
    db: AsyncSession = Depends(get_db),
):
    """Get comments for a specific Reddit post, optionally in threaded format."""
    try:
        stmt = (
            select(RedditComment)
            .where(RedditComment.post_id == post_id)
            .order_by(desc(RedditComment.score))
        )
        result = await db.execute(stmt)
        comments = result.scalars().all()

        # Build comment dictionaries
        comment_dicts = [
            {
                "id": comment.id,
                "post_id": comment.post_id,
                "author": comment.author,
                "content": comment.content,
                "score": comment.score,
                "mentioned_stocks": parse_mentioned_stocks(comment.mentioned_stocks),
                "sentiment_label": comment.sentiment_label,
                "sentiment_score": comment.sentiment_score,
                "created_at": comment.created_at.isoformat() if comment.created_at else None,
                "parent_id": comment.parent_id,
                "depth": comment.depth or 0,
                "replies": []  # Will be populated for threaded view
            }
            for comment in comments
        ]

        if not threaded:
            # Return flat list sorted by score
            return comment_dicts

        # Build threaded tree structure
        comment_map = {c["id"]: c for c in comment_dicts}
        root_comments = []

        for comment in comment_dicts:
            parent_id = comment["parent_id"]
            if parent_id and parent_id in comment_map:
                # This is a reply - add to parent's replies
                comment_map[parent_id]["replies"].append(comment)
            else:
                # This is a top-level comment
                root_comments.append(comment)

        # Sort top-level comments by score (descending)
        root_comments.sort(key=lambda c: c["score"], reverse=True)

        # Recursively sort replies by score
        def sort_replies(comment):
            if comment["replies"]:
                comment["replies"].sort(key=lambda c: c["score"], reverse=True)
                for reply in comment["replies"]:
                    sort_replies(reply)

        for comment in root_comments:
            sort_replies(comment)

        return root_comments

    except Exception as e:
        import traceback
        print(f"ERROR in get_post_comments: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scraper-health")
async def get_scraper_health(db: AsyncSession = Depends(get_db)):
    """Get scraper health and status information."""
    # Import redis here
    import redis as redis_lib
    import json as json_lib

    # Get current post being analyzed from Redis
    try:
        redis_client = redis_lib.from_url(os.getenv("REDIS_URL", "redis://redis:6379"), decode_responses=True)
        current_post_data = redis_client.get("comment_scraper:current_post")
        current_post = json_lib.loads(current_post_data) if current_post_data else None
    except Exception as e:
        print(f"Redis error: {e}")
        current_post = None

    # Get last run - prioritize running, then pending, then most recent
    # First check for running
    running_stmt = (
        select(ScraperRun)
        .where(ScraperRun.run_type == "reddit")
        .where(ScraperRun.status == "running")
        .order_by(desc(ScraperRun.started_at))
        .limit(1)
    )
    running_result = await db.execute(running_stmt)
    last_run = running_result.scalar_one_or_none()

    # If no running, check for pending
    if not last_run:
        pending_stmt = (
            select(ScraperRun)
            .where(ScraperRun.run_type == "reddit")
            .where(ScraperRun.status == "pending")
            .order_by(desc(ScraperRun.started_at))
            .limit(1)
        )
        pending_result = await db.execute(pending_stmt)
        last_run = pending_result.scalar_one_or_none()

    # If no running or pending, get the most recent one
    if not last_run:
        last_run_stmt = (
            select(ScraperRun)
            .where(ScraperRun.run_type == "reddit")
            .order_by(desc(ScraperRun.started_at))
            .limit(1)
        )
        last_run_result = await db.execute(last_run_stmt)
        last_run = last_run_result.scalar_one_or_none()

    # Get all running jobs (not just reddit)
    running_jobs_stmt = (
        select(ScraperRun)
        .where(ScraperRun.status == "running")
        .order_by(desc(ScraperRun.started_at))
    )
    running_jobs_result = await db.execute(running_jobs_stmt)
    running_jobs = running_jobs_result.scalars().all()

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
    elif last_run.status == "pending":
        status = "pending"
        status_message = "Manual scrape queued, waiting to start"
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
            "comments_collected": last_run.comments_collected if last_run else 0,
            "errors_count": last_run.errors_count if last_run else 0,
            "status": last_run.status if last_run else None,
        },
        "next_run": next_run.isoformat(),
        "running_jobs": [
            {
                "id": job.id,
                "run_type": job.run_type,
                "started_at": job.started_at.isoformat(),
                "posts_collected": job.posts_collected,
                "comments_collected": job.comments_collected,
            }
            for job in running_jobs
        ],
        "current_post": current_post,  # Currently analyzing post (from comment scraper)
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
                "comments_collected": run.comments_collected,
            }
            for run in recent_runs[:5]
        ],
    }


@router.post("/trigger-scrape")
async def trigger_scrape(db: AsyncSession = Depends(get_db)):
    """Manually trigger a Reddit scrape by creating a pending run."""
    # Check if a scraper run is already in progress or pending
    last_run_stmt = (
        select(ScraperRun)
        .where(ScraperRun.run_type == "reddit")
        .where(ScraperRun.status.in_(["running", "pending"]))
        .order_by(desc(ScraperRun.started_at))
        .limit(1)
    )
    last_run_result = await db.execute(last_run_stmt)
    last_run = last_run_result.scalar_one_or_none()

    if last_run:
        raise HTTPException(
            status_code=409,
            detail=f"Scraper is already {last_run.status}. Please wait for it to complete."
        )

    # Create a pending scraper run that the worker will pick up
    manual_run = ScraperRun(
        run_type="reddit",
        status="pending",
        started_at=datetime.utcnow(),
        posts_collected=0,
        errors_count=0,
    )
    db.add(manual_run)
    await db.commit()

    return {
        "message": "Scraper trigger queued successfully. The scraper will run shortly.",
        "status": "pending",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/reddit-posts/{post_id}/analyze")
async def analyze_post(
    post_id: str,
    strategy: str = Query("direct", regex="^(preprocessed|direct)$"),
    user_id: str = Query(..., description="User ID for API key lookup"),
    max_comments: int = Query(100, ge=10, le=500),
    min_score: int = Query(1, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate AI analysis for a Reddit post using specified strategy.

    Strategies:
    - preprocessed: Score each comment with GPT-4o-mini first, then analyze with GPT-4o
    - direct: Send raw comments directly to GPT-4o

    This endpoint is designed for on-demand generation via button click.
    """
    import time as time_module
    from sqlalchemy import and_

    # Fetch the post
    post_stmt = select(RedditPost).where(RedditPost.id == post_id)
    post_result = await db.execute(post_stmt)
    post = post_result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail=f"Post {post_id} not found")

    # Fetch comments, sorted by score, with minimum score filter
    comments_stmt = (
        select(RedditComment)
        .where(
            and_(
                RedditComment.post_id == post_id,
                RedditComment.score >= min_score
            )
        )
        .order_by(desc(RedditComment.score))
        .limit(max_comments)
    )
    comments_result = await db.execute(comments_stmt)
    comments = comments_result.scalars().all()

    if not comments:
        raise HTTPException(
            status_code=400,
            detail=f"No comments found for post {post_id} with score >= {min_score}"
        )

    # Get user's OpenAI API key
    try:
        user_api_key = await get_user_api_key(db, user_id)
        client = get_openai_client(user_api_key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve API key: {str(e)}")

    start_time = time_module.time()
    total_cost = 0.0
    total_tokens = 0
    comments_preprocessed_count = 0

    try:
        if strategy == "preprocessed":
            # Strategy A: Preprocess each comment with GPT-4o-mini
            scored_comments = []

            for comment in comments:
                # Skip if already processed (future optimization)
                score_result = score_comment_quality(comment, post, client)

                # Update comment in database with quality metrics
                comment_stmt = (
                    select(RedditComment)
                    .where(RedditComment.id == comment.id)
                )
                db_comment_result = await db.execute(comment_stmt)
                db_comment = db_comment_result.scalar_one()

                db_comment.quality_score = score_result["quality_score"]
                db_comment.insight_type = score_result["insight_type"]
                db_comment.ai_summary = score_result["ai_summary"]
                db_comment.is_ai_processed = True

                scored_comments.append({
                    "comment": comment,
                    "quality_score": score_result["quality_score"],
                    "insight_type": score_result["insight_type"],
                    "ai_summary": score_result["ai_summary"]
                })

                total_cost += score_result["cost_estimate"]
                total_tokens += score_result["tokens_used"]
                comments_preprocessed_count += 1

            await db.commit()

            # Sort by quality score (highest first) and take top comments
            scored_comments.sort(key=lambda x: x["quality_score"], reverse=True)
            top_comments = scored_comments[:max_comments]

            # Generate analysis with preprocessed comments
            analysis_result = analyze_post_preprocessed(post, top_comments, client)

        else:  # strategy == "direct"
            # Strategy B: Send raw comments to GPT-4o
            analysis_result = analyze_post_direct(post, comments, client)

        # Add to total cost/tokens
        total_cost += analysis_result["cost_estimate"]
        total_tokens += analysis_result["tokens_used"]

        # Calculate processing time
        processing_time = time_module.time() - start_time

        # Store analysis in database
        analysis = PostAnalysis(
            post_id=post_id,
            stock_symbol=analysis_result.get("stock_symbol"),
            strategy_used=strategy,
            comments_included=len(comments),
            comments_preprocessed=comments_preprocessed_count if strategy == "preprocessed" else None,
            executive_summary=analysis_result["executive_summary"],
            sentiment_breakdown=analysis_result["sentiment_breakdown"],
            key_arguments=analysis_result["key_arguments"],
            thread_quality_score=analysis_result["thread_quality_score"],
            notable_quotes=analysis_result["notable_quotes"],
            model_used=f"{COMMENT_SCORING_MODEL}+{POST_ANALYSIS_MODEL}" if strategy == "preprocessed" else POST_ANALYSIS_MODEL,
            tokens_used=total_tokens,
            processing_time_seconds=processing_time,
            cost_estimate=total_cost
        )

        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)

        return {
            "id": analysis.id,
            "post_id": post_id,
            "stock_symbol": analysis.stock_symbol,
            "strategy_used": strategy,
            "comments_included": len(comments),
            "comments_preprocessed": comments_preprocessed_count if strategy == "preprocessed" else None,
            "executive_summary": analysis.executive_summary,
            "sentiment_breakdown": analysis.sentiment_breakdown,
            "key_arguments": analysis.key_arguments,
            "thread_quality_score": analysis.thread_quality_score,
            "notable_quotes": analysis.notable_quotes,
            "model_used": analysis.model_used,
            "tokens_used": total_tokens,
            "processing_time_seconds": round(processing_time, 2),
            "cost_estimate": round(total_cost, 4),
            "created_at": analysis.created_at.isoformat()
        }

    except Exception as e:
        import traceback
        print(f"ERROR in analyze_post: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reddit-posts/{post_id}/analyses")
async def get_post_analyses(
    post_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all AI analyses for a specific Reddit post."""
    # Verify post exists
    post_stmt = select(RedditPost).where(RedditPost.id == post_id)
    post_result = await db.execute(post_stmt)
    post = post_result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail=f"Post {post_id} not found")

    # Fetch all analyses for this post, sorted by created_at descending
    analyses_stmt = (
        select(PostAnalysis)
        .where(PostAnalysis.post_id == post_id)
        .order_by(desc(PostAnalysis.created_at))
    )
    analyses_result = await db.execute(analyses_stmt)
    analyses = analyses_result.scalars().all()

    return {
        "post_id": post_id,
        "analyses": [
            {
                "id": analysis.id,
                "stock_symbol": analysis.stock_symbol,
                "strategy_used": analysis.strategy_used,
                "comments_included": analysis.comments_included,
                "comments_preprocessed": analysis.comments_preprocessed,
                "executive_summary": analysis.executive_summary,
                "sentiment_breakdown": analysis.sentiment_breakdown,
                "key_arguments": analysis.key_arguments,
                "thread_quality_score": analysis.thread_quality_score,
                "notable_quotes": analysis.notable_quotes,
                "model_used": analysis.model_used,
                "tokens_used": analysis.tokens_used,
                "processing_time_seconds": analysis.processing_time_seconds,
                "cost_estimate": analysis.cost_estimate,
                "created_at": analysis.created_at.isoformat()
            }
            for analysis in analyses
        ]
    }


@router.get("/analyses")
async def get_all_analyses(
    stock: Optional[str] = None,
    strategy: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get all AI analyses with optional filters."""
    # Build query
    stmt = (
        select(PostAnalysis, RedditPost)
        .join(RedditPost, PostAnalysis.post_id == RedditPost.id)
    )

    # Apply filters
    if stock:
        stmt = stmt.where(PostAnalysis.stock_symbol == stock.upper())
    if strategy:
        stmt = stmt.where(PostAnalysis.strategy_used == strategy)

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()

    # Get paginated results, ordered by created_at descending
    stmt = stmt.order_by(desc(PostAnalysis.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()

    return {
        "analyses": [
            {
                "id": row.PostAnalysis.id,
                "post_id": row.PostAnalysis.post_id,
                "post_title": row.RedditPost.title,
                "subreddit": row.RedditPost.subreddit,
                "stock_symbol": row.PostAnalysis.stock_symbol,
                "strategy_used": row.PostAnalysis.strategy_used,
                "comments_included": row.PostAnalysis.comments_included,
                "comments_preprocessed": row.PostAnalysis.comments_preprocessed,
                "executive_summary": row.PostAnalysis.executive_summary,
                "sentiment_breakdown": row.PostAnalysis.sentiment_breakdown,
                "key_arguments": row.PostAnalysis.key_arguments,
                "thread_quality_score": row.PostAnalysis.thread_quality_score,
                "notable_quotes": row.PostAnalysis.notable_quotes,
                "model_used": row.PostAnalysis.model_used,
                "tokens_used": row.PostAnalysis.tokens_used,
                "processing_time_seconds": row.PostAnalysis.processing_time_seconds,
                "cost_estimate": row.PostAnalysis.cost_estimate,
                "created_at": row.PostAnalysis.created_at.isoformat()
            }
            for row in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/analyses/aggregate")
async def get_aggregated_analysis(
    stock: str = Query(..., description="Stock symbol to aggregate analyses for"),
    use_ai_synthesis: bool = Query(False, description="Use AI to synthesize insights (costs ~$0.01-0.03)"),
    user_id: Optional[str] = Query(None, description="User ID for API key lookup (required if use_ai_synthesis=True)"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of analyses to aggregate"),
    db: AsyncSession = Depends(get_db),
):
    """
    Aggregate multiple AI analyses for a stock into a single consolidated view.

    Returns weighted sentiment, confidence score, key themes, and overall take.
    Optionally uses AI synthesis for deeper insights.
    """
    from shared.ai_analysis import aggregate_analyses, get_user_api_key, get_openai_client

    # Fetch analyses for the stock
    stmt = (
        select(PostAnalysis, RedditPost)
        .join(RedditPost, PostAnalysis.post_id == RedditPost.id)
        .where(PostAnalysis.stock_symbol == stock.upper())
        .order_by(desc(PostAnalysis.created_at))
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No analyses found for stock {stock.upper()}"
        )

    # Convert to dict format for aggregate function
    analyses = [
        {
            "id": row.PostAnalysis.id,
            "post_id": row.PostAnalysis.post_id,
            "post_title": row.RedditPost.title,
            "subreddit": row.RedditPost.subreddit,
            "stock_symbol": row.PostAnalysis.stock_symbol,
            "strategy_used": row.PostAnalysis.strategy_used,
            "comments_included": row.PostAnalysis.comments_included,
            "executive_summary": row.PostAnalysis.executive_summary,
            "sentiment_breakdown": row.PostAnalysis.sentiment_breakdown,
            "key_arguments": row.PostAnalysis.key_arguments,
            "thread_quality_score": row.PostAnalysis.thread_quality_score,
            "notable_quotes": row.PostAnalysis.notable_quotes,
            "created_at": row.PostAnalysis.created_at.isoformat()
        }
        for row in rows
    ]

    # Get OpenAI client if AI synthesis requested
    client = None
    if use_ai_synthesis:
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="user_id is required when use_ai_synthesis=True"
            )
        try:
            user_api_key = await get_user_api_key(db, user_id)
            client = get_openai_client(user_api_key)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    # Aggregate analyses
    try:
        aggregated = aggregate_analyses(
            analyses,
            use_ai_synthesis=use_ai_synthesis,
            client=client
        )
        return aggregated
    except Exception as e:
        import traceback
        print(f"ERROR in aggregate_analyses: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
