"""AI prompt management models for dynamic prompt configuration."""

from sqlalchemy import Column, String, Integer, Float, Text, Boolean
from .base import Base, TimestampMixin


class AIPrompt(Base, TimestampMixin):
    """Dynamic AI prompts for comment scoring and post analysis.

    Allows admins to tune prompts from the UI and A/B test different versions.
    """

    __tablename__ = "ai_prompts"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Prompt identification
    prompt_type = Column(String(50), nullable=False, index=True)  # "comment_scoring", "post_analysis", "cross_post_synthesis"
    version = Column(Integer, nullable=False, default=1)  # v1, v2, v3 for A/B testing
    name = Column(String(200))  # Human-readable name like "Conservative Scoring v2"
    description = Column(Text)  # Description of what this prompt does differently
    is_active = Column(Boolean, default=False, index=True)  # Only one version can be active per type

    # Prompt content (Jinja2 templates)
    system_prompt = Column(Text, nullable=False)
    user_prompt_template = Column(Text, nullable=False)  # Jinja2 template with variables like {{post.title}}

    # Model configuration
    model = Column(String(50), default="gpt-4o-mini")  # "gpt-4o-mini", "gpt-4o", etc.
    temperature = Column(Float, default=0.3)
    max_tokens = Column(Integer, nullable=True)  # NULL = use model default

    # Performance tracking
    avg_cost_per_call = Column(Float)  # Average cost in USD
    total_calls = Column(Integer, default=0)
    total_cost = Column(Float, default=0.0)
    avg_tokens_used = Column(Integer)
    success_rate = Column(Float)  # % of calls that succeeded (0-100)

    # Metadata
    created_by = Column(String(100))  # User who created this prompt
    notes = Column(Text)  # Internal notes about this prompt version
