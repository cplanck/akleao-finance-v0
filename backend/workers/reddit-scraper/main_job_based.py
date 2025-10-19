"""Reddit scraper worker - job-based version that processes scraper jobs from queue."""

import praw
import os
import time
import json
import re
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import sys
sys.path.insert(0, "../../shared")
from shared.models.reddit_post import RedditPost, RedditComment
from shared.models.stock import Stock
from shared.models.scraper_run import ScraperRun
from shared.models.scraper_job import ScraperJob
from shared.models.tracked_subreddit import TrackedSubreddit, StockSubredditMapping
from shared.websocket_client import emit_scraper_status

# Configuration
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "AkleaoFinance/1.0")
DATABASE_URL = os.getenv("DATABASE_URL")
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "5"))

# Stock ticker pattern (e.g., $AAPL, $TSLA)
TICKER_PATTERN = re.compile(r'\$([A-Z]{1,5})\b')


def get_stock_subreddit_map(db: Session) -> dict[str, list[str]]:
    """Get mapping of subreddits to their primary stocks.

    Returns:
        Dict mapping subreddit_name -> [stock_symbols]
    """
    mappings = db.query(
        TrackedSubreddit.subreddit_name,
        StockSubredditMapping.stock_symbol
    ).join(
        StockSubredditMapping,
        TrackedSubreddit.id == StockSubredditMapping.subreddit_id
    ).filter(
        TrackedSubreddit.is_active == True
    ).all()

    # Build dict: subreddit_name -> list of stock symbols
    result = {}
    for subreddit_name, stock_symbol in mappings:
        if subreddit_name not in result:
            result[subreddit_name] = []
        result[subreddit_name].append(stock_symbol)

    return result


def extract_stock_tickers(text: str) -> list[str]:
    """Extract stock tickers from text (e.g., $AAPL)."""
    if not text:
        return []
    tickers = TICKER_PATTERN.findall(text)
    return list(set(tickers))  # Remove duplicates


def ensure_stock_exists(db: Session, symbol: str):
    """Ensure a stock entry exists in the database."""
    existing = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not existing:
        stock = Stock(
            symbol=symbol,
            name=symbol,  # We'll update with real name later
            sector=None,
            industry=None
        )
        db.add(stock)
        db.flush()  # Flush to make the stock available for foreign key


def process_submission(submission, subreddit_name: str, db: Session, stock_map: dict[str, list[str]], debug=False) -> bool:
    """Process a single Reddit submission. Returns True if saved, False if skipped."""
    # Skip if post already exists
    existing = db.query(RedditPost).filter(RedditPost.id == submission.id).first()
    if existing:
        if debug:
            print(f"  ⏭️  Skipped {submission.id} (already exists)")
        return False

    # Extract stock mentions
    title_text = submission.title
    body_text = submission.selftext if hasattr(submission, 'selftext') else ""
    full_text = f"{title_text} {body_text}"

    mentioned_stocks = extract_stock_tickers(full_text)

    # Check if subreddit has stock mappings
    mapped_stocks = stock_map.get(subreddit_name, [])

    # Only process if:
    # - Stocks are mentioned, OR
    # - It's a general discussion subreddit (investing, stocks), OR
    # - The subreddit has stock mappings (e.g., r/AAPL is mapped to AAPL stock)
    if not mentioned_stocks and subreddit_name not in ["investing", "stocks"] and not mapped_stocks:
        if debug:
            print(f"  ⏭️  Skipped {submission.id} (no stock mentions and no mappings)")
        return False

    # Ensure all mentioned stocks exist in the database
    for stock_symbol in mentioned_stocks:
        ensure_stock_exists(db, stock_symbol)

    # Determine primary stock
    primary_stock = None
    if mentioned_stocks:
        # If any mentioned stock matches the subreddit mapping, use that
        for stock in mentioned_stocks:
            if stock in mapped_stocks:
                primary_stock = stock
                break
        if not primary_stock:
            primary_stock = mentioned_stocks[0]
    else:
        # No stocks mentioned, but subreddit has stock mappings
        if len(mapped_stocks) == 1:
            primary_stock = mapped_stocks[0]
            mentioned_stocks = [primary_stock]
            ensure_stock_exists(db, primary_stock)
        elif len(mapped_stocks) > 1:
            # Multiple stocks mapped, use the first one
            primary_stock = mapped_stocks[0]
            mentioned_stocks = [primary_stock]
            ensure_stock_exists(db, primary_stock)

    # Create post record
    post = RedditPost(
        id=submission.id,
        subreddit=subreddit_name,
        title=title_text[:500],
        author=str(submission.author) if submission.author else "[deleted]",
        content=body_text,
        url=submission.url,
        score=submission.score,
        upvote_ratio=submission.upvote_ratio,
        num_comments=submission.num_comments,
        mentioned_stocks=json.dumps(mentioned_stocks),
        primary_stock=primary_stock,
        is_processed=False,
        is_relevant=len(mentioned_stocks) > 0,
        created_at=datetime.fromtimestamp(submission.created_utc)
    )

    db.add(post)
    print(f"  ✅ Saved post: {submission.id} - {title_text[:50]}...")

    # Scrape top comments
    submission.comments.replace_more(limit=0)
    for comment in submission.comments.list()[:20]:
        if not hasattr(comment, 'body'):
            continue

        comment_stocks = extract_stock_tickers(comment.body)

        existing_comment = db.query(RedditComment).filter(
            RedditComment.id == comment.id
        ).first()
        if existing_comment:
            continue

        for stock_symbol in comment_stocks:
            ensure_stock_exists(db, stock_symbol)

        comment_record = RedditComment(
            id=comment.id,
            post_id=submission.id,
            author=str(comment.author) if comment.author else "[deleted]",
            content=comment.body[:5000],
            score=comment.score,
            mentioned_stocks=json.dumps(comment_stocks) if comment_stocks else None,
            is_processed=False,
            is_relevant=len(comment_stocks) > 0 or len(mentioned_stocks) > 0,
            created_at=datetime.fromtimestamp(comment.created_utc)
        )

        db.add(comment_record)

    db.commit()
    return True


