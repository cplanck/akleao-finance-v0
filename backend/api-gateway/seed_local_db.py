"""Seed script for local development database with sample Reddit posts and stocks."""

import sys
import os
import asyncio
from datetime import datetime, timedelta
import random
import json

# Add parent directory to path to import shared models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from shared.models.stock import Stock
from shared.models.reddit_post import RedditPost
from shared.models.auth import BetterAuthUser, PinnedStock
from shared.models.tracked_subreddit import TrackedSubreddit
from shared.models.position import Position
from shared.models.base import Base
import uuid
import hashlib

# Database URL for local dev
# Use 'postgres' hostname if running inside Docker, 'localhost' if running on host
import socket
try:
    # Try to resolve 'postgres' hostname (works inside Docker)
    socket.gethostbyname('postgres')
    DATABASE_URL = "postgresql+asyncpg://akleao:akleao_dev_password@postgres:5432/akleao"
except socket.gaierror:
    # Running on host machine
    DATABASE_URL = "postgresql+asyncpg://akleao:akleao_dev_password@localhost:5432/akleao"

# Sample stock data
SAMPLE_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology", "industry": "Consumer Electronics", "price": 178.50, "market_cap": 2800000000000},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "industry": "Software", "price": 378.90, "market_cap": 2810000000000},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology", "industry": "Internet Content", "price": 140.25, "market_cap": 1750000000000},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "industry": "Semiconductors", "price": 495.80, "market_cap": 1220000000000},
    {"symbol": "TSLA", "name": "Tesla, Inc.", "sector": "Consumer Cyclical", "industry": "Auto Manufacturers", "price": 248.50, "market_cap": 790000000000},
    {"symbol": "META", "name": "Meta Platforms Inc.", "sector": "Technology", "industry": "Internet Content", "price": 485.20, "market_cap": 1230000000000},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer Cyclical", "industry": "Internet Retail", "price": 178.30, "market_cap": 1850000000000},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "sector": "Technology", "industry": "Semiconductors", "price": 165.40, "market_cap": 267000000000},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financial Services", "industry": "Banks", "price": 198.75, "market_cap": 572000000000},
    {"symbol": "WMT", "name": "Walmart Inc.", "sector": "Consumer Defensive", "industry": "Discount Stores", "price": 167.20, "market_cap": 442000000000},
]

