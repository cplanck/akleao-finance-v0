# Local Development Setup

This guide will help you set up a local development environment with a local PostgreSQL database and sample data.

## Overview

**Local Development:**
- Local PostgreSQL database (separate from production)
- Sample Reddit posts and stock data for testing
- All services running in Docker

**Production:**
- Google Cloud SQL (managed by cloud scrapers)
- Real data from Reddit scrapers

## Quick Start

### 1. Start Local Database and Seed It

```bash
cd backend

# Start just the database
docker-compose -f docker-compose.yml -f docker-compose.local.yml up postgres -d

# Wait a few seconds, then seed with sample data
./seed-local-db.sh
```

### 2. Start Development Services

**Option A: API Only (Recommended for frontend dev)**
```bash
./dev-local-api-only.sh
```
This starts:
- PostgreSQL (local)
- Redis
- API Gateway

**Option B: Full Stack (All services)**
```bash
./dev-local.sh
```
This starts everything including scrapers and workers.

### 3. Start Frontend

In a separate terminal:
```bash
npm run dev
```

Visit: http://localhost:3000

## Architecture

```
Local Development:
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                 │
│  http://localhost:3000                              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  API Gateway (FastAPI)                              │
│  http://localhost:8001                              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Local PostgreSQL                                   │
│  localhost:5432                                     │
│  • Stocks (10 samples)                              │
│  • Reddit Posts (40+ samples)                       │
└─────────────────────────────────────────────────────┘
```

```
Production:
┌─────────────────────────────────────────────────────┐
│  Vercel Frontend                                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  GCP API Gateway                                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Cloud SQL PostgreSQL                               │
│  • Real data from cloud scrapers                    │
└─────────────────────────────────────────────────────┘
                 ▲
                 │
┌────────────────┴────────────────────────────────────┐
│  Cloud Reddit Scrapers (running 24/7)               │
└─────────────────────────────────────────────────────┘
```

## Files

- `docker-compose.yml` - Base configuration (shared)
- `docker-compose.local.yml` - Local development overrides
- `docker-compose.prod.yml` - Production configuration
- `.env` - Local environment variables
- `.env.prod` - Production environment variables

## Helper Scripts

- `./dev-local.sh` - Start full local environment
- `./dev-local-api-only.sh` - Start API + database only
- `./seed-local-db.sh` - Seed database with sample data

## Environment Variables

Local development uses `.env` with:
```
DATABASE_URL=postgresql://akleao:akleao_dev_password@localhost:5432/akleao
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_secret
OPENAI_API_KEY=your_openai_key
ENCRYPTION_KEY=your_encryption_key
```

## Sample Data

The seed script creates:
- **10 stocks**: AAPL, MSFT, GOOGL, NVDA, TSLA, META, AMZN, AMD, JPM, WMT
- **40+ Reddit posts**:
  - Posts from last 48 hours
  - 15 "hot" posts from last 6 hours with high engagement
  - Mix of subreddits: wallstreetbets, stocks, investing

## Useful Commands

### View logs
```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml logs -f api-gateway
```

### Stop all services
```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml down
```

### Reset database (delete all data)
```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml down -v
# Then start and reseed
```

### Access PostgreSQL directly
```bash
docker exec -it akleao-postgres-local psql -U akleao -d akleao
```

### Run migrations
```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml exec api-gateway alembic upgrade head
```

## Troubleshooting

### Database connection errors
- Ensure PostgreSQL container is running: `docker ps | grep postgres`
- Check logs: `docker logs akleao-postgres-local`

### Port conflicts
- If port 5432 is already in use, stop other PostgreSQL instances
- Or change the port in `docker-compose.local.yml`

### Seed script fails
- Make sure PostgreSQL is fully started (wait 5-10 seconds)
- Check DATABASE_URL is correct
- Install dependencies: `pip install asyncpg sqlalchemy`

## Best Practices

1. **Never commit `.env` files** - They contain secrets
2. **Always dev against local DB** - Keep production data safe
3. **Reseed often** - Keep your local data fresh
4. **Use API-only mode** - Faster for frontend development
5. **Check git status** - Make sure docker-compose changes work for both environments