def scrape_subreddit(reddit: praw.Reddit, subreddit_name: str, db: Session, stock_map: dict[str, list[str]]) -> int:
    """Scrape posts from a subreddit using its configured settings. Returns number of posts saved."""
    print(f"📡 Scraping r/{subreddit_name}...")

    # Get tracked subreddit settings
    tracked_sub = db.query(TrackedSubreddit).filter(
        TrackedSubreddit.subreddit_name == subreddit_name
    ).first()

    if not tracked_sub:
        print(f"  ⚠️  Subreddit r/{subreddit_name} not found in tracked_subreddits")
        return 0

    # Use settings from database
    sort_method = tracked_sub.scrape_sort or "hot"
    time_filter = tracked_sub.scrape_time_filter
    limit = tracked_sub.scrape_limit or 100
    lookback_days = tracked_sub.scrape_lookback_days or 7

    print(f"  ⚙️  Settings: sort={sort_method}, limit={limit}, lookback={lookback_days} days, time_filter={time_filter}")

    subreddit = reddit.subreddit(subreddit_name)
    posts_saved = 0
    posts_processed = 0
    posts_too_old = 0

    # Enable debug mode for certain subreddits to see why posts are skipped
    debug_mode = subreddit_name in ["AAPL", "META"]

    # Calculate cutoff timestamp for lookback
    from datetime import timedelta
    cutoff_time = datetime.utcnow() - timedelta(days=lookback_days)
    cutoff_timestamp = cutoff_time.timestamp()

    # Fetch posts based on configured sort method
    try:
        if sort_method == "hot":
            print(f"  🔥 Fetching hot posts (limit: {limit})...")
            submissions = subreddit.hot(limit=limit)
        elif sort_method == "new":
            print(f"  🆕 Fetching new posts (limit: {limit})...")
            submissions = subreddit.new(limit=limit)
        elif sort_method == "top":
            filter_str = time_filter or "week"
            print(f"  ⭐ Fetching top posts (time_filter: {filter_str}, limit: {limit})...")
            submissions = subreddit.top(time_filter=filter_str, limit=limit)
        elif sort_method == "rising":
            print(f"  📈 Fetching rising posts (limit: {limit})...")
            submissions = subreddit.rising(limit=limit)
        else:
            print(f"  ⚠️  Unknown sort method '{sort_method}', defaulting to hot")
            submissions = subreddit.hot(limit=limit)

        # Process submissions with lookback filter
        for submission in submissions:
            posts_processed += 1

            # Skip posts older than lookback period
            if submission.created_utc < cutoff_timestamp:
                posts_too_old += 1
                if debug_mode and posts_too_old <= 3:
                    post_date = datetime.fromtimestamp(submission.created_utc)
                    print(f"  ⏭️  Skipped {submission.id} (too old: {post_date})")
                continue

            if process_submission(submission, subreddit_name, db, stock_map, debug=debug_mode):
                posts_saved += 1

        print(f"  ✨ Saved {posts_saved} new posts from r/{subreddit_name} (processed {posts_processed}, {posts_too_old} too old)")

    except Exception as e:
        print(f"  ❌ Error fetching posts: {e}")

    # Update last_scraped_at
    tracked_sub.last_scraped_at = datetime.utcnow()
    db.commit()

    return posts_saved


