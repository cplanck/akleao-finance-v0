# Development Workflow

## Overview

This document covers development practices, local setup, production data sync strategies, testing approaches, and monorepo workflow for Akleao Finance.

## Project Structure (Monorepo)

```
akleao-finance-v0/                 (Git root)
├── app/                           ← Next.js frontend (App Router)
├── components/                    ← React components
├── lib/                           ← Frontend utilities
├── hooks/                         ← React hooks
├── package.json                   ← Frontend dependencies
├── next.config.js                 ← Next.js configuration
├── backend/                       ← Python backend
│   ├── api-gateway/              ← FastAPI server
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── routers/
│   │   └── requirements.txt
│   ├── workers/                  ← Background workers
│   │   ├── reddit-scraper/
│   │   ├── metrics-aggregator/
│   │   ├── anomaly-detector/
│   │   └── sentiment-analyzer/
│   ├── shared/                   ← Shared models
│   │   └── models/
│   ├── docker-compose.yml        ← Local development
│   ├── scripts/
│   │   └── generate_test_data.py
│   └── docs/
│       ├── ARCHITECTURE.md
│       ├── ROADMAP.md
│       └── ...
└── README.md
```

## Local Development Setup

### Prerequisites

1. **Install Docker Desktop**
   - MacOS: `brew install --cask docker`
   - Or download from [docker.com](https://docker.com)

2. **Install Node.js 18+**
   - `brew install node@18`

3. **Install Python 3.11+**
   - `brew install python@3.11`

4. **Install gcloud CLI** (for production deployment)
   - `brew install google-cloud-sdk`

### Step 1: Clone and Install

```bash
# Clone repository
git clone <repo-url>
cd akleao-finance-v0

# Install frontend dependencies
npm install

# Install backend dependencies (if running locally without Docker)
cd backend/api-gateway
pip install -r requirements.txt
cd ../..
```

### Step 2: Configure Environment Variables

#### Frontend (`.env.local`)

```bash
# Better Auth
BETTER_AUTH_SECRET=dev-secret-change-in-production
BETTER_AUTH_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://akleao:dev_password@localhost:5432/akleao

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Yahoo Finance (for stock data)
# No API key needed for basic usage
```

#### Backend (`.env`)

```bash
# Better Auth (must match frontend!)
BETTER_AUTH_SECRET=dev-secret-change-in-production

# Database
DATABASE_URL=postgresql://akleao:dev_password@localhost:5432/akleao

# Reddit API (get from https://reddit.com/prefs/apps)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=AkleaoFinance/1.0

# OpenAI (for sentiment analysis - Phase 2B+)
OPENAI_API_KEY=sk-...

# Anthropic (for deep research - Phase 2C+)
ANTHROPIC_API_KEY=sk-ant-...

# Scraper settings
SCRAPE_INTERVAL_MINUTES=15
```

### Step 3: Start Backend Services

```bash
cd backend
docker-compose up -d
```

This starts:
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache
- **API Gateway** (port 8000) - FastAPI server
- **Reddit Scraper** - Background worker

Verify services are running:

```bash
docker-compose ps
```

### Step 4: Start Frontend

```bash
# In project root
npm run dev
```

Frontend runs on: http://localhost:3000

### Step 5: Verify Setup

```bash
# Check API is responding
curl http://localhost:8000/health

# Check database has tables
docker-compose exec postgres psql -U akleao -d akleao -c "\dt"

# Check Reddit scraper logs
docker-compose logs -f reddit-scraper

# Open frontend
open http://localhost:3000
```

## Daily Development Workflow

### Terminal Setup (Recommended)

Use 3 terminal windows:

**Terminal 1: Frontend**
```bash
npm run dev
```

**Terminal 2: Backend Logs**
```bash
cd backend
docker-compose logs -f api-gateway reddit-scraper
```

**Terminal 3: Development Tasks**
```bash
# Run migrations, tests, etc.
```

### Making Changes

#### Frontend Changes
1. Edit files in `app/`, `components/`, or `lib/`
2. Next.js hot reloads automatically
3. Check browser for changes

#### Backend API Changes
1. Edit files in `backend/api-gateway/`
2. Restart API Gateway:
   ```bash
   docker-compose restart api-gateway
   ```
3. Test endpoint with curl or frontend

#### Worker Changes
1. Edit files in `backend/workers/<worker-name>/`
2. Rebuild and restart worker:
   ```bash
   docker-compose up -d --build reddit-scraper
   ```
3. Check logs:
   ```bash
   docker-compose logs -f reddit-scraper
   ```

#### Database Model Changes
1. Edit files in `backend/shared/models/`
2. Create migration (manual for now):
   ```bash
   docker-compose exec postgres psql -U akleao -d akleao
   ```
3. Run SQL to alter tables
4. Restart all services:
   ```bash
   docker-compose restart
   ```

## Production Data Sync Strategies

### Problem

When production Cloud SQL has real Reddit data, anomaly baselines, and user activity, how do you replicate that environment locally for testing?

### Strategy 1: Database Snapshots (Recommended for Testing)

**When to use**: Need exact production data for debugging

**How it works**:
1. Create snapshot of production database
2. Download to local machine
3. Restore into local Docker PostgreSQL
4. Anonymize sensitive data

**Steps**:

```bash
# 1. Create Cloud SQL export
gcloud sql export sql akleao-db gs://akleao-backups/snapshot-$(date +%Y%m%d).sql \
  --database=akleao

# 2. Download to local machine
gsutil cp gs://akleao-backups/snapshot-*.sql ./backend/data/

# 3. Load into local Docker PostgreSQL
docker-compose exec -T postgres psql -U akleao -d akleao < ./backend/data/snapshot-*.sql

# 4. Anonymize user data (IMPORTANT!)
docker-compose exec postgres psql -U akleao -d akleao <<EOF
  -- Anonymize Better Auth users
  UPDATE user SET email = CONCAT('user_', id, '@example.com');
  UPDATE user SET password = 'hashed_dummy_password';

  -- Keep watchlists and preferences intact for testing
EOF
```

**Pros**:
- Exact replica of production data
- Real anomaly baselines
- Authentic stock mention patterns

**Cons**:
- Privacy concerns (must anonymize)
- Large download size
- Snapshot becomes stale quickly

**Frequency**: Weekly or when debugging specific production issues

### Strategy 2: Synthetic Data Generator (Recommended for Development)

**When to use**: Day-to-day development, don't need exact production data

**How it works**:
1. Script generates realistic but fake Reddit data
2. Simulates stock mentions, engagement patterns
3. Creates baseline metrics
4. Runs locally, fast to regenerate

**Implementation**:

Create `backend/scripts/generate_test_data.py`:

```python
"""Generate synthetic Reddit data for local testing."""

import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import os
import sys
sys.path.insert(0, "../shared")

from shared.models.reddit_post import RedditPost, RedditComment
from shared.models.stock import Stock

# Stock universe
STOCKS = ["AAPL", "TSLA", "NVDA", "AMD", "MSFT", "GOOGL", "AMZN", "META", "RKLB", "ASTS"]
SUBREDDITS = ["wallstreetbets", "stocks", "investing", "StockMarket"]

# Realistic patterns
def generate_baseline_stock():
    """Generate normal mention volume (3-10 mentions/day)."""
    return random.choice(STOCKS[:6])  # Large caps get steady mentions

def generate_anomaly_stock():
    """Generate anomaly candidate (20+ mentions in 6h)."""
    return random.choice(STOCKS[6:])  # Small caps for anomalies

def create_post(db: Session, stock: str, hours_ago: int, anomaly: bool = False):
    """Create a Reddit post mentioning a stock."""
    subreddit = random.choice(SUBREDDITS)
    created_at = datetime.utcnow() - timedelta(hours=hours_ago)

    # Anomaly posts have higher engagement
    score = random.randint(50, 200) if anomaly else random.randint(5, 50)

    titles = [
        f"What do you think about ${stock}?",
        f"${stock} DD - Why I'm bullish",
        f"Anyone else watching ${stock}?",
        f"${stock} earnings thread",
        f"${stock} technical analysis"
    ]

    post = RedditPost(
        id=f"post_{stock}_{hours_ago}_{random.randint(1000, 9999)}",
        subreddit=subreddit,
        title=random.choice(titles),
        author=f"user_{random.randint(1, 100)}",
        content=f"I think ${stock} is interesting because...",
        url=f"https://reddit.com/r/{subreddit}/...",
        score=score,
        upvote_ratio=random.uniform(0.6, 0.95),
        num_comments=random.randint(5, 50) if anomaly else random.randint(0, 10),
        mentioned_stocks=[stock],
        primary_stock=stock,
        is_processed=False,
        is_relevant=True,
        created_at=created_at
    )

    db.add(post)
    db.commit()

    # Add comments
    for i in range(random.randint(0, 10)):
        comment = RedditComment(
            id=f"comment_{post.id}_{i}",
            post_id=post.id,
            author=f"user_{random.randint(1, 100)}",
            content=f"I agree with your ${stock} analysis",
            score=random.randint(1, 20),
            mentioned_stocks=[stock],
            is_processed=False,
            is_relevant=True,
            created_at=created_at + timedelta(minutes=random.randint(5, 120))
        )
        db.add(comment)

    db.commit()

def main():
    DATABASE_URL = os.getenv("DATABASE_URL")
    engine = create_engine(DATABASE_URL)
    db = Session(engine)

    print("🎲 Generating synthetic Reddit data...")

    # Generate baseline data (last 7 days)
    for hours_ago in range(0, 24 * 7, 6):  # Every 6 hours
        for stock in STOCKS[:6]:  # Large caps
            for _ in range(random.randint(1, 3)):
                create_post(db, stock, hours_ago, anomaly=False)

    print("✅ Generated baseline data for 6 large-cap stocks")

    # Generate anomaly (RKLB spiking in last 6 hours)
    print("🚀 Generating anomaly: RKLB volume spike")
    for hours_ago in range(0, 6):
        for _ in range(random.randint(3, 6)):  # 3-6 posts per hour
            create_post(db, "RKLB", hours_ago, anomaly=True)

    print("✅ Generated 20+ RKLB mentions in last 6 hours (anomaly)")

    # Generate another anomaly (ASTS)
    print("🚀 Generating anomaly: ASTS cross-subreddit spread")
    for hours_ago in range(0, 12):
        for _ in range(random.randint(2, 4)):
            create_post(db, "ASTS", hours_ago, anomaly=True)

    print("✅ Generated ASTS mentions across all subreddits")

    # Summary
    total_posts = db.query(RedditPost).count()
    total_comments = db.query(RedditComment).count()

    print(f"\n📊 Summary:")
    print(f"  Total posts: {total_posts}")
    print(f"  Total comments: {total_comments}")
    print(f"  RKLB posts (last 6h): {db.query(RedditPost).filter(RedditPost.primary_stock == 'RKLB').count()}")
    print(f"  ASTS posts (last 12h): {db.query(RedditPost).filter(RedditPost.primary_stock == 'ASTS').count()}")

if __name__ == "__main__":
    main()
```

**Usage**:

```bash
cd backend/scripts
python generate_test_data.py
```

**Pros**:
- Fast regeneration (10 seconds)
- No privacy concerns
- Controlled anomalies for testing
- Can create edge cases

**Cons**:
- Not real data
- May miss unexpected patterns

**Frequency**: Daily, or whenever you need fresh data

### Strategy 3: Anonymized Production Clone (Best of Both Worlds)

**When to use**: Need real patterns but with privacy protection

**How it works**:
1. Nightly job exports production data
2. Anonymization script runs automatically
3. Pushes to Cloud Storage
4. Developers download pre-anonymized snapshot

**Implementation** (Future - Phase 2+):

```bash
# Cloud Scheduler job (runs nightly)
gcloud scheduler jobs create http anonymized-snapshot \
  --schedule="0 2 * * *" \
  --uri="https://us-central1-akleao.cloudfunctions.net/create-anonymized-snapshot"

# Cloud Function anonymizes and exports
# Developers download:
gsutil cp gs://akleao-dev-snapshots/latest.sql ./backend/data/
```

### Strategy 4: Staging Environment

**When to use**: Pre-production testing

**How it works**:
- Separate Cloud SQL instance (staging)
- Smaller instance size (db-f1-micro)
- Receives subset of production data
- Safe for destructive testing

**Setup**:

```bash
# Create staging database
gcloud sql instances create akleao-db-staging \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Developers connect to staging
DATABASE_URL=postgresql://user:pass@staging-ip:5432/akleao
```

### Strategy 5: Read-Only Production Connection (Emergency Only)

**When to use**: Critical production debugging ONLY

**How it works**:
- Read-only database user
- Connect directly to production
- View data, never modify

**Setup**:

```sql
-- In Cloud SQL
CREATE USER readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE akleao TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
```

**Usage**:

```bash
# Emergency debugging only
DATABASE_URL_READONLY=postgresql://readonly:pass@prod-ip:5432/akleao
```

**IMPORTANT**: Never write to production from local machine!

## Testing Strategy

### Unit Tests (Python Backend)

```bash
cd backend/api-gateway
pytest tests/

# With coverage
pytest --cov=. tests/
```

### Integration Tests

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
pytest tests/integration/

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Frontend Tests

```bash
# Unit tests (components)
npm test

# E2E tests (Playwright)
npx playwright test
```

### Manual Testing Checklist

Before deploying to production:

- [ ] Register new user via Better Auth
- [ ] Login and verify JWT token works
- [ ] Add stocks to watchlist
- [ ] Verify Reddit scraper is collecting data
- [ ] Check anomaly detection creates alerts
- [ ] Test "For You" page (Phase 3)
- [ ] Verify all API endpoints respond correctly
- [ ] Check mobile responsiveness

## Git Workflow

### Branch Strategy

```bash
main                    # Production
  ↓
develop                 # Integration branch
  ↓
feature/anomaly-detection    # Feature branches
feature/rag-integration
fix/redis-connection-issue
```

### Commit Conventions

```bash
# Format: <type>: <description>

feat: Add anomaly detection worker
fix: Resolve Reddit API rate limiting
docs: Update ROADMAP with Phase 2B
refactor: Extract pump detection to separate function
test: Add unit tests for metrics aggregator
chore: Update dependencies
```

### Pull Request Process

1. Create feature branch
2. Make changes and commit
3. Push to GitHub
4. Create PR to `develop`
5. Request review
6. Merge to `develop`
7. Test in staging
8. Merge `develop` → `main` for production deploy

## Deployment

### Frontend (Vercel)

```bash
# Auto-deploys on push to main
git push origin main

# Vercel builds and deploys automatically
# URL: https://akleao-finance.vercel.app
```

### Backend (GCP Cloud Run)

```bash
# Deploy API Gateway
cd backend/api-gateway
gcloud builds submit --tag gcr.io/PROJECT/api-gateway
gcloud run deploy api-gateway --image gcr.io/PROJECT/api-gateway

# Deploy workers
cd backend/workers/reddit-scraper
gcloud builds submit --tag gcr.io/PROJECT/reddit-scraper
gcloud run jobs create reddit-scraper --image gcr.io/PROJECT/reddit-scraper
```

### Database Migrations

```bash
# Manual migrations for now (Phase 1)
# Connect to Cloud SQL
gcloud sql connect akleao-db --user=postgres

# Run migration SQL
\i migrations/002_add_anomaly_tables.sql
```

**Future**: Use Alembic for automated migrations (Phase 2+)

## Monitoring

### Local Development

```bash
# API logs
docker-compose logs -f api-gateway

# Worker logs
docker-compose logs -f reddit-scraper

# Database queries
docker-compose exec postgres psql -U akleao -d akleao
```

### Production

```bash
# Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Cloud SQL metrics
gcloud sql operations list --instance=akleao-db

# Custom metrics (future)
# Cloud Monitoring dashboard
```

## Troubleshooting

### Docker Issues

```bash
# Restart all services
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# View logs
docker-compose logs -f

# Clean slate (deletes data!)
docker-compose down -v
docker-compose up -d
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U akleao -d akleao -c "SELECT 1;"

# Verify DATABASE_URL is correct
echo $DATABASE_URL
```

### Reddit Scraper Not Working

```bash
# Check Reddit API credentials
docker-compose exec reddit-scraper env | grep REDDIT

# Check rate limiting
docker-compose logs reddit-scraper | grep "rate"

# Manual test
docker-compose exec reddit-scraper python -c "import praw; print('OK')"
```

### Frontend API Calls Failing

```bash
# Check CORS configuration in FastAPI
# Verify NEXT_PUBLIC_API_URL is correct
# Check JWT token is being sent
# Inspect Network tab in browser DevTools
```

## Best Practices

1. **Never commit secrets** - Use `.env` files (gitignored)
2. **Test locally first** - Before deploying to production
3. **Use feature branches** - Never commit directly to main
4. **Write tests** - For critical functionality
5. **Document changes** - Update relevant .md files
6. **Monitor costs** - Check GCP billing dashboard weekly
7. **Anonymize data** - When using production snapshots
8. **Keep dependencies updated** - Run `npm audit` and `pip list --outdated`

## Quick Reference

### Start Everything

```bash
# Backend
cd backend && docker-compose up -d

# Frontend
npm run dev
```

### Stop Everything

```bash
# Backend
cd backend && docker-compose down

# Frontend
Ctrl+C
```

### Reset Database

```bash
cd backend
docker-compose down -v
docker-compose up -d
python scripts/generate_test_data.py
```

### Deploy to Production

```bash
# Frontend (automatic)
git push origin main

# Backend (manual for now)
cd backend/api-gateway
gcloud builds submit --tag gcr.io/PROJECT/api-gateway
gcloud run deploy api-gateway --image gcr.io/PROJECT/api-gateway
```

## Next Steps

See [ROADMAP.md](./ROADMAP.md) for development phases.

See [COST_BREAKDOWN.md](./COST_BREAKDOWN.md) for GCP cost estimates.
