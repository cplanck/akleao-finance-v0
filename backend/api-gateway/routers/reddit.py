"""Reddit subreddit discovery and management endpoints."""

import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime
import sys
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import praw

from database import get_db  # Local database module

sys.path.insert(0, "../shared")
from shared.models.tracked_subreddit import TrackedSubreddit, StockSubredditMapping
from shared.models.stock import Stock
from shared.models.scraper_run import ScraperRun
from shared.models.scraper_job import ScraperJob
from shared.models.auth import UserApiKey
from shared.models.reddit_post import RedditPost
from shared.services.subreddit_discovery import SubredditDiscoveryService

router = APIRouter(prefix="/api/reddit", tags=["reddit"])

# Get encryption key from environment
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")


def decrypt_api_key(encrypted_text: str) -> str:
    """Decrypt the user's API key using AES-256-CBC.

    Format from frontend: "iv_hex:encrypted_data_hex"
    """
    if not ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY not set in environment")

    # Parse the encrypted format: "iv_hex:encrypted_data_hex"
    parts = encrypted_text.split(":")
    if len(parts) != 2:
        raise ValueError("Invalid encrypted key format")

    # Decode from hex (frontend uses hex encoding, not base64)
    iv = bytes.fromhex(parts[0])
    encrypted_data = bytes.fromhex(parts[1])

    # Decrypt using first 32 bytes of ENCRYPTION_KEY as the key
    key = bytes.fromhex(ENCRYPTION_KEY[:64])  # First 64 hex chars = 32 bytes
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted = unpad(cipher.decrypt(encrypted_data), AES.block_size)

    return decrypted.decode("utf-8")


async def get_user_api_key(db: AsyncSession, user_id: str) -> str:
    """Fetch and decrypt the user's OpenAI API key from the database."""
    result = await db.execute(
        select(UserApiKey).where(UserApiKey.user_id == user_id)
    )
    user_key = result.scalar_one_or_none()

    if not user_key:
        raise ValueError(f"No API key found for user {user_id}. Please add your OpenAI API key in settings.")

    return decrypt_api_key(user_key.encrypted_key)


# Pydantic models
class SubredditDiscoveryRequest(BaseModel):
    stock_symbol: str
    stock_name: Optional[str] = None
    user_id: str  # Provided by Next.js API route after session validation


class SubredditDiscoveryResponse(BaseModel):
    subreddit_name: str
    relevance_score: float
    reason: str
    subscriber_count: Optional[int] = None
    is_verified: bool
    already_tracked: bool


class TrackSubredditRequest(BaseModel):
    stock_symbol: str
    subreddit_name: str
    relevance_score: Optional[float] = None


class TrackedSubredditResponse(BaseModel):
    id: int
    subreddit_name: str
    subscriber_count: Optional[int]
    is_active: bool
    last_scraped_at: Optional[datetime]
    relevance_score: Optional[float]
    is_primary: bool

    class Config:
        from_attributes = True


class ScraperJobRequest(BaseModel):
    subreddits: List[str]
    job_type: Optional[str] = "manual_scrape"
    priority: Optional[int] = 5