# Sample Reddit post templates
POST_TEMPLATES = [
    {
        "subreddit": "wallstreetbets",
        "title": "{stock} is massively undervalued right now - here's why",
        "content": "Been doing some DD on {stock} and I think the market is sleeping on this one. Recent earnings were solid and the fundamentals look strong. What do you all think?",
        "score_range": (50, 500),
        "comments_range": (10, 100)
    },
    {
        "subreddit": "stocks",
        "title": "Thoughts on {stock} long-term investment?",
        "content": "Considering adding {stock} to my portfolio for a 5-10 year hold. The company has strong fundamentals and a good track record. Anyone else holding this?",
        "score_range": (20, 200),
        "comments_range": (5, 50)
    },
    {
        "subreddit": "investing",
        "title": "{stock} earnings call - key takeaways",
        "content": "Just finished listening to the {stock} earnings call. Here are the main points:\n\n- Revenue up significantly YoY\n- Strong guidance for next quarter\n- New product launches planned\n\nOverall pretty bullish.",
        "score_range": (100, 800),
        "comments_range": (30, 150)
    },
    {
        "subreddit": "wallstreetbets",
        "title": "YOLO'd my savings into {stock} - wish me luck!",
        "content": "After weeks of analysis, I'm all in on {stock}. This is either going to be the best or worst decision of my life. To the moon! 🚀",
        "score_range": (200, 1000),
        "comments_range": (50, 300)
    },
    {
        "subreddit": "stocks",
        "title": "Why I'm bearish on {stock}",
        "content": "Unpopular opinion but I think {stock} is overvalued. The P/E ratio is too high and competition is increasing. Change my mind.",
        "score_range": (30, 300),
        "comments_range": (20, 150)
    },
    {
        "subreddit": "investing",
        "title": "Is now a good time to buy {stock}?",
        "content": "Been watching {stock} for a while and it's pulled back about 10% from its highs. Thinking of starting a position. What's your take?",
        "score_range": (15, 150),
        "comments_range": (10, 80)
    },
    {
        "subreddit": "wallstreetbets",
        "title": "{stock} technical analysis - bullish breakout incoming",
        "content": "Looking at the charts, {stock} is forming a bullish pattern. If it breaks above resistance, we could see a big move. Loading up on calls.",
        "score_range": (80, 600),
        "comments_range": (25, 120)
    },
    {
        "subreddit": "stocks",
        "title": "{stock} vs competitors - which is the better buy?",
        "content": "Comparing {stock} to its main competitors. While others might be cheaper, {stock} has better margins and growth prospects. Worth the premium?",
        "score_range": (40, 250),
        "comments_range": (15, 90)
    },
    {
        "subreddit": "investing",
        "title": "Added {stock} to my dividend portfolio today",
        "content": "Finally pulled the trigger on {stock}. The dividend yield is solid and the company has been increasing payouts consistently. Good addition for passive income.",
        "score_range": (25, 180),
        "comments_range": (8, 60)
    },
    {
        "subreddit": "wallstreetbets",
        "title": "{stock} post-market surge! What's happening?",
        "content": "Just saw {stock} jumping in after-hours trading. Any news? This could be huge for tomorrow!",
        "score_range": (150, 900),
        "comments_range": (40, 200)
    },
]


