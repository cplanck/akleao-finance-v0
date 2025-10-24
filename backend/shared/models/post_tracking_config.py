"""Post tracking configuration for dynamic re-analysis control."""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey
from .base import Base, TimestampMixin


class PostTrackingConfig(Base, TimestampMixin):
    """Per-post configuration for AI re-analysis triggers and tracking behavior.

    Allows admins to customize when and how often each post is re-analyzed,
    either on a time-based schedule or event-driven basis.
    """

    __tablename__ = "post_tracking_configs"

    post_id = Column(String(20), ForeignKey("reddit_posts.id"), primary_key=True)

    # Tracking mode
    mode = Column(String(20), default="moderate", index=True)
    # Options:
    # - "aggressive": Re-analyze every 30-60 minutes while active
    # - "moderate": Re-analyze every 2-4 hours
    # - "conservative": Re-analyze once per day
    # - "event_driven": Only re-analyze when triggers fire
    # - "paused": Don't re-analyze at all

    # Event-driven triggers (only used when mode is "event_driven" or as overrides)
    trigger_on_high_quality_comment = Column(Boolean, default=False)
    quality_threshold = Column(Float, default=0.8)  # Re-analyze if comment scores >= this

    trigger_on_comment_velocity = Column(Boolean, default=False)
    velocity_threshold = Column(Integer, default=10)  # Re-analyze if X+ comments in 1 hour

    trigger_on_sentiment_shift = Column(Boolean, default=False)
    sentiment_shift_threshold = Column(Float, default=0.15)  # Re-analyze if sentiment changes by 15%+

    # Time-based constraints (rate limiting)
    min_interval_minutes = Column(Integer, default=60)  # Never re-analyze more often than this
    max_interval_hours = Column(Integer, nullable=True)  # Must re-analyze at least this often (NULL = no max)

    # Auto-disable rules
    stop_after_hours = Column(Integer, default=24)  # Stop tracking X hours after post creation
    stop_if_no_new_comments_hours = Column(Integer, default=4)  # Stop if no new comments for X hours

    # State tracking
    last_analysis_at = Column(DateTime, nullable=True)
    analysis_count = Column(Integer, default=0)
    last_trigger_reason = Column(String(100))  # "aggressive_mode_interval", "high_quality_comment", etc.

    # Performance metadata
    total_cost = Column(Float, default=0.0)  # Total spent on analyzing this post
    avg_cost_per_analysis = Column(Float)
