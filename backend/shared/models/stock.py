"""Stock model."""

from sqlalchemy import Column, String, Float, Integer
from .base import Base, TimestampMixin


class Stock(Base, TimestampMixin):
    """Stock information table."""

    __tablename__ = "stocks"

    symbol = Column(String(10), primary_key=True)
    name = Column(String(255), nullable=False)
    sector = Column(String(100))
    industry = Column(String(100))

    # Latest price data (cached)
    price = Column(Float)
    market_cap = Column(Float)
    pe_ratio = Column(Float)
    eps = Column(Float)
    dividend_yield = Column(Float)
    beta = Column(Float)
    week_52_high = Column(Float)
    week_52_low = Column(Float)

    # Sentiment scores
    reddit_sentiment = Column(Float)  # -1 to 1
    news_sentiment = Column(Float)  # -1 to 1
    overall_sentiment = Column(Float)  # -1 to 1

    # Engagement metrics
    reddit_mentions_24h = Column(Integer, default=0)
    reddit_mentions_7d = Column(Integer, default=0)
    news_articles_24h = Column(Integer, default=0)
    news_articles_7d = Column(Integer, default=0)
