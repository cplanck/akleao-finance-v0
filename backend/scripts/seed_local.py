"""Seed local database with test data for development."""
import sys
import os
from datetime import datetime, timedelta

# Add shared module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../shared"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shared.models.position import Position

# Local database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://akleao:akleao_dev_password@localhost:5432/akleao")

print(f"🔗 Connecting to: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

print("📊 Seeding test data...")

# Sample positions for testing
test_positions = [
    {
        "stock_symbol": "AAPL",
        "shares": 10,
        "entry_price": 150.00,
        "entry_date": datetime.now() - timedelta(days=365),
        "notes": "Long-term hold on Apple - bought a year ago"
    },
    {
        "stock_symbol": "TSLA",
        "shares": 5,
        "entry_price": 200.00,
        "entry_date": datetime.now() - timedelta(days=180),
        "notes": "Tesla position from 6 months ago"
    },
    {
        "stock_symbol": "NVDA",
        "shares": 15,
        "entry_price": 450.00,
        "entry_date": datetime.now() - timedelta(days=90),
        "notes": "AI boom play"
    },
    {
        "stock_symbol": "ASTS",
        "shares": 100,
        "entry_price": 5.50,
        "entry_date": datetime.now() - timedelta(days=365),
        "notes": "Space mobile bet - huge growth!"
    },
    {
        "stock_symbol": "SPY",
        "shares": 20,
        "entry_price": 400.00,
        "entry_date": datetime.now() - timedelta(days=90),
        "notes": "Index fund baseline for comparison"
    },
]

# Add positions
user_id = "test_user"
count = 0

for pos_data in test_positions:
    # Check if position already exists
    existing = session.query(Position).filter(
        Position.user_id == user_id,
        Position.stock_symbol == pos_data["stock_symbol"]
    ).first()

    if not existing:
        position = Position(
            user_id=user_id,
            stock_symbol=pos_data["stock_symbol"],
            shares=pos_data["shares"],
            entry_price=pos_data["entry_price"],
            entry_date=pos_data["entry_date"],
            is_active=True,
            notes=pos_data["notes"]
        )
        session.add(position)
        count += 1
        print(f"  ✅ Added {pos_data['stock_symbol']} position")
    else:
        print(f"  ⏭️  Skipped {pos_data['stock_symbol']} (already exists)")

session.commit()
session.close()

print(f"\n✨ Seeding complete! Added {count} new positions.")
print(f"📝 Total positions in database: {count + (len(test_positions) - count)}")
