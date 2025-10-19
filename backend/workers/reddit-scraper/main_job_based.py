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
        initial_num_comments=submission.num_comments,  # Track initial comment count
        mentioned_stocks=json.dumps(mentioned_stocks),
        primary_stock=primary_stock,
        is_processed=False,
        is_relevant=len(mentioned_stocks) > 0,
        posted_at=datetime.fromtimestamp(submission.created_utc)  # When post was created on Reddit
        # created_at will be set automatically by TimestampMixin to when we indexed it
    )

    # Auto-track posts for comment monitoring based on criteria
    post_age_minutes = (datetime.utcnow() - post.posted_at).total_seconds() / 60
    post_age_days = post_age_minutes / (60 * 24)

    should_track = False
    track_days = 0

    # Criteria 1: Post is < 1 hour old and already has comments
    if post_age_minutes < 60 and submission.num_comments > 0:
        should_track = True
        track_days = 1  # Track for 1 day
        if debug:
            print(f"  👁️  Auto-tracking: Fresh post with {submission.num_comments} comments")

    # Criteria 2: Post is < 1 week old with significant engagement
    elif post_age_days < 7 and submission.num_comments >= 10:
        should_track = True
        track_days = 7  # Track for remaining week
        if debug:
            print(f"  👁️  Auto-tracking: Recent post with high engagement ({submission.num_comments} comments)")

    if should_track:
        from datetime import timedelta
        post.track_comments = True
        post.track_until = datetime.utcnow() + timedelta(days=track_days)
        post.comment_scrape_count = 0
        print(f"  👁️  Enabled comment tracking for {track_days} days")

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


def rescrape_post_comments(reddit: praw.Reddit, post_id: str, subreddit_name: str, db: Session) -> int:
    """Rescrape comments for a specific post. Returns number of new comments saved."""
    print(f"💬 Rescr scraping comments for post {post_id} in r/{subreddit_name}...")

    # Get the post from database
    post = db.query(RedditPost).filter(RedditPost.id == post_id).first()
    if not post:
        print(f"  ❌ Post {post_id} not found in database")
        return 0

    try:
        # Fetch the post from Reddit
        submission = reddit.submission(id=post_id)

        # Update post metadata (score, num_comments, etc.)
        old_comment_count = post.num_comments
        post.num_comments = submission.num_comments
        post.score = submission.score
        post.upvote_ratio = submission.upvote_ratio

        print(f"  📊 Updated post metadata: {old_comment_count} → {post.num_comments} comments")

        # Fetch comments
        submission.comments.replace_more(limit=0)
        comments_saved = 0

        # Get existing comment IDs to avoid duplicates
        existing_comment_ids = {c.id for c in db.query(RedditComment.id).filter(
            RedditComment.post_id == post_id
        ).all()}

        for comment in submission.comments.list():
            if not hasattr(comment, 'body'):
                continue

            # Skip if comment already exists
            if comment.id in existing_comment_ids:
                continue

            comment_stocks = extract_stock_tickers(comment.body)

            for stock_symbol in comment_stocks:
                ensure_stock_exists(db, stock_symbol)

            comment_record = RedditComment(
                id=comment.id,
                post_id=post_id,
                author=str(comment.author) if comment.author else "[deleted]",
                content=comment.body[:5000],
                score=comment.score,
                mentioned_stocks=json.dumps(comment_stocks) if comment_stocks else None,
                is_processed=False,
                is_relevant=len(comment_stocks) > 0 or len(post.mentioned_stocks or []) > 0,
                created_at=datetime.fromtimestamp(comment.created_utc)
            )

            db.add(comment_record)
            comments_saved += 1

        # Update tracking metadata
        post.last_comment_scrape_at = datetime.utcnow()
        post.comment_scrape_count += 1

        db.commit()

        print(f"  ✅ Saved {comments_saved} new comments (total: {post.num_comments}, scrape #{post.comment_scrape_count})")
        return comments_saved

    except Exception as e:
        print(f"  ❌ Error rescr scraping comments: {e}")
        db.rollback()
        return 0


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
        # Handle different job types
        if job.job_type == "comment_rescrape":
            # Rescrape comments for a specific post
            post_id = job.config.get("post_id") if job.config else None
            subreddit = job.config.get("subreddit") if job.config else None

            if not post_id:
                raise ValueError("No post_id specified in comment_rescrape job config")

            print(f"💬 Rescraping comments for post {post_id}")
            comments_saved = rescrape_post_comments(reddit, post_id, subreddit or "unknown", db)
            posts_count = comments_saved  # Track comment count as posts_count

        else:
            # Regular subreddit scraping
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


