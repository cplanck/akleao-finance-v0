#!/usr/bin/env python3
"""
Quick script to truncate scraper tables in production database.
"""
import os
from sqlalchemy import create_engine, text

# Production database URL
DATABASE_URL = "postgresql://akleao:YTmLuVfpJPuTwYiG/FaLUFoY5me1TYyY1UAlc7TvGUw=@34.44.5.181:5432/akleao"

print("🔌 Connecting to production database...")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("🗑️  Truncating scraper_runs...")
    conn.execute(text("TRUNCATE scraper_runs RESTART IDENTITY CASCADE;"))

    print("🗑️  Truncating scraper_jobs...")
    conn.execute(text("TRUNCATE scraper_jobs RESTART IDENTITY CASCADE;"))

    conn.commit()

    print("✅ Database tables truncated successfully!")

    # Verify
    result = conn.execute(text("SELECT COUNT(*) FROM scraper_runs;"))
    count = result.scalar()
    print(f"   scraper_runs count: {count}")

    result = conn.execute(text("SELECT COUNT(*) FROM scraper_jobs;"))
    count = result.scalar()
    print(f"   scraper_jobs count: {count}")
