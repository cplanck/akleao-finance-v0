"""Research report model."""

from sqlalchemy import Column, String, Text, Float, Integer, ForeignKey, Boolean
from .base import Base, TimestampMixin


class ResearchReport(Base, TimestampMixin):
    """Deep research report on a stock."""

    __tablename__ = "research_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String(10), ForeignKey("stocks.symbol"), nullable=False, index=True)
    report_type = Column(String(50), nullable=False)  # earnings, analysis, deep_dive, etc.

    # Content
    title = Column(String(500), nullable=False)
    executive_summary = Column(Text)  # Short summary
    full_report = Column(Text)  # Full AI-generated report
    key_findings = Column(Text)  # JSON array of bullet points

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