class ScraperJobResponse(BaseModel):
    job_id: int
    status: str
    subreddits: List[str]
    priority: int
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/discover", response_model=List[SubredditDiscoveryResponse])
async def discover_subreddits(
    request: SubredditDiscoveryRequest,
    db: AsyncSession = Depends(get_db)
):
    """Discover relevant subreddits for a stock using AI.

    This endpoint uses the user's OpenAI API key to find and suggest relevant
    subreddit communities for a given stock ticker. Results include verification
    status and subscriber counts.

    Note: user_id is provided by the Next.js API route after session validation.
    """
    try:
        # Get user's OpenAI API key
        user_api_key = await get_user_api_key(db, request.user_id)

        # Initialize discovery service with user's API key
        discovery_service = SubredditDiscoveryService(
            openai_api_key=user_api_key,
            reddit_client_id=os.getenv("REDDIT_CLIENT_ID"),
            reddit_client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
            reddit_user_agent=os.getenv("REDDIT_USER_AGENT", "AkleaoFinance/1.0")
        )

        # Discover subreddits (this is a sync operation that makes API calls)
        # We'll need to run it in a thread pool to avoid blocking
        import asyncio
        results = await asyncio.to_thread(
            discovery_service.discover_subreddits,
            stock_symbol=request.stock_symbol,
            stock_name=request.stock_name
        )

        # Check which subreddits are already tracked for this stock
        result = await db.execute(
            select(StockSubredditMapping).filter(
                StockSubredditMapping.stock_symbol == request.stock_symbol
            )
        )
        tracked_mappings = result.scalars().all()
        tracked_subreddit_ids = {m.subreddit_id for m in tracked_mappings}

        # Get all tracked subreddits
        tracked_names = set()
        if tracked_subreddit_ids:
            result = await db.execute(
                select(TrackedSubreddit).filter(
                    TrackedSubreddit.id.in_(tracked_subreddit_ids)
                )
            )
            tracked_subreddits = result.scalars().all()
            tracked_names = {s.subreddit_name for s in tracked_subreddits}

        # Build response
        response = []
        for result in results:
            response.append(SubredditDiscoveryResponse(
                subreddit_name=result.subreddit_name,
                relevance_score=result.relevance_score,
                reason=result.reason,
                subscriber_count=result.subscriber_count,
                is_verified=result.is_verified,
                already_tracked=result.subreddit_name in tracked_names
            ))

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")


@router.post("/track")
async def track_subreddit(
    request: TrackSubredditRequest,
    db: AsyncSession = Depends(get_db)
):
    """Add a subreddit to tracking for a specific stock.

    This creates or updates the mapping between a stock and a subreddit,
    making the scraper include posts from this subreddit when displaying
    data for the stock.
    """
    try:
        # Ensure stock exists
        result = await db.execute(
            select(Stock).filter(Stock.symbol == request.stock_symbol)
        )
        stock = result.scalar_one_or_none()

        if not stock:
            # Create stock if it doesn't exist
            stock = Stock(
                symbol=request.stock_symbol,
                name=request.stock_symbol,
                sector=None,
                industry=None
            )
            db.add(stock)
            await db.commit()

        # Check if subreddit is already tracked globally
        result = await db.execute(
            select(TrackedSubreddit).filter(
                TrackedSubreddit.subreddit_name == request.subreddit_name
            )
        )
        tracked_sub = result.scalar_one_or_none()

        if not tracked_sub:
            # Create new tracked subreddit
            tracked_sub = TrackedSubreddit(
                subreddit_name=request.subreddit_name,
                is_active=True
            )
            db.add(tracked_sub)
            await db.commit()
            await db.refresh(tracked_sub)

        # Check if mapping already exists
        result = await db.execute(
            select(StockSubredditMapping).filter(
                StockSubredditMapping.stock_symbol == request.stock_symbol,
                StockSubredditMapping.subreddit_id == tracked_sub.id
            )
        )
        existing_mapping = result.scalar_one_or_none()

        if existing_mapping:
            # Update relevance score if provided
            if request.relevance_score is not None:
                existing_mapping.relevance_score = request.relevance_score
                await db.commit()
            return {"message": "Mapping already exists", "mapping_id": existing_mapping.id}

        # Create new mapping
        mapping = StockSubredditMapping(
            stock_symbol=request.stock_symbol,
            subreddit_id=tracked_sub.id,
            relevance_score=request.relevance_score,
            discovered_by="manual"  # Could be 'ai', 'manual', 'import', etc.
        )
        db.add(mapping)
        await db.commit()
        await db.refresh(mapping)

        return {"message": "Subreddit tracked successfully", "mapping_id": mapping.id}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to track subreddit: {str(e)}")


