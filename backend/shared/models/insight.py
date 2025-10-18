"""User-personalized insight model."""

from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime
from .base import Base, TimestampMixin


class UserInsight(Base, TimestampMixin):
    """Personalized insight for 'For You' page."""

    __tablename__ = "user_insights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), nullable=False, index=True)  # User identifier
    stock_symbol = Column(String(10), index=True)  # Can be null for general insights

    # Insight details
    insight_type = Column(String(50), nullable=False)  # trending, opportunity, alert, news, etc.
    priority = Column(Integer, default=5)  # 1 (low) to 10 (high)
    category = Column(String(50))  # value, growth, dividend, risk

    # Content
    title = Column(String(500), nullable=False)
    summary = Column(Text, nullable=False)
    detailed_content = Column(Text)  # Optional longer explanation
    action_items = Column(Text)  # JSON array of suggested actions

    # Scoring
    relevance_score = Column(Float, nullable=False)  # 0 to 1
    confidence_score = Column(Float)  # 0 to 1
    urgency_level = Column(String(20))  # low, medium, high, urgent

    # Data sources
    based_on_sources = Column(Text)  # JSON array of data sources used
    related_data_ids = Column(Text)  # JSON array of related post/article IDs

    # User interaction
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    is_bookmarked = Column(Boolean, default=False)
    read_at = Column(DateTime)

    # Expiration
    expires_at = Column(DateTime)  # When this insight becomes stale
    is_expired = Column(Boolean, default=False)
