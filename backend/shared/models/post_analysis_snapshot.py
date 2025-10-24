"""Post analysis snapshots for tracking sentiment evolution over time."""

from sqlalchemy import Column, String, Integer, Float, Text, ForeignKey, DateTime, JSON
from .base import Base, TimestampMixin


class PostAnalysisSnapshot(Base, TimestampMixin):
    """Time-series snapshots of post analysis to track sentiment evolution.

    Each snapshot represents the state of the discussion at a specific point in time.
    """

    __tablename__ = "post_analysis_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(String(20), ForeignKey("reddit_posts.id"), nullable=False, index=True)
    snapshot_number = Column(Integer, nullable=False)  # 1, 2, 3, etc. for this post
    analyzed_at = Column(DateTime, nullable=False, index=True)

    # Core analysis results (same as PostAnalysis)
    stock_symbol = Column(String(10))
    executive_summary = Column(Text)
    sentiment_breakdown = Column(JSON)  # {bullish: %, bearish: %, neutral: %}
    key_arguments = Column(JSON)  # [{type: 'bull/bear', summary: '...', quote: '...'}]
    thread_quality_score = Column(Float)  # 0-100
    notable_quotes = Column(JSON)

    # Evolution tracking (compare to previous snapshot)
    sentiment_shift_from_previous = Column(JSON)  # {bullish: +5, bearish: -3, neutral: -2}
    new_themes = Column(JSON)  # Themes that emerged since last snapshot
    quality_trajectory = Column(String(20))  # "improving", "stable", "declining"

    # Snapshot metadata
    comments_analyzed_in_window = Column(Integer)  # New comments since last snapshot
    total_comments_at_snapshot = Column(Integer)  # Total comments when snapshot was taken
    previous_snapshot_id = Column(Integer, ForeignKey("post_analysis_snapshots.id"), nullable=True)

    # Performance metrics
    strategy_used = Column(String(20))  # 'preprocessed' or 'direct'
    model_used = Column(String(50))
    tokens_used = Column(Integer)
    processing_time_seconds = Column(Float)
    cost_estimate = Column(Float)
    trigger_reason = Column(String(100))  # Why this snapshot was taken
