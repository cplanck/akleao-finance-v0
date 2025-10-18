"""Reddit scraper worker - collects financial discussions from Reddit."""

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

# Configuration
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "AkleaoFinance/1.0")
DATABASE_URL = os.getenv("DATABASE_URL")
SCRAPE_INTERVAL_MINUTES = int(os.getenv("SCRAPE_INTERVAL_MINUTES", "15"))

# Subreddits to scrape
SUBREDDITS = [
    "wallstreetbets",
    "stocks",
    "investing",
    "StockMarket",
    "pennystocks",
    "Daytrading",
    "options"
]

# Stock ticker pattern (e.g., $AAPL, $TSLA)
TICKER_PATTERN = re.compile(r'\$([A-Z]{1,5})\b')


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


def process_submission(submission, subreddit_name: str, db: Session) -> bool:
    """Process a single Reddit submission. Returns True if saved, False if skipped."""
    # Skip if post already exists
    existing = db.query(RedditPost).filter(RedditPost.id == submission.id).first()
    if existing:
        return False

    # Extract stock mentions
    title_text = submission.title
    body_text = submission.selftext if hasattr(submission, 'selftext') else ""
    full_text = f"{title_text} {body_text}"

    mentioned_stocks = extract_stock_tickers(full_text)

    # Only process if stocks are mentioned or if it's a discussion post
    if not mentioned_stocks and subreddit_name not in ["investing", "stocks"]:
        return False

    # Ensure all mentioned stocks exist in the database
    for stock_symbol in mentioned_stocks:
        ensure_stock_exists(db, stock_symbol)

    # Create post record
    post = RedditPost(
        id=submission.id,
        subreddit=subreddit_name,
        title=title_text[:500],  # Truncate if too long
        author=str(submission.author) if submission.author else "[deleted]",
        content=body_text,
        url=submission.url,
        score=submission.score,
        upvote_ratio=submission.upvote_ratio,
        num_comments=submission.num_comments,
        mentioned_stocks=json.dumps(mentioned_stocks),
        primary_stock=mentioned_stocks[0] if mentioned_stocks else None,
        is_processed=False,
        is_relevant=len(mentioned_stocks) > 0,
        created_at=datetime.fromtimestamp(submission.created_utc)
    )

    db.add(post)
    print(f"  ✅ Saved post: {submission.id} - {title_text[:50]}...")

    # Scrape top comments
    submission.comments.replace_more(limit=0)  # Remove "More comments" objects
    for comment in submission.comments.list()[:20]:  # Top 20 comments
        if not hasattr(comment, 'body'):
            continue

        comment_stocks = extract_stock_tickers(comment.body)

        # Skip if no stocks mentioned and parent post has no stocks
        if not comment_stocks and not mentioned_stocks:
            continue

        # Check if comment already exists
        existing_comment = db.query(RedditComment).filter(
            RedditComment.id == comment.id
        ).first()
        if existing_comment:
            continue

        # Ensure all mentioned stocks exist in the database
        for stock_symbol in comment_stocks:
            ensure_stock_exists(db, stock_symbol)

        comment_record = RedditComment(
            id=comment.id,
            post_id=submission.id,
            author=str(comment.author) if comment.author else "[deleted]",
            content=comment.body[:5000],  # Truncate if too long
            score=comment.score,
            mentioned_stocks=json.dumps(comment_stocks),
            is_processed=False,
            is_relevant=len(comment_stocks) > 0 or len(mentioned_stocks) > 0,
            created_at=datetime.fromtimestamp(comment.created_utc)
        )

        db.add(comment_record)

    db.commit()
    return True


def scrape_subreddit(reddit: praw.Reddit, subreddit_name: str, db: Session):
    """Scrape posts from a subreddit using multiple feeds for comprehensive coverage."""
    print(f"📡 Scraping r/{subreddit_name}...")

    subreddit = reddit.subreddit(subreddit_name)
    posts_saved = 0

    # 1. Get HOT posts (trending right now)
    print(f"  🔥 Fetching hot posts...")
    for submission in subreddit.hot(limit=100):
        if process_submission(submission, subreddit_name, db):
            posts_saved += 1

    # 2. Get NEW posts (most recent, regardless of popularity)
    print(f"  🆕 Fetching new posts...")
    for submission in subreddit.new(limit=100):
        if process_submission(submission, subreddit_name, db):
            posts_saved += 1

    # 3. Get TOP posts from last 24 hours (highest scoring recent posts)
    print(f"  ⭐ Fetching top posts from last day...")
    for submission in subreddit.top(time_filter="day", limit=100):
        if process_submission(submission, subreddit_name, db):
            posts_saved += 1

    # 4. Get TOP posts from last week (catch anything that went viral)
    print(f"  🏆 Fetching top posts from last week...")
    for submission in subreddit.top(time_filter="week", limit=50):
        if process_submission(submission, subreddit_name, db):
            posts_saved += 1

    print(f"  ✨ Saved {posts_saved} new posts from r/{subreddit_name}")


def main():
    """Main scraper loop."""
    print("🚀 Starting Reddit Scraper Worker")
    print(f"📊 Monitoring subreddits: {', '.join(SUBREDDITS)}")
    print(f"⏱️  Scrape interval: {SCRAPE_INTERVAL_MINUTES} minutes")

    # Initialize Reddit API
    reddit = praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent=REDDIT_USER_AGENT
    )

    # Initialize database connection
    engine = create_engine(DATABASE_URL)
    db = Session(engine)

    while True:
        # Create scraper run record
        scraper_run = ScraperRun(
            run_type="reddit",
            status="running",
            started_at=datetime.utcnow(),
        )
        db.add(scraper_run)
        db.commit()

        posts_count = 0
        errors_count = 0
        start_time = datetime.utcnow()

        try:
            print(f"\n🔄 Starting scrape cycle at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

            for subreddit in SUBREDDITS:
                try:
                    # Count posts before scraping
                    posts_before = db.query(RedditPost).count()
                    scrape_subreddit(reddit, subreddit, db)
                    # Count posts after scraping
                    posts_after = db.query(RedditPost).count()
                    posts_count += (posts_after - posts_before)
                except Exception as e:
                    print(f"❌ Error scraping r/{subreddit}: {e}")
                    errors_count += 1

            # Mark run as completed
            completed_time = datetime.utcnow()
            duration = (completed_time - start_time).total_seconds()

            scraper_run.status = "completed" if errors_count < len(SUBREDDITS) else "failed"
            scraper_run.completed_at = completed_time
            scraper_run.duration_seconds = duration
            scraper_run.posts_collected = posts_count
            scraper_run.errors_count = errors_count
            db.commit()

            print(f"✅ Scrape cycle complete")
            print(f"📊 Collected {posts_count} new posts in {duration:.1f}s")
            print(f"😴 Sleeping for {SCRAPE_INTERVAL_MINUTES} minutes...")

            time.sleep(SCRAPE_INTERVAL_MINUTES * 60)

        except KeyboardInterrupt:
            print("\n👋 Shutting down Reddit Scraper Worker...")
            break
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            print("⏸️  Waiting 5 minutes before retry...")
            time.sleep(300)  # Wait 5 minutes on error


if __name__ == "__main__":
    main()
