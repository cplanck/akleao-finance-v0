"""Scheduler service - creates scraper jobs at regular intervals."""

import os
import time
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import sys
sys.path.insert(0, "../../shared")
from shared.models.scraper_job import ScraperJob
from shared.models.tracked_subreddit import TrackedSubreddit

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL")
SCRAPE_INTERVAL_MINUTES = int(os.getenv("SCRAPE_INTERVAL_MINUTES", "15"))


def get_active_subreddits(db: Session) -> list[str]:
    """Load active subreddits from database."""
    subreddits = db.query(TrackedSubreddit).filter(
        TrackedSubreddit.is_active == True
    ).all()
    return [sub.subreddit_name for sub in subreddits]


def create_scheduled_job(db: Session) -> int:
    """Create a scheduled scraper job for all active subreddits.

    Returns:
        The job ID of the created job
    """
    # Get all active subreddits
    subreddit_names = get_active_subreddits(db)

    if not subreddit_names:
        print("⚠️  No active subreddits to schedule")
        return None

    # Create a scheduled scraper job
    scraper_job = ScraperJob(
        job_type="scheduled_scrape",
        status="pending",
        priority=5,  # Normal priority for scheduled jobs
        config={"subreddits": subreddit_names},
        created_at=datetime.utcnow()
    )
    db.add(scraper_job)
    db.commit()
    db.refresh(scraper_job)

    print(f"✅ Created scheduled job #{scraper_job.id} for {len(subreddit_names)} subreddits")
    return scraper_job.id


def main():
    """Main scheduler loop - creates jobs at regular intervals."""
    print("🚀 Starting Reddit Scraper Scheduler")
    print(f"⏱️  Schedule interval: {SCRAPE_INTERVAL_MINUTES} minutes")

    # Initialize database connection
    engine = create_engine(DATABASE_URL)
    db = Session(engine)

    print("✅ Scheduler ready - will create jobs at regular intervals")

    while True:
        try:
            print(f"\n📅 {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} - Creating scheduled scraper job...")

            job_id = create_scheduled_job(db)

            if job_id:
                print(f"📊 Job #{job_id} queued and ready for processing")

            # Sleep until next scheduled run
            sleep_seconds = SCRAPE_INTERVAL_MINUTES * 60
            print(f"😴 Sleeping for {SCRAPE_INTERVAL_MINUTES} minutes until next scheduled job...")
            time.sleep(sleep_seconds)

        except KeyboardInterrupt:
            print("\n👋 Shutting down Reddit Scraper Scheduler...")
            break
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            print("⏸️  Waiting 1 minute before retry...")
            time.sleep(60)


if __name__ == "__main__":
    main()
