# Quick Start - Local Development

Get your local development environment running in 3 steps!

## Prerequisites

- Docker & Docker Compose
- Python 3.9+ (for seed script)
- Node.js 18+ (for frontend)

## Step 1: Start Database & Seed Data

```bash
cd backend

# Start PostgreSQL
docker-compose -f docker-compose.yml -f docker-compose.local.yml up postgres -d

# Wait 5 seconds for DB to be ready
sleep 5

# Seed with sample data
./seed-local-db.sh
```

**What you get:**
- 2 test users (test@akleao.com, dev@akleao.com)
- 4 tracked subreddits (wallstreetbets, stocks, investing, StockMarket)
- 10 stocks (AAPL, MSFT, GOOGL, NVDA, TSLA, META, AMZN, AMD, JPM, WMT)
- 8-10 pinned stocks across users
- 4-8 hypothetical positions across users
- 40+ Reddit posts (recent and hot)

## Step 2: Start Backend API

```bash
# Start API Gateway + Redis
./dev-local-api-only.sh
```

API will be available at: **http://localhost:8001**

Test it:
```bash
curl http://localhost:8001/api/admin/reddit-posts?limit=10
```

## Step 3: Start Frontend

```bash
# In a new terminal
cd ..  # Go to project root
npm run dev
```

Visit: **http://localhost:3000**

## That's it! 🎉

Your full local stack is now running:
- ✅ Local PostgreSQL with sample data
- ✅ Backend API (FastAPI)
- ✅ Frontend (Next.js)

## Common Tasks

### View API logs
```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml logs -f api-gateway
```

### Stop everything
```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml down
```

### Reset & reseed database
```bash
# Delete all data
docker-compose -f docker-compose.yml -f docker-compose.local.yml down -v

# Start fresh
docker-compose -f docker-compose.yml -f docker-compose.local.yml up postgres -d
sleep 5
./seed-local-db.sh
```

### Run with scrapers (optional)
```bash
# Start everything including Reddit scrapers
./dev-local.sh
```

Note: Scrapers require Reddit API credentials in `.env` file.

## Troubleshooting

**"Connection refused" errors?**
- Make sure PostgreSQL is running: `docker ps | grep postgres`
- Wait a few seconds after starting postgres before seeding

**"Module not found" in seed script?**
- Install dependencies: `pip install asyncpg sqlalchemy`

**Port 5432 already in use?**
- Stop other PostgreSQL instances or change port in `docker-compose.local.yml`

## Next Steps

See [README-LOCAL-DEV.md](./README-LOCAL-DEV.md) for:
- Detailed architecture diagrams
- Environment variable configuration
- Production deployment differences
- Advanced troubleshooting
