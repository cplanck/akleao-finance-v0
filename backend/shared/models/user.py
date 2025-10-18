"""User model for authentication and personalization."""

from sqlalchemy import Column, String, Boolean, DateTime, Text
from datetime import datetime
from .base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """User account."""

    __tablename__ = "users"

    id = Column(String(50), primary_key=True)  # UUID
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Profile
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Preferences
    investment_style = Column(String(50))  # value, growth, dividend, aggressive
    risk_tolerance = Column(String(50))  # conservative, moderate, aggressive
    preferred_sectors = Column(Text)  # JSON array
    watchlist_symbols = Column(Text)  # JSON array of stock symbols

    # Authentication
    last_login = Column(DateTime)
    email_verified_at = Column(DateTime)

    # Subscription/tier (for future monetization)
    tier = Column(String(20), default="free")  # free, pro, premium
