"""Generate realistic test data that mimics production volumes and patterns."""
import sys
import os
import random
from datetime import datetime, timedelta
from typing import List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../shared"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shared.models.position import Position
from shared.models.reddit_post import RedditPost
from shared.models.stock import Stock

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://akleao:akleao_dev_password@localhost:5432/akleao")

print(f"🔗 Connecting to: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Realistic stock symbols users might track
POPULAR_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "BRK.B",
    "JPM", "V", "UNH", "MA", "HD", "PG", "JNJ", "BAC", "ABBV", "CVX",
    "LLY", "AVGO", "MRK", "KO", "PEP", "COST", "WMT", "MCD", "CSCO",
    "ASTS", "PLTR", "RIVN", "LCID", "SOFI", "NIO", "F", "INTC", "AMD"
]

# Sample Reddit subreddits
SUBREDDITS = [
    "wallstreetbets", "stocks", "investing", "options", "thetagang",
    "ValueInvesting", "Daytrading", "StockMarket", "pennystocks"
]

print("📊 Generating realistic test data...\n")

# 1. Create test users
print("👥 Creating test users...")
TEST_USERS = [
    "alice_investor",
    "bob_trader",
    "charlie_hodler",
    "diana_daytrader",
    "evan_analyst"
]
print(f"   Created {len(TEST_USERS)} test users")

# 2. Generate positions (simulate real user behavior)
print("\n💼 Generating positions...")

def random_date_in_past(max_days=730):
    """Generate random date in the past 2 years."""
    return datetime.now() - timedelta(days=random.randint(1, max_days))

def generate_realistic_price(symbol: str) -> float:
    """Generate realistic stock prices."""
    price_ranges = {
        "AAPL": (150, 200),
        "TSLA": (150, 300),
        "NVDA": (400, 800),
        "ASTS": (2, 30),
        "SPY": (380, 480),
    }
    range_tuple = price_ranges.get(symbol, (50, 500))
    return round(random.uniform(*range_tuple), 2)

positions_data = []
for user in TEST_USERS:
    # Each user has 3-15 positions
    num_positions = random.randint(3, 15)
    user_stocks = random.sample(POPULAR_STOCKS, num_positions)

    for stock in user_stocks:
        entry_date = random_date_in_past(730)
        entry_price = generate_realistic_price(stock)
        shares = random.choice([1, 5, 10, 15, 25, 50, 100])

        # 80% active, 20% closed
        is_active = random.random() < 0.8

        notes_options = [
            f"Long-term hold on {stock}",
            f"Buying the dip on {stock}",
            f"Growth play - {stock} looks promising",
            f"Diversification into {stock}",
            None,  # Some positions have no notes
        ]

        position_data = {
            "user_id": user,
            "stock_symbol": stock,
            "shares": shares,
            "entry_price": entry_price,
            "entry_date": entry_date,
            "is_active": is_active,
            "notes": random.choice(notes_options),
        }

        if not is_active:
            # Closed positions have exit data
            exit_date = entry_date + timedelta(days=random.randint(7, 180))
            exit_price = entry_price * random.uniform(0.7, 1.5)  # -30% to +50%
            position_data["exit_date"] = exit_date
            position_data["exit_price"] = round(exit_price, 2)

        positions_data.append(position_data)

# Bulk insert positions
position_count = 0
for pos_data in positions_data:
    position = Position(**pos_data)
    session.add(position)
    position_count += 1

session.commit()
print(f"   Created {position_count} positions across {len(TEST_USERS)} users")

# 3. Generate tracked stocks
print("\n📈 Generating tracked stocks...")
stock_count = 0
for symbol in POPULAR_STOCKS[:20]:  # Track top 20 stocks
    # Check if already exists
    existing = session.query(Stock).filter(Stock.symbol == symbol).first()
    if not existing:
        stock = Stock(
            symbol=symbol,
            name=f"{symbol} Inc.",  # Simplified
            sector=random.choice(["Technology", "Finance", "Healthcare", "Energy", "Consumer"]),
            is_tracked=True,
            last_updated=datetime.now()
        )
        session.add(stock)
        stock_count += 1

session.commit()
print(f"   Created {stock_count} tracked stocks")

# 4. Generate Reddit posts
print("\n💬 Generating Reddit posts...")

POST_TITLES = [
    "{stock} DD - Why I'm bullish",
    "{stock} earnings play - thoughts?",
    "Just YOLO'd into {stock}",
    "{stock} technical analysis",
    "Why {stock} is undervalued",
    "{stock} to the moon! 🚀",
    "Is {stock} a buy right now?",
    "{stock} will print tendies",
]

post_count = 0
for _ in range(100):  # Generate 100 posts
    stock = random.choice(POPULAR_STOCKS[:15])
    subreddit = random.choice(SUBREDDITS)
    title = random.choice(POST_TITLES).format(stock=stock)

    post = RedditPost(
        reddit_id=f"test_{random.randint(100000, 999999)}",
        subreddit=subreddit,
        title=title,
        content=f"This is a test post about {stock}. " * random.randint(5, 20),
        author=f"reddit_user_{random.randint(1, 1000)}",
        url=f"https://reddit.com/r/{subreddit}/comments/test_{random.randint(100000, 999999)}",
        score=random.randint(1, 5000),
        num_comments=random.randint(0, 500),
        mentioned_stocks=[stock],
        primary_stock=stock,
        posted_at=random_date_in_past(90),  # Posts from last 3 months
    )
    session.add(post)
    post_count += 1

session.commit()
print(f"   Created {post_count} Reddit posts")

# Summary
print("\n" + "="*60)
print("✨ Realistic test data generation complete!")
print("="*60)
print(f"👥 Users:          {len(TEST_USERS)}")
print(f"💼 Positions:      {position_count}")
print(f"📈 Tracked Stocks: {stock_count}")
print(f"💬 Reddit Posts:   {post_count}")
print("\n🎯 Your local database now has production-like data volumes!")
print("   You can develop and test with realistic scenarios.\n")

session.close()
