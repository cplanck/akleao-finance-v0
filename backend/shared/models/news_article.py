"""News article model."""

from sqlalchemy import Column, String, Text, Float, ForeignKey, Boolean
from .base import Base, TimestampMixin


class NewsArticle(Base, TimestampMixin):
    """Financial news article."""

    __tablename__ = "news_articles"

    id = Column(String(100), primary_key=True)  # URL hash or API ID
    source = Column(String(100), nullable=False)  # Bloomberg, Reuters, etc.
    title = Column(String(500), nullable=False)
    summary = Column(Text)
    content = Column(Text)
    url = Column(String(1000), nullable=False)
    author = Column(String(255))
    image_url = Column(String(1000))

    # Stock mentions
    mentioned_stocks = Column(Text)  # JSON array of symbols
    primary_stock = Column(String(10), ForeignKey("stocks.symbol"), index=True)

    # Sentiment
    sentiment_score = Column(Float)  # -1 to 1
    sentiment_label = Column(String(20))  # positive, negative, neutral
    sentiment_confidence = Column(Float)  # 0 to 1

    # Classification
    category = Column(String(50))  # earnings, merger, regulatory, etc.
    importance_score = Column(Float)  # 0 to 1

    # Processing flags
    is_processed = Column(Boolean, default=False)
    is_relevant = Column(Boolean, default=True)
