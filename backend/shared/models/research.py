"""Research report model."""

from sqlalchemy import Column, String, Text, Float, Integer, ForeignKey, Boolean, DateTime
from datetime import datetime
from .base import Base, TimestampMixin


class ResearchReport(Base, TimestampMixin):
    """Deep research report on a stock."""

    __tablename__ = "research_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String(10), ForeignKey("stocks.symbol"), nullable=False, index=True)
    report_type = Column(String(50), nullable=False, default="deep_dive")  # earnings, analysis, deep_dive, etc.

    # Status tracking
    status = Column(String(20), nullable=False, default="pending")  # pending, generating, completed, failed
    progress_percentage = Column(Integer, default=0)  # 0-100
    current_section = Column(String(100))  # Which section is being generated
    error_message = Column(Text)  # If failed

    # Content
    title = Column(String(500), nullable=False)
    executive_summary = Column(Text)  # Short summary
    full_report = Column(Text)  # Full AI-generated report (markdown)
    key_findings = Column(Text)  # JSON array of bullet points

    # Streaming sections (stored as they're generated)
    section_overview = Column(Text)  # Company overview section
    section_financials = Column(Text)  # Financial analysis section
    section_sentiment = Column(Text)  # Market sentiment section
    section_risks = Column(Text)  # Risks and challenges section
    section_opportunities = Column(Text)  # Opportunities section
    section_recommendation = Column(Text)  # Final recommendation section
    section_references = Column(Text)  # References and sources section

    # Scoring
    investment_score = Column(Float)  # 0 to 100
    risk_level = Column(String(20))  # low, medium, high
    confidence_level = Column(Float)  # 0 to 1

    # Sources
    sources_used = Column(Text)  # JSON array of source URLs
    data_quality_score = Column(Float)  # 0 to 1

    # Analysis components
    fundamental_analysis = Column(Text)  # JSON object
    technical_analysis = Column(Text)  # JSON object
    sentiment_analysis = Column(Text)  # JSON object
    competitive_analysis = Column(Text)  # JSON object

    # Recommendations
    recommendation = Column(String(20))  # buy, hold, sell
    target_price = Column(Float)
    time_horizon = Column(String(20))  # short, medium, long

    # Processing
    is_published = Column(Boolean, default=False)
    processing_time_seconds = Column(Integer)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