async def seed_database():
    """Seed the local database with sample data."""

    print("🌱 Starting database seeding...")

    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=True)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        # Seed test users (using Better Auth schema)
        print("\n👤 Seeding test users...")
        test_users = [
            {
                "id": str(uuid.uuid4()),
                "name": "Test User",
                "email": "test@akleao.com",
            },
            {
                "id": str(uuid.uuid4()),
                "name": "John Developer",
                "email": "dev@akleao.com",
            }
        ]

        user_ids = []
        for user_data in test_users:
            user = BetterAuthUser(
                id=user_data["id"],
                name=user_data["name"],
                email=user_data["email"],
                emailVerified=True,
                role="user",
                createdAt=datetime.utcnow(),
                updatedAt=datetime.utcnow()
            )
            session.add(user)
            user_ids.append(user.id)
            print(f"  ✓ Added user: {user.email} (password not set - use OAuth in dev)")

        await session.commit()
        print(f"✅ Seeded {len(test_users)} test users")

        # Seed tracked subreddits
        print("\n📡 Seeding tracked subreddits...")
        subreddits = [
            {"name": "wallstreetbets", "subscribers": 15000000, "limit": 200},
            {"name": "stocks", "subscribers": 5000000, "limit": 100},
            {"name": "investing", "subscribers": 2000000, "limit": 100},
            {"name": "StockMarket", "subscribers": 1500000, "limit": 50},
        ]

        for sub_data in subreddits:
            subreddit = TrackedSubreddit(
                subreddit_name=sub_data["name"],
                subscriber_count=sub_data["subscribers"],
                is_active=True,
                scrape_sort="hot",
                scrape_limit=sub_data["limit"],
                scrape_lookback_days=7,
                last_scraped_at=datetime.utcnow() - timedelta(minutes=random.randint(5, 60))
            )
            session.add(subreddit)
            print(f"  ✓ Added subreddit: r/{subreddit.subreddit_name}")

        await session.commit()
        print(f"✅ Seeded {len(subreddits)} tracked subreddits")

        # Seed stocks
        print("\n📊 Seeding stocks...")
        for stock_data in SAMPLE_STOCKS:
            stock = Stock(
                symbol=stock_data["symbol"],
                name=stock_data["name"],
                sector=stock_data.get("sector"),
                industry=stock_data.get("industry"),
                price=stock_data.get("price"),
                market_cap=stock_data.get("market_cap"),
                pe_ratio=random.uniform(15, 40),
                eps=random.uniform(2, 15),
                dividend_yield=random.uniform(0, 3),
                beta=random.uniform(0.8, 1.5),
                reddit_mentions_24h=random.randint(0, 100),
                reddit_mentions_7d=random.randint(50, 500),
            )
            session.add(stock)
            print(f"  ✓ Added {stock.symbol} - {stock.name}")

        await session.commit()
        print(f"✅ Seeded {len(SAMPLE_STOCKS)} stocks")

        # Seed pinned stocks for test users
        print("\n📌 Seeding pinned stocks...")
        pinned_count = 0
        for user_id in user_ids:
            # Pin 3-5 random stocks for each user
            num_pins = random.randint(3, 5)
            pinned_stocks = random.sample(SAMPLE_STOCKS, num_pins)

            for idx, stock_data in enumerate(pinned_stocks):
                pinned = PinnedStock(
                    user_id=user_id,
                    symbol=stock_data["symbol"],
                    position=idx,
                    pinned_at=datetime.utcnow() - timedelta(days=random.randint(0, 30))
                )
                session.add(pinned)
                pinned_count += 1

        await session.commit()
        print(f"✅ Seeded {pinned_count} pinned stocks")

        # Seed some hypothetical positions
        print("\n💼 Seeding hypothetical positions...")
        position_count = 0
        for user_id in user_ids:
            # Create 2-4 positions for each user
            num_positions = random.randint(2, 4)
            position_stocks = random.sample(SAMPLE_STOCKS, num_positions)

            for stock_data in position_stocks:
                # Random entry date in the last 90 days
                days_ago = random.randint(1, 90)
                entry_date = datetime.utcnow() - timedelta(days=days_ago)
                entry_price = stock_data["price"] * random.uniform(0.85, 1.15)
                shares = random.choice([10, 25, 50, 100, 200])

                # 30% chance position is closed
                is_active = random.random() > 0.3
                exit_date = None
                exit_price = None

                if not is_active:
                    exit_days_ago = random.randint(0, days_ago - 1)
                    exit_date = datetime.utcnow() - timedelta(days=exit_days_ago)
                    # Exit price could be higher or lower than entry
                    exit_price = entry_price * random.uniform(0.90, 1.20)

                position = Position(
                    user_id=user_id,
                    stock_symbol=stock_data["symbol"],
                    shares=shares,
                    entry_price=entry_price,
                    entry_date=entry_date,
                    exit_date=exit_date,
                    exit_price=exit_price,
                    is_active=is_active,
                    notes=f"Test position for {stock_data['symbol']}" if random.random() > 0.5 else None
                )
                session.add(position)
                position_count += 1

        await session.commit()
        print(f"✅ Seeded {position_count} hypothetical positions")

        # Seed Reddit posts
        print("\n💬 Seeding Reddit posts...")

        post_count = 0
        # Create posts over the last 48 hours
        for hours_ago in range(48, 0, -2):  # One post every 2 hours
            # Pick a random stock
            stock = random.choice(SAMPLE_STOCKS)

            # Pick a random template
            template = random.choice(POST_TEMPLATES)

            # Generate post
            posted_at = datetime.utcnow() - timedelta(hours=hours_ago)
            created_at = posted_at + timedelta(minutes=random.randint(1, 30))

            score = random.randint(*template["score_range"])
            num_comments = random.randint(*template["comments_range"])

            # Randomly mention 1-3 stocks
            mentioned = [stock["symbol"]]
            if random.random() > 0.6:
                other_stocks = [s["symbol"] for s in SAMPLE_STOCKS if s["symbol"] != stock["symbol"]]
                mentioned.extend(random.sample(other_stocks, random.randint(0, 2)))

            post = RedditPost(
                id=f"post_{post_count:04d}",
                subreddit=template["subreddit"],
                title=template["title"].format(stock=stock["symbol"]),
                content=template["content"].format(stock=stock["symbol"]),
                author=f"user_{random.randint(1000, 9999)}",
                url=f"https://reddit.com/r/{template['subreddit']}/comments/post_{post_count:04d}",
                score=score,
                upvote_ratio=random.uniform(0.75, 0.98),
                num_comments=num_comments,
                mentioned_stocks=json.dumps(mentioned),
                primary_stock=stock["symbol"],
                sentiment_score=random.uniform(-0.3, 0.7),
                sentiment_label=random.choice(["positive", "neutral", "negative"]),
                sentiment_confidence=random.uniform(0.6, 0.95),
                is_processed=True,
                is_relevant=True,
                posted_at=posted_at,
                created_at=created_at,
                track_comments=random.random() > 0.7,
                initial_num_comments=num_comments,
            )

            session.add(post)
            post_count += 1

            if post_count % 5 == 0:
                print(f"  ✓ Added {post_count} posts...")

        # Add some very recent "hot" posts from the last 6 hours
        print("\n🔥 Adding hot recent posts...")
        for i in range(15):
            stock = random.choice(SAMPLE_STOCKS)
            template = random.choice(POST_TEMPLATES)

            hours_ago = random.uniform(0.5, 6)
            posted_at = datetime.utcnow() - timedelta(hours=hours_ago)
            created_at = posted_at + timedelta(minutes=random.randint(1, 10))

            # Hot posts have higher engagement
            score = random.randint(300, 2000)
            num_comments = random.randint(50, 400)

            mentioned = [stock["symbol"]]
            if random.random() > 0.5:
                other_stocks = [s["symbol"] for s in SAMPLE_STOCKS if s["symbol"] != stock["symbol"]]
                mentioned.extend(random.sample(other_stocks, random.randint(0, 2)))

            post = RedditPost(
                id=f"hot_{i:04d}",
                subreddit=random.choice(["wallstreetbets", "stocks", "investing"]),
                title=template["title"].format(stock=stock["symbol"]),
                content=template["content"].format(stock=stock["symbol"]),
                author=f"user_{random.randint(1000, 9999)}",
                url=f"https://reddit.com/r/wallstreetbets/comments/hot_{i:04d}",
                score=score,
                upvote_ratio=random.uniform(0.85, 0.98),
                num_comments=num_comments,
                mentioned_stocks=json.dumps(mentioned),
                primary_stock=stock["symbol"],
                sentiment_score=random.uniform(0.3, 0.9),
                sentiment_label="positive",
                sentiment_confidence=random.uniform(0.7, 0.95),
                is_processed=True,
                is_relevant=True,
                posted_at=posted_at,
                created_at=created_at,
                track_comments=True,
                initial_num_comments=num_comments,
            )

            session.add(post)
            post_count += 1

        await session.commit()
        print(f"✅ Seeded {post_count} Reddit posts")

    await engine.dispose()
    print("\n🎉 Database seeding complete!")
    print(f"\n📊 Summary:")
    print(f"  • {len(test_users)} test users")
    print(f"  • {len(subreddits)} tracked subreddits")
    print(f"  • {len(SAMPLE_STOCKS)} stocks")
    print(f"  • {pinned_count} pinned stocks")
    print(f"  • {position_count} hypothetical positions")
    print(f"  • {post_count} Reddit posts")
    print(f"\n👤 Test Users:")
    print(f"  • test@akleao.com")
    print(f"  • dev@akleao.com")
    print(f"  (No passwords set - use OAuth for authentication)")
    print(f"\n🚀 You can now start your local development environment!")


if __name__ == "__main__":
    asyncio.run(seed_database())
