"""Post analysis model for AI-generated insights."""

from sqlalchemy import Column, String, Integer, Float, Text, ForeignKey, DateTime, JSON
from .base import Base, TimestampMixin


class PostAnalysis(Base, TimestampMixin):
    """AI-generated analysis of a Reddit post and its comments."""

    __tablename__ = "post_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(String(20), ForeignKey("reddit_posts.id"), nullable=False, index=True)
    stock_symbol = Column(String(10))  # Primary stock symbol identified by AI

    # Strategy metadata
    strategy_used = Column(String(20), nullable=False)  # 'preprocessed' or 'direct'
    comments_included = Column(Integer)
    comments_preprocessed = Column(Integer)  # NULL for direct strategy

    # Analysis results
    executive_summary = Column(Text)
    sentiment_breakdown = Column(JSON)  # {bullish: %, bearish: %, neutral: %}
    key_arguments = Column(JSON)  # [{type: 'bull/bear', summary: '...', quote: '...'}]
    thread_quality_score = Column(Float)  # 0-100 subjective quality rating
    notable_quotes = Column(JSON)  # [{quote: '...', author: '...', comment_id: '...'}]

    # Performance metrics
    model_used = Column(String(50))
    tokens_used = Column(Integer)
    processing_time_seconds = Column(Float)
    cost_estimate = Column(Float)