def process_scraper_job(job: ScraperJob, reddit: praw.Reddit, db: Session):
    """Process a single scraper job."""
    print(f"\n🎯 Processing job #{job.id} (type: {job.job_type})")

    # Mark job as processing
    job.status = "processing"
    job.started_at = datetime.utcnow()
    db.commit()

    # Create associated ScraperRun for detailed tracking
    scraper_run = ScraperRun(
        run_type="reddit",
        status="running",
        started_at=job.started_at
    )
    db.add(scraper_run)
    db.commit()

    job.scraper_run_id = scraper_run.id
    db.commit()

    # Emit WebSocket event
    emit_scraper_status({
        "status": "running",
        "message": f"Processing {job.job_type} job",
        "job_id": job.id,
        "started_at": job.started_at.isoformat()
    })

    posts_count = 0
    errors_count = 0
    start_time = datetime.utcnow()

    try:
        # Get subreddits from job config
        subreddits = job.config.get("subreddits", []) if job.config else []

        if not subreddits:
            raise ValueError("No subreddits specified in job config")

        print(f"📊 Scraping {len(subreddits)} subreddit(s): {', '.join(subreddits)}")

        # Get stock mapping
        stock_map = get_stock_subreddit_map(db)

        # Scrape each subreddit
        for subreddit_name in subreddits:
            try:
                posts_saved = scrape_subreddit(reddit, subreddit_name, db, stock_map)
                posts_count += posts_saved
            except Exception as e:
                print(f"❌ Error scraping r/{subreddit_name}: {e}")
                errors_count += 1

        # Mark as completed
        completed_time = datetime.utcnow()
        duration = (completed_time - start_time).total_seconds()

        job.status = "completed"
        job.completed_at = completed_time
        job.posts_collected = posts_count
        job.errors_count = errors_count

        scraper_run.status = "completed"
        scraper_run.completed_at = completed_time
        scraper_run.duration_seconds = duration
        scraper_run.posts_collected = posts_count
        scraper_run.errors_count = errors_count

        db.commit()

        # Emit WebSocket event
        emit_scraper_status({
            "status": "completed",
            "message": f"Job #{job.id} completed",
            "job_id": job.id,
            "posts_collected": posts_count,
            "duration_seconds": duration,
            "errors_count": errors_count,
            "completed_at": completed_time.isoformat()
        })

        print(f"✅ Job #{job.id} complete - collected {posts_count} posts in {duration:.1f}s")

    except Exception as e:
        # Mark as failed
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_message = str(e)[:500]
        job.errors_count = errors_count + 1

        scraper_run.status = "failed"
        scraper_run.completed_at = datetime.utcnow()
        scraper_run.error_message = str(e)[:500]

        db.commit()

        emit_scraper_status({
            "status": "failed",
            "message": f"Job #{job.id} failed: {str(e)[:100]}",
            "job_id": job.id,
            "error": str(e)
        })

        print(f"❌ Job #{job.id} failed: {e}")


def main():
    """Main worker loop - polls for jobs and processes them."""
    print("🚀 Starting Reddit Scraper Worker (Job-Based)")
    print(f"⏱️  Poll interval: {POLL_INTERVAL_SECONDS} seconds")

    # Initialize Reddit API
    reddit = praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent=REDDIT_USER_AGENT
    )

    # Initialize database connection
    engine = create_engine(DATABASE_URL)
    db = Session(engine)

    print("✅ Worker ready - waiting for jobs...")

    while True:
        try:
            # Poll for pending jobs (ordered by priority, then created_at)
            pending_job = db.query(ScraperJob).filter(
                ScraperJob.status == "pending"
            ).order_by(
                ScraperJob.priority.asc(),  # Lower number = higher priority
                ScraperJob.created_at.asc()  # FIFO for same priority
            ).first()

            if pending_job:
                process_scraper_job(pending_job, reddit, db)
            else:
                # No jobs - sleep and check again
                time.sleep(POLL_INTERVAL_SECONDS)

        except KeyboardInterrupt:
            print("\n👋 Shutting down Reddit Scraper Worker...")
            break
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            print("⏸️  Waiting 30 seconds before retry...")
            time.sleep(30)


if __name__ == "__main__":
    main()
