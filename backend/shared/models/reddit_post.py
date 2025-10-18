"""Reddit post and comment models."""

from sqlalchemy import Column, String, Integer, Float, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


class RedditPost(Base, TimestampMixin):
    """Reddit post/submission."""

    __tablename__ = "reddit_posts"

    id = Column(String(20), primary_key=True)  # Reddit post ID
    subreddit = Column(String(50), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    author = Column(String(100))
    content = Column(Text)
    url = Column(String(500))
    score = Column(Integer, default=0)
    upvote_ratio = Column(Float)
    num_comments = Column(Integer, default=0)

    # Stock mentions
    mentioned_stocks = Column(Text)  # JSON array of symbols
    primary_stock = Column(String(10), ForeignKey("stocks.symbol"), index=True)

    # Sentiment
    sentiment_score = Column(Float)  # -1 to 1
    sentiment_label = Column(String(20))  # positive, negative, neutral
    sentiment_confidence = Column(Float)  # 0 to 1

    # Processing flags
    is_processed = Column(Boolean, default=False)
    is_relevant = Column(Boolean, default=True)

    # Relationships
    comments = relationship("RedditComment", back_populates="post")


class RedditComment(Base, TimestampMixin):
    """Reddit comment."""

    __tablename__ = "reddit_comments"

    id = Column(String(20), primary_key=True)  # Reddit comment ID
    post_id = Column(String(20), ForeignKey("reddit_posts.id"), nullable=False, index=True)
    author = Column(String(100))
    content = Column(Text, nullable=False)
    score = Column(Integer, default=0)

    # Stock mentions
    mentioned_stocks = Column(Text)  # JSON array of symbols

    # Sentiment
    sentiment_score = Column(Float)  # -1 to 1
    sentiment_label = Column(String(20))  # positive, negative, neutral
    sentiment_confidence = Column(Float)  # 0 to 1

    # Processing flags
    is_processed = Column(Boolean, default=False)
    is_relevant = Column(Boolean, default=True)

    # Relationships
    post = relationship("RedditPost", back_populates="comments")
