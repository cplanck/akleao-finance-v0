"""TrackedSubreddit model - stores subreddits being monitored."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, func, JSON
from sqlalchemy.orm import relationship
from .base import Base


class TrackedSubreddit(Base):
    """Model for tracking subreddits that we scrape."""

    __tablename__ = "tracked_subreddits"

    id = Column(Integer, primary_key=True, index=True)
    subreddit_name = Column(String(255), nullable=False, unique=True)
    subscriber_count = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    last_scraped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Scrape settings
    scrape_sort = Column(String(20), nullable=False, default="hot", server_default="hot")  # hot, new, top, rising
    scrape_time_filter = Column(String(20), nullable=True)  # all, year, month, week, day, hour (for top/controversial)
    scrape_limit = Column(Integer, nullable=False, default=100, server_default="100")  # number of posts to fetch
    scrape_lookback_days = Column(Integer, nullable=False, default=7, server_default="7")  # how far back to process posts

    # Relationship to stock mappings
    stock_mappings = relationship("StockSubredditMapping", back_populates="subreddit", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<TrackedSubreddit(id={self.id}, name={self.subreddit_name}, active={self.is_active})>"


class StockSubredditMapping(Base):
    """Model for mapping stocks to relevant subreddits."""

    __tablename__ = "stock_subreddit_mappings"

    id = Column(Integer, primary_key=True, index=True)
    stock_symbol = Column(String(10), nullable=False, index=True)
    subreddit_id = Column(Integer, ForeignKey("tracked_subreddits.id", ondelete="CASCADE"), nullable=False, index=True)
    is_primary = Column(Boolean, nullable=False, default=False, server_default="false")
    relevance_score = Column(Float, nullable=True)
    discovered_by = Column(String(50), nullable=True)  # 'manual', 'ai', 'import', etc.
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    subreddit = relationship("TrackedSubreddit", back_populates="stock_mappings")

    def __repr__(self):
        return f"<StockSubredditMapping(id={self.id}, stock={self.stock_symbol}, subreddit_id={self.subreddit_id})>"
