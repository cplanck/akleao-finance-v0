"""Position model for tracking hypothetical stock positions."""

from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, Boolean
from .base import Base, TimestampMixin


class Position(Base, TimestampMixin):
    """Represents a hypothetical stock position for simulation."""

    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)  # User who created this position
    stock_symbol = Column(String, nullable=False, index=True)  # Stock ticker
    shares = Column(Float, nullable=False)  # Number of shares
    entry_price = Column(Float, nullable=False)  # Price per share at entry
    entry_date = Column(DateTime, nullable=False)  # When the position was opened
    exit_date = Column(DateTime, nullable=True)  # When the position was closed (null if still open)
    exit_price = Column(Float, nullable=True)  # Price per share at exit
    is_active = Column(Boolean, default=True, nullable=False)  # Whether position is still open
    notes = Column(String, nullable=True)  # Optional notes about the position

    @property
    def initial_value(self) -> float:
        """Calculate initial position value."""
        return self.shares * self.entry_price

    @property
    def current_value(self) -> float:
        """Calculate current position value (if closed, use exit price)."""
        if not self.is_active and self.exit_price:
            return self.shares * self.exit_price
        # For open positions, would need current price (calculated separately)
        return self.initial_value

    @property
    def total_return_pct(self) -> float:
        """Calculate total return percentage."""
        if not self.is_active and self.exit_price:
            return ((self.exit_price - self.entry_price) / self.entry_price) * 100
        return 0.0
