"""Sentiment analysis aggregation model."""

from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from .base import Base, TimestampMixin


class SentimentAnalysis(Base, TimestampMixin):
    """Aggregated sentiment data for a stock over a time period."""

    __tablename__ = "sentiment_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String(10), ForeignKey("stocks.symbol"), nullable=False, index=True)
    period = Column(String(10), nullable=False)  # 1h, 24h, 7d, 30d
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)

    # Reddit sentiment
    reddit_sentiment_avg = Column(Float)  # -1 to 1
    reddit_posts_count = Column(Integer, default=0)
    reddit_comments_count = Column(Integer, default=0)
    reddit_total_score = Column(Integer, default=0)

    # News sentiment
    news_sentiment_avg = Column(Float)  # -1 to 1
    news_articles_count = Column(Integer, default=0)
    news_positive_count = Column(Integer, default=0)
    news_negative_count = Column(Integer, default=0)
    news_neutral_count = Column(Integer, default=0)

    # Overall sentiment
    overall_sentiment = Column(Float)  # -1 to 1
    sentiment_trend = Column(String(20))  # improving, declining, stable
    volatility = Column(Float)  # Standard deviation of sentiment scores

    # Key insights
    top_keywords = Column(String(500))  # JSON array of trending keywords
    notable_events = Column(String(500))  # JSON array of significant mentions