def check_and_queue_comment_rescrapes(db: Session):
    """Check for tracked posts that need comment rescraping and queue jobs."""
    # Find posts that:
    # 1. Are being tracked (track_comments = true)
    # 2. Haven't expired (track_until > now)
    # 3. Either haven't been scraped yet OR last scraped > 15 minutes ago

    from datetime import timedelta
    now = datetime.utcnow()
    fifteen_minutes_ago = now - timedelta(minutes=15)
    one_day_ago = now - timedelta(days=1)

    # Posts that need rescraping - ordered by recency (newer posts first)
    posts_to_rescrape = db.query(RedditPost).filter(
        RedditPost.track_comments == True,
        RedditPost.track_until > now,
        (
            (RedditPost.last_comment_scrape_at == None) |  # Never scraped
            (RedditPost.last_comment_scrape_at < fifteen_minutes_ago)  # Not scraped recently
        )
    ).order_by(RedditPost.posted_at.desc()).limit(10).all()  # Limit to prevent overwhelming the queue

    jobs_created = 0
    for post in posts_to_rescrape:
        # Check if a job already exists for this post
        # Use JSON path query for PostgreSQL
        from sqlalchemy import cast, String
        existing_job = db.query(ScraperJob).filter(
            ScraperJob.job_type == "comment_rescrape",
            ScraperJob.status.in_(["pending", "running"]),
            cast(ScraperJob.config['post_id'], String) == post.id
        ).first()

        if existing_job:
            continue  # Skip if already queued

        # Determine priority based on post age
        # Higher priority (lower number) for newer posts
        post_age = now - post.posted_at
        if post_age < timedelta(days=1):
            priority = 20  # High priority for posts < 1 day old
        else:
            priority = 50  # Medium priority for older posts

        # Create rescrape job
        job = ScraperJob(
            job_type="comment_rescrape",
            status="pending",
            priority=priority,
            config={
                "post_id": post.id,
                "subreddit": post.subreddit
            }
        )
        db.add(job)
        jobs_created += 1

    if jobs_created > 0:
        db.commit()
        print(f"📝 Queued {jobs_created} comment rescrape jobs")

    return jobs_created


def cleanup_stale_jobs(db: Session):
    """Mark stale running jobs as failed on worker startup."""
    try:
        # Mark any jobs that have been "running" for more than 30 minutes as failed
        from datetime import timedelta
        thirty_minutes_ago = datetime.utcnow() - timedelta(minutes=30)
        stale_jobs = db.query(ScraperRun).filter(
            ScraperRun.status == "running",
            ScraperRun.started_at < thirty_minutes_ago
        ).all()

        if stale_jobs:
            print(f"🧹 Cleaning up {len(stale_jobs)} stale running jobs...")
            for job in stale_jobs:
                job.status = "failed"
                job.error_message = "Job marked as stale (worker restart/crash)"
                job.completed_at = job.started_at + timedelta(minutes=1)
                job.duration_seconds = 60
            db.commit()
            print(f"✅ Cleaned up {len(stale_jobs)} stale jobs")
    except Exception as e:
        print(f"❌ Error cleaning up stale jobs: {e}")
        db.rollback()


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

    # Clean up any stale jobs from previous crashes/restarts
    cleanup_stale_jobs(db)

    print("✅ Worker ready - waiting for jobs...")
    print("📝 Note: Comment rescraping is now handled by dedicated comment-scraper service")

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