@router.delete("/track/{stock_symbol}/{subreddit_name}")
async def untrack_subreddit(
    stock_symbol: str,
    subreddit_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Remove tracking mapping between a stock and subreddit.

    This removes the association but does not delete the subreddit from
    the global tracked list (other stocks may still use it).
    """
    try:
        # Find the tracked subreddit
        result = await db.execute(
            select(TrackedSubreddit).filter(
                TrackedSubreddit.subreddit_name == subreddit_name
            )
        )
        tracked_sub = result.scalar_one_or_none()

        if not tracked_sub:
            raise HTTPException(status_code=404, detail="Subreddit not found")

        # Find and delete the mapping
        result = await db.execute(
            select(StockSubredditMapping).filter(
                StockSubredditMapping.stock_symbol == stock_symbol,
                StockSubredditMapping.subreddit_id == tracked_sub.id
            )
        )
        mapping = result.scalar_one_or_none()

        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")

        await db.delete(mapping)
        await db.commit()

        return {"message": "Subreddit untracked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to untrack subreddit: {str(e)}")


@router.get("/tracked/{stock_symbol}", response_model=List[TrackedSubredditResponse])
async def get_tracked_subreddits(
    stock_symbol: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all subreddits tracked for a specific stock."""
    try:
        # Get all mappings for this stock with joined subreddit data
        result = await db.execute(
            select(StockSubredditMapping, TrackedSubreddit)
            .join(
                TrackedSubreddit,
                StockSubredditMapping.subreddit_id == TrackedSubreddit.id
            )
            .filter(StockSubredditMapping.stock_symbol == stock_symbol)
        )
        mappings = result.all()

        response = []
        for mapping, subreddit in mappings:
            response.append(TrackedSubredditResponse(
                id=subreddit.id,
                subreddit_name=subreddit.subreddit_name,
                subscriber_count=subreddit.subscriber_count,
                is_active=subreddit.is_active,
                last_scraped_at=subreddit.last_scraped_at,
                relevance_score=mapping.relevance_score,
                is_primary=mapping.is_primary
            ))

        # Sort by relevance score descending
        response.sort(key=lambda x: x.relevance_score or 0, reverse=True)

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tracked subreddits: {str(e)}")


class AllTrackedSubredditResponse(BaseModel):
    id: int
    subreddit_name: str
    subscriber_count: Optional[int]
    is_active: bool
    last_scraped_at: Optional[datetime]
    scrape_sort: str
    scrape_time_filter: Optional[str]
    scrape_limit: int
    scrape_lookback_days: int
    stock_symbols: List[str] = []  # List of stock symbols mapped to this subreddit

    class Config:
        from_attributes = True


@router.get("/all-tracked-subreddits", response_model=List[AllTrackedSubredditResponse])
async def get_all_tracked_subreddits(
    db: AsyncSession = Depends(get_db)
):
    """Get all tracked subreddits globally (not filtered by stock)."""
    try:
        # Fetch subreddits with their stock mappings
        result = await db.execute(
            select(TrackedSubreddit)
            .options(selectinload(TrackedSubreddit.stock_mappings))
            .order_by(TrackedSubreddit.subreddit_name)
        )
        subreddits = result.scalars().all()

        return [AllTrackedSubredditResponse(
            id=sub.id,
            subreddit_name=sub.subreddit_name,
            subscriber_count=sub.subscriber_count,
            is_active=sub.is_active,
            last_scraped_at=sub.last_scraped_at,
            scrape_sort=sub.scrape_sort,
            scrape_time_filter=sub.scrape_time_filter,
            scrape_limit=sub.scrape_limit,
            scrape_lookback_days=sub.scrape_lookback_days,
            stock_symbols=[mapping.stock_symbol for mapping in sub.stock_mappings]
        ) for sub in subreddits]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tracked subreddits: {str(e)}")


class SubredditSearchResult(BaseModel):
    name: str
    subscribers: Optional[int] = None


@router.get("/search-subreddits", response_model=List[SubredditSearchResult])
async def search_subreddits(
    query: str = Query(..., min_length=1, max_length=50, description="Search query for subreddit names")
):
    """Search for subreddits by name prefix using Reddit's API.

    This endpoint searches for subreddit names that begin with the query string,
    useful for autocomplete functionality when adding subreddits.

    Args:
        query: Search string to match subreddit names (case-insensitive)

    Returns:
        List of matching subreddit names with subscriber counts
    """
    try:
        # Initialize Reddit client
        reddit = praw.Reddit(
            client_id=os.getenv("REDDIT_CLIENT_ID"),
            client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
            user_agent=os.getenv("REDDIT_USER_AGENT", "AkleaoFinance/1.0")
        )

        # Use PRAW's search_by_name method for autocomplete-style search
        # This searches for subreddit names that begin with the query
        import asyncio
        subreddits = await asyncio.to_thread(
            reddit.subreddits.search_by_name,
            query=query,
            include_nsfw=False,  # Exclude NSFW subreddits
            exact=False  # Allow partial matches
        )

        # Extract name and subscriber count from results
        results = []
        for subreddit in subreddits[:10]:  # Limit to 10 results for autocomplete
            try:
                results.append(SubredditSearchResult(
                    name=subreddit.display_name,
                    subscribers=subreddit.subscribers
                ))
            except Exception:
                # Skip subreddits that error out
                continue

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search subreddits: {str(e)}")


class AddSubredditRequest(BaseModel):
    subreddit_name: str


@router.post("/add-subreddit")
async def add_subreddit(
    request: AddSubredditRequest,
    db: AsyncSession = Depends(get_db)
):
    """Add a new subreddit to track globally."""
    try:
        # Clean the subreddit name (remove r/ prefix if present)
        subreddit_name = request.subreddit_name.strip().lower()
        if subreddit_name.startswith("r/"):
            subreddit_name = subreddit_name[2:]

        # Check if already exists
        result = await db.execute(
            select(TrackedSubreddit).filter(
                TrackedSubreddit.subreddit_name == subreddit_name
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # If it exists but is inactive, reactivate it
            if not existing.is_active:
                existing.is_active = True
                await db.commit()
                return {"message": "Subreddit reactivated", "id": existing.id}
            else:
                raise HTTPException(status_code=400, detail="Subreddit is already being tracked")

        # Create new tracked subreddit
        new_subreddit = TrackedSubreddit(
            subreddit_name=subreddit_name,
            is_active=True
        )
        db.add(new_subreddit)
        await db.commit()
        await db.refresh(new_subreddit)

        return {"message": "Subreddit added successfully", "id": new_subreddit.id}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add subreddit: {str(e)}")


@router.delete("/subreddit/{subreddit_id}")
async def delete_subreddit(
    subreddit_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Remove a subreddit from tracking (marks as inactive)."""
    try:
        result = await db.execute(
            select(TrackedSubreddit).filter(TrackedSubreddit.id == subreddit_id)
        )
        subreddit = result.scalar_one_or_none()

        if not subreddit:
            raise HTTPException(status_code=404, detail="Subreddit not found")

        # Mark as inactive instead of deleting (preserves historical data)
        subreddit.is_active = False
        await db.commit()

        return {"message": "Subreddit removed from tracking"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete subreddit: {str(e)}")


class UpdateScrapeSettingsRequest(BaseModel):
    scrape_sort: Optional[str] = None  # hot, new, top, rising
    scrape_time_filter: Optional[str] = None  # all, year, month, week, day, hour
    scrape_limit: Optional[int] = None
    scrape_lookback_days: Optional[int] = None


@router.patch("/subreddit/{subreddit_id}/settings")
async def update_scrape_settings(
    subreddit_id: int,
    request: UpdateScrapeSettingsRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update scrape settings for a tracked subreddit."""
    try:
        result = await db.execute(
            select(TrackedSubreddit).filter(TrackedSubreddit.id == subreddit_id)
        )
        subreddit = result.scalar_one_or_none()

        if not subreddit:
            raise HTTPException(status_code=404, detail="Subreddit not found")

        # Update fields that were provided
        if request.scrape_sort is not None:
            if request.scrape_sort not in ["hot", "new", "top", "rising"]:
                raise HTTPException(status_code=400, detail="Invalid scrape_sort value")
            subreddit.scrape_sort = request.scrape_sort

        if request.scrape_time_filter is not None:
            if request.scrape_time_filter not in [None, "all", "year", "month", "week", "day", "hour"]:
                raise HTTPException(status_code=400, detail="Invalid scrape_time_filter value")
            subreddit.scrape_time_filter = request.scrape_time_filter

        if request.scrape_limit is not None:
            if request.scrape_limit < 1 or request.scrape_limit > 1000:
                raise HTTPException(status_code=400, detail="scrape_limit must be between 1 and 1000")
            subreddit.scrape_limit = request.scrape_limit

        if request.scrape_lookback_days is not None:
            if request.scrape_lookback_days < 1 or request.scrape_lookback_days > 365:
                raise HTTPException(status_code=400, detail="scrape_lookback_days must be between 1 and 365")
            subreddit.scrape_lookback_days = request.scrape_lookback_days

        await db.commit()
        await db.refresh(subreddit)

        return {
            "message": "Scrape settings updated successfully",
            "settings": {
                "scrape_sort": subreddit.scrape_sort,
                "scrape_time_filter": subreddit.scrape_time_filter,
                "scrape_limit": subreddit.scrape_limit,
                "scrape_lookback_days": subreddit.scrape_lookback_days
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update scrape settings: {str(e)}")


@router.post("/scrape/trigger")
async def trigger_scrape(db: AsyncSession = Depends(get_db)):
    """Trigger an immediate Reddit scrape of all tracked subreddits.

    Creates a high-priority scraper job that will be picked up by the worker.
    This scrapes all active tracked subreddits in a single batch job.
    """
    try:
        # Get all active tracked subreddits
        result = await db.execute(
            select(TrackedSubreddit).filter(TrackedSubreddit.is_active == True)
        )
        tracked_subs = result.scalars().all()

        if not tracked_subs:
            raise HTTPException(status_code=404, detail="No active subreddits to scrape")

        subreddit_names = [sub.subreddit_name for sub in tracked_subs]

        # Create a high-priority scraper job
        scraper_job = ScraperJob(
            job_type="full_scrape",
            status="pending",
            priority=1,  # High priority for manual triggers
            config={"subreddits": subreddit_names},
            created_at=datetime.utcnow()
        )
        db.add(scraper_job)
        await db.commit()
        await db.refresh(scraper_job)

        return {
            "message": f"Scrape job created for {len(subreddit_names)} subreddits",
            "job_id": scraper_job.id,
            "status": scraper_job.status,
            "subreddit_count": len(subreddit_names),
            "subreddits": subreddit_names
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to trigger scrape: {str(e)}")


@router.post("/scrape/job", response_model=ScraperJobResponse)
async def create_scraper_job(
    request: ScraperJobRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a custom scraper job with specific subreddits.

    This allows creating targeted scrape jobs for specific subreddits,
    useful for stock-specific scrapes or custom subreddit lists.
    """
    try:
        if not request.subreddits:
            raise HTTPException(status_code=400, detail="At least one subreddit is required")

        # Create scraper job
        scraper_job = ScraperJob(
            job_type=request.job_type,
            status="pending",
            priority=request.priority,
            config={"subreddits": request.subreddits},
            created_at=datetime.utcnow()
        )
        db.add(scraper_job)
        await db.commit()
        await db.refresh(scraper_job)

        return ScraperJobResponse(
            job_id=scraper_job.id,
            status=scraper_job.status,
            subreddits=request.subreddits,
            priority=scraper_job.priority,
            created_at=scraper_job.created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create scraper job: {str(e)}")


@router.get("/scrape/jobs")
async def get_scraper_jobs(
    status: Optional[str] = Query(None, description="Filter by status: pending, processing, completed, failed"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get recent scraper jobs with optional status filter."""
    try:
        query = select(ScraperJob).order_by(ScraperJob.created_at.desc()).limit(limit)

        if status:
            query = query.filter(ScraperJob.status == status)

        result = await db.execute(query)
        jobs = result.scalars().all()

        return [{
            "job_id": job.id,
            "job_type": job.job_type,
            "status": job.status,
            "priority": job.priority,
            "subreddits": job.config.get("subreddits", []) if job.config else [],
            "created_at": job.created_at,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "posts_collected": job.posts_collected,
            "errors_count": job.errors_count
        } for job in jobs]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch scraper jobs: {str(e)}")

# === Comment Tracking Endpoints ===

class TrackPostCommentsRequest(BaseModel):
    post_id: str
    track_days: Optional[int] = 7  # Number of days to track this post


@router.post("/track-post-comments/{post_id}")
async def track_post_comments(
    post_id: str,
    request: TrackPostCommentsRequest,
    db: AsyncSession = Depends(get_db)
):
    """Enable comment tracking for a specific post.
    
    This marks the post to be actively monitored for new comments.
    The post will be tracked for the specified number of days.
    """
    try:
        from datetime import timedelta
        
        # Get the post
        result = await db.execute(
            select(RedditPost).filter(RedditPost.id == post_id)
        )
        post = result.scalar_one_or_none()
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Enable tracking
        post.track_comments = True
        post.track_until = datetime.utcnow() + timedelta(days=request.track_days)
        
        await db.commit()
        
        return {
            "message": "Comment tracking enabled",
            "post_id": post_id,
            "track_until": post.track_until
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enable comment tracking: {str(e)}")


@router.post("/rescrape-comments/{post_id}")
async def rescrape_post_comments(
    post_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Manually trigger a comment rescrape for a specific post.
    
    This will create a high-priority scraper job to fetch new comments
    for this post immediately.
    """
    try:
        # Get the post
        result = await db.execute(
            select(RedditPost).filter(RedditPost.id == post_id)
        )
        post = result.scalar_one_or_none()
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Create a high-priority scraper job for this specific post
        job = ScraperJob(
            job_type="comment_rescrape",
            status="pending",
            priority=100,  # High priority for manual requests
            config={
                "post_id": post_id,
                "subreddit": post.subreddit
            }
        )
        db.add(job)
        
        # Update tracking info
        post.last_comment_scrape_at = datetime.utcnow()
        post.comment_scrape_count += 1
        
        await db.commit()
        
        return {
            "message": "Comment rescrape job created",
            "job_id": job.id,
            "post_id": post_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rescrape comments: {str(e)}")


@router.get("/tracked-posts")
async def get_tracked_posts(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200)
):
    """Get list of posts currently being tracked for comments."""
    try:
        result = await db.execute(
            select(RedditPost)
            .filter(RedditPost.track_comments == True)
            .filter(RedditPost.track_until > datetime.utcnow())
            .order_by(RedditPost.created_at.desc())
            .limit(limit)
        )
        posts = result.scalars().all()
        
        return [{
            "post_id": post.id,
            "title": post.title,
            "subreddit": post.subreddit,
            "created_at": post.created_at,
            "num_comments": post.num_comments,
            "track_until": post.track_until,
            "last_comment_scrape_at": post.last_comment_scrape_at,
            "comment_scrape_count": post.comment_scrape_count
        } for post in posts]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tracked posts: {str(e)}")


@router.get("/stats")
async def get_reddit_stats(db: AsyncSession = Depends(get_db)):
    """Get overall Reddit tracking statistics."""
    try:
        # Get total posts count
        total_posts_result = await db.execute(
            text("SELECT COUNT(*) FROM reddit_posts")
        )
        total_posts = total_posts_result.scalar()

        # Get tracked posts count (posts where track_comments = true)
        tracked_posts_result = await db.execute(
            text("SELECT COUNT(*) FROM reddit_posts WHERE track_comments = true")
        )
        tracked_posts = tracked_posts_result.scalar()

        return {
            "total_posts": total_posts or 0,
            "tracked_posts": tracked_posts or 0
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")
