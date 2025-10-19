"""
Dedicated Comment Scraper Worker
Continuously monitors tracked posts and rescapes their comments.
"""

import os
import sys
import time
import praw
import re
import redis
import json
from datetime import datetime, timedelta
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

# Add shared models to path
sys.path.insert(0, "../shared")
from shared.models.reddit_post import RedditPost, RedditComment
from shared.models.scraper_run import ScraperRun
from shared.models.stock import Stock

# Stock ticker pattern (e.g., $AAPL, $TSLA)
TICKER_PATTERN = re.compile(r'\$([A-Z]{1,5})\b')

# Environment variables
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "akleao-comment-scraper/1.0")
DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Configuration
POST_DELAY_SECONDS = 2  # Delay between posts to respect Reddit rate limits (60/min = safe at 2s)
IDLE_SLEEP_SECONDS = 10  # Sleep when no tracked posts exist


def extract_stock_tickers(text: str) -> list[str]:
    """Extract stock tickers from text (e.g., $AAPL)."""
    if not text:
        return []
    tickers = TICKER_PATTERN.findall(text)
    return list(set(tickers))  # Remove duplicates


def rescrape_post_comments(reddit: praw.Reddit, post: RedditPost, db: Session, redis_client: redis.Redis) -> int:
    """Rescrape comments for a tracked post."""
    try:
        # Get current comment count before scraping
        existing_comments = post.num_comments

        # Store current post in Redis for real-time tracking
        redis_client.setex(
            "comment_scraper:current_post",
            10,  # Expire after 10 seconds
            json.dumps({
                "post_id": post.id,
                "subreddit": post.subreddit,
                "title": post.title[:100],  # Truncate title
                "existing_comments": existing_comments,
                "new_comments": 0,  # Will update after scraping
                "started_at": datetime.utcnow().isoformat()
            })
        )

        print(f"📝 Rescaping comments for post: {post.id} (r/{post.subreddit})")

        # Fetch the submission from Reddit
        submission = reddit.submission(id=post.id)

        # Update post metadata
        old_comment_count = post.num_comments
        post.num_comments = submission.num_comments
        post.score = submission.score
        post.upvote_ratio = submission.upvote_ratio

        print(f"   Post stats: {submission.num_comments} comments, score {submission.score}")

        # Fetch all comments (replace MoreComments objects)
        submission.comments.replace_more(limit=0)

        new_comments_count = 0

        # Process comments using DFS to capture depth
        def process_comment_tree(comment, depth=0):
            """Recursively process comments to capture threading structure."""
            nonlocal new_comments_count

            if isinstance(comment, praw.models.Comment):
                # Check if comment already exists
                existing_comment = db.query(RedditComment).filter(
                    RedditComment.id == comment.id
                ).first()

                # Determine parent_id
                # If parent is the submission itself, parent_id is None (top-level comment)
                parent_id = None
                if hasattr(comment, 'parent_id') and comment.parent_id:
                    parent_reddit_id = comment.parent_id
                    # Reddit IDs are prefixed with type (t1_ for comment, t3_ for post)
                    # We only store parent_id if it's another comment (t1_)
                    if parent_reddit_id.startswith('t1_'):
                        parent_id = parent_reddit_id[3:]  # Remove 't1_' prefix
                    # If it starts with 't3_', it's the post itself, so parent_id stays None

                if not existing_comment:
                    # Extract stock symbols from comment
                    mentioned_stocks = extract_stock_tickers(comment.body)

                    # Create new comment
                    new_comment = RedditComment(
                        id=comment.id,
                        post_id=post.id,
                        author=str(comment.author) if comment.author else "[deleted]",
                        content=comment.body,
                        score=comment.score,
                        mentioned_stocks=str(mentioned_stocks) if mentioned_stocks else None,
                        parent_id=parent_id,
                        depth=depth,
                        is_processed=False,
                    )
                    db.add(new_comment)
                    new_comments_count += 1
                else:
                    # Update existing comment score and threading info
                    existing_comment.score = comment.score
                    existing_comment.parent_id = parent_id
                    existing_comment.depth = depth

                # Process replies recursively
                if hasattr(comment, 'replies') and comment.replies:
                    for reply in comment.replies:
                        process_comment_tree(reply, depth + 1)

        # Process all top-level comments and their replies
        for comment in submission.comments:
            process_comment_tree(comment, depth=0)

        # Update tracking metadata
        post.last_comment_scrape_at = datetime.utcnow()
        post.comment_scrape_count += 1

        db.commit()

        comment_growth = post.num_comments - old_comment_count
        print(f"   ✅ Scraped {new_comments_count} new comments (growth: +{comment_growth})")

        # Update Redis with final stats
        redis_client.setex(
            "comment_scraper:current_post",
            10,  # Keep visible for 10 seconds
            json.dumps({
                "post_id": post.id,
                "subreddit": post.subreddit,
                "title": post.title[:100],
                "existing_comments": existing_comments,
                "new_comments": new_comments_count,
                "started_at": datetime.utcnow().isoformat()
            })
        )

        return new_comments_count

    except Exception as e:
        print(f"   ❌ Error rescaping comments for post {post.id}: {e}")
        db.rollback()
        return 0


