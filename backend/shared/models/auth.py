"""
Better Auth table models.

These models reflect the tables created by Better Auth.
They are marked as __table_args__ = {'extend_existing': True} to prevent
Alembic from trying to recreate or modify them.

DO NOT modify these schemas - they must match what Better Auth expects.
"""

from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from .base import Base


class BetterAuthUser(Base):
    """Better Auth user table - managed by Better Auth library."""
    __tablename__ = "user"
    __table_args__ = {'extend_existing': True}

    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    emailVerified = Column(Boolean, nullable=False, default=False)
    image = Column(Text)
    role = Column(String(50), nullable=False, server_default='user')
    createdAt = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updatedAt = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class BetterAuthSession(Base):
    """Better Auth session table - managed by Better Auth library."""
    __tablename__ = "session"
    __table_args__ = {'extend_existing': True}

    id = Column(Text, primary_key=True)
    userId = Column(Text, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    expiresAt = Column(DateTime, nullable=False)
    token = Column(Text, unique=True, nullable=False)
    ipAddress = Column(Text)
    userAgent = Column(Text)
    createdAt = Column(DateTime, server_default=func.current_timestamp())
    updatedAt = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class BetterAuthAccount(Base):
    """Better Auth account table - managed by Better Auth library."""
    __tablename__ = "account"
    __table_args__ = {'extend_existing': True}

    id = Column(Text, primary_key=True)
    userId = Column(Text, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    accountId = Column(Text, nullable=False)
    providerId = Column(Text, nullable=False)
    accessToken = Column(Text)
    refreshToken = Column(Text)
    idToken = Column(Text)
    expiresAt = Column(DateTime)
    accessTokenExpiresAt = Column(DateTime)
    refreshTokenExpiresAt = Column(DateTime)
    scope = Column(Text)
    password = Column(Text)
    createdAt = Column(DateTime, server_default=func.current_timestamp())
    updatedAt = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class BetterAuthVerification(Base):
    """Better Auth verification table - managed by Better Auth library."""
    __tablename__ = "verification"
    __table_args__ = {'extend_existing': True}

    id = Column(Text, primary_key=True)
    identifier = Column(Text, nullable=False)
    value = Column(Text, nullable=False)
    expiresAt = Column(DateTime, nullable=False)
    createdAt = Column(DateTime, server_default=func.current_timestamp())
    updatedAt = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class PinnedStock(Base):
    """User pinned stocks - managed by frontend."""
    __tablename__ = "pinned_stocks"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Text, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(10), nullable=False)
    pinned_at = Column(DateTime, server_default=func.current_timestamp())
    position = Column(Integer, nullable=False, default=0)


class UserApiKey(Base):
    """User API keys - managed by frontend."""
    __tablename__ = "user_api_keys"
    __table_args__ = {'extend_existing': True, 'comment': 'Stores encrypted OpenAI API keys per user'}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Text, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, unique=True)
    encrypted_key = Column(Text, nullable=False, comment='AES-256 encrypted API key')
    created_at = Column(DateTime, server_default=func.current_timestamp())
    updated_at = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class OpenAIUsage(Base):
    """OpenAI API usage tracking - managed by frontend."""
    __tablename__ = "openai_usage"
    __table_args__ = {'extend_existing': True, 'comment': 'Tracks OpenAI API usage and estimated costs per user per day'}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Text, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    request_count = Column(Integer, nullable=False, default=0)
    tokens_used = Column(Integer, nullable=False, default=0)
    estimated_cost = Column(Integer, nullable=False, default=0)  # Stored in cents
    last_request_at = Column(DateTime, server_default=func.current_timestamp())
    date = Column(DateTime, nullable=False, server_default=func.current_timestamp())
