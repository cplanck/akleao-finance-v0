"""Scraper run tracking model."""

from sqlalchemy import Column, String, Integer, DateTime, Boolean, Float
from datetime import datetime
from .base import Base


class ScraperRun(Base):
    """Track scraper execution runs."""

    __tablename__ = "scraper_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_type = Column(String(50), nullable=False)  # 'reddit', 'news', etc.
    status = Column(String(20), nullable=False)  # 'running', 'completed', 'failed'
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime)
    duration_seconds = Column(Float)
    posts_collected = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    error_message = Column(String(500))