def get_all_tracked_posts(db: Session) -> list[RedditPost]:
    """Get all tracked posts for continuous scraping."""
    now = datetime.utcnow()

    # Find all posts that:
    # 1. Are being tracked (track_comments=True)
    # 2. Haven't expired (track_until > now)
    posts = db.query(RedditPost).filter(
        RedditPost.track_comments == True,
        RedditPost.track_until > now
    ).order_by(
        # Prioritize posts that have never been scraped
        RedditPost.last_comment_scrape_at.asc().nullsfirst(),
        # Then prioritize newer posts (more likely to have new comments)
        RedditPost.posted_at.desc()
    ).all()

    return posts


def create_scraper_run(db: Session) -> ScraperRun:
    """Create a new scraper run record."""
    run = ScraperRun(
        run_type="comment_scraper",
        status="running",
        started_at=datetime.utcnow(),
        posts_collected=0,
        comments_collected=0,
        errors_count=0
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def update_scraper_run(run: ScraperRun, posts: int, comments: int, db: Session):
    """Update scraper run with progress."""
    run.posts_collected += posts
    run.comments_collected += comments
    db.commit()


def complete_scraper_run(run: ScraperRun, db: Session):
    """Mark scraper run as completed."""
    run.status = "completed"
    run.completed_at = datetime.utcnow()
    run.duration_seconds = (run.completed_at - run.started_at).total_seconds()
    db.commit()


def main():
    """Main comment scraper loop - continuous mode."""
    print("🚀 Starting Continuous Comment Scraper Worker")
    print(f"⏱️  Post delay: {POST_DELAY_SECONDS} seconds (respecting Reddit rate limits)")
    print(f"💤 Idle sleep: {IDLE_SLEEP_SECONDS} seconds when no tracked posts")

    # Initialize Reddit API
    reddit = praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent=REDDIT_USER_AGENT
    )

    # Initialize database connection
    engine = create_engine(DATABASE_URL)
    db = Session(engine)

    # Initialize Redis connection
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    print("✅ Connected to Redis")

    print("✅ Comment scraper ready - continuous monitoring mode active!")

    current_run = None
    posts_processed_in_run = 0

    while True:
        try:
            # Get ALL tracked posts for continuous scraping
            tracked_posts = get_all_tracked_posts(db)

            if tracked_posts:
                # Create scraper run if we don't have one
                if not current_run:
                    current_run = create_scraper_run(db)
                    posts_processed_in_run = 0
                    print(f"\n🎬 Started scraper run #{current_run.id}")
                    print(f"📊 Found {len(tracked_posts)} tracked posts - beginning continuous loop\n")

                # Process each post continuously
                for post in tracked_posts:
                    comments_scraped = rescrape_post_comments(reddit, post, db, redis_client)
                    update_scraper_run(current_run, 1, comments_scraped, db)
                    posts_processed_in_run += 1

                    # Show progress every 10 posts
                    if posts_processed_in_run % 10 == 0:
                        print(f"   📈 Progress: {posts_processed_in_run}/{len(tracked_posts)} posts processed")

                    # Rate limiting delay between posts
                    time.sleep(POST_DELAY_SECONDS)

                # Completed full loop through all tracked posts
                print(f"\n✨ Completed loop - {current_run.posts_collected} posts, {current_run.comments_collected} comments")
                print(f"🔄 Starting next loop through tracked posts...\n")

                # Clear current post from Redis
                redis_client.delete("comment_scraper:current_post")

            else:
                # No tracked posts - complete current run if exists
                if current_run:
                    complete_scraper_run(current_run, db)
                    print(f"🏁 Completed scraper run #{current_run.id}")
                    print(f"   Total: {current_run.posts_collected} posts, {current_run.comments_collected} comments")
                    current_run = None
                    posts_processed_in_run = 0

                print(f"💤 No tracked posts - sleeping for {IDLE_SLEEP_SECONDS}s...")
                time.sleep(IDLE_SLEEP_SECONDS)

        except KeyboardInterrupt:
            print("\n👋 Shutting down comment scraper...")
            if current_run:
                complete_scraper_run(current_run, db)
                print(f"🏁 Completed final run #{current_run.id}")
            break

        except Exception as e:
            print(f"❌ Error in comment scraper loop: {e}")
            if current_run:
                current_run.errors_count += 1
                db.commit()
            time.sleep(SCAN_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
