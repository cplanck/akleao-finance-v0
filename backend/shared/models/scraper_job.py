"""Scraper job queue model - for batched processing of scraper tasks."""

from sqlalchemy import Column, String, Integer, DateTime, Text, JSON
from datetime import datetime
from .base import Base


class ScraperJob(Base):
    """Queue-based scraper jobs for batched processing by workers."""

    __tablename__ = "scraper_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Job metadata
    job_type = Column(String(50), nullable=False)  # 'subreddit_scrape', 'full_scrape', 'targeted_scrape'
    status = Column(String(20), nullable=False, default='pending')  # 'pending', 'processing', 'completed', 'failed'
    priority = Column(Integer, default=5)  # 1 = highest, 10 = lowest

    # Job configuration (JSON)
    config = Column(JSON, nullable=True)  # e.g., {"subreddits": ["wallstreetbets", "stocks"], "stock_symbol": "AAPL"}

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Results tracking
    posts_collected = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

    # Link to ScraperRun for detailed tracking
    scraper_run_id = Column(Integer, nullable=True)  # Foreign key to scraper_runs
