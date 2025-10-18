# Getting Started with Akleao Finance

## What You're Building

An **early signal detection system** that catches stocks gaining traction on Reddit **before they go viral**, giving you an information edge.

**Traditional sentiment analysis**: "NVDA is trending today"
**Akleao Finance**: "RKLB mentions up 3x in last 6 hours across 4 subreddits" (Day 1, before viral)

## Prerequisites

### Required
- **Docker Desktop** - For local PostgreSQL and Redis
- **Node.js 18+** - For Next.js frontend
- **Python 3.11+** - For backend workers
- **Reddit API credentials** - [Get them here](https://reddit.com/prefs/apps)

### Optional (for production deployment)
- **gcloud CLI** - For deploying to Google Cloud Platform
- **GCP account** - With $300 free credit

## Quick Start (5 minutes)

### 1. Clone and Install

```bash
# Clone repository
git clone <repo-url>
cd akleao-finance-v0

# Install frontend dependencies
npm install

# Backend dependencies installed via Docker
```

### 2. Configure Environment Variables

#### Frontend (`.env.local`)

```bash
# Better Auth
BETTER_AUTH_SECRET=dev-secret-change-in-production
BETTER_AUTH_URL=http://localhost:3000

# Database (shared with backend)
DATABASE_URL=postgresql://akleao:dev_password@localhost:5432/akleao

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Yahoo Finance (no API key needed for basic usage)
```

#### Backend (`backend/.env`)

```bash
# Copy example
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```bash
# Better Auth (must match frontend!)
BETTER_AUTH_SECRET=dev-secret-change-in-production

# Database
DATABASE_URL=postgresql://akleao:dev_password@localhost:5432/akleao

# Reddit API (REQUIRED - get from https://reddit.com/prefs/apps)
REDDIT_CLIENT_ID=your_reddit_client_id_here
REDDIT_CLIENT_SECRET=your_reddit_client_secret_here
REDDIT_USER_AGENT=AkleaoFinance/1.0

# Scraper settings
SCRAPE_INTERVAL_MINUTES=15

# AI APIs (optional - for Phase 2B+)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start Backend Services

```bash
cd backend
docker-compose up -d
```

This starts:
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache
- **API Gateway** (port 8000) - FastAPI server
- **Reddit Scraper** - Collects stock mentions every 15 min

### 4. Start Frontend

```bash
# In project root (separate terminal)
npm run dev
```

Frontend runs on: http://localhost:3000

### 5. Verify Everything Works

```bash
# Check API health
curl http://localhost:8000/health
# Should return: {"status": "healthy"}

# Check database
docker-compose exec postgres psql -U akleao -d akleao -c "\dt"
# Should show tables: user, session, users, reddit_posts, etc.

# Check Reddit scraper is running
docker-compose logs reddit-scraper
# Should show scraping activity

# Open frontend
open http://localhost:3000
# Should see stock chart interface
```

## Getting Reddit API Credentials

### 1. Create Reddit App

1. Go to https://reddit.com/prefs/apps
2. Click "Create App" or "Create Another App"
3. Fill out form:
   - **Name**: Akleao Finance Dev
   - **App type**: Select "script"
   - **Description**: Financial analysis tool
   - **About URL**: Leave blank
   - **Redirect URI**: http://localhost:8000 (required but not used)
4. Click "Create app"

### 2. Copy Credentials

After creating app, you'll see:
- **Client ID**: String under the app name (looks like `abc123xyz`)
- **Client Secret**: String labeled "secret"

Add these to `backend/.env`:

```bash
REDDIT_CLIENT_ID=abc123xyz
REDDIT_CLIENT_SECRET=your_secret_here
```

### 3. Test Reddit Connection

```bash
# Restart scraper with new credentials
docker-compose restart reddit-scraper

# Check logs
docker-compose logs -f reddit-scraper
# Should see: "🚀 Starting Reddit Scraper Worker"
# Should see: "✅ Saved post: ..." after a few minutes
```

## Understanding the Architecture

### Monorepo Structure

```
akleao-finance-v0/          (Git root)
├── app/                    ← Next.js frontend pages
├── components/             ← React components
├── lib/                    ← Frontend utilities
├── package.json            ← Frontend dependencies
├── .env.local              ← Frontend environment variables
├── backend/                ← Python backend
│   ├── api-gateway/       ← FastAPI server
│   ├── workers/           ← Background workers
│   ├── shared/            ← Shared models
│   ├── docker-compose.yml ← Local development
│   └── .env               ← Backend environment variables
└── README.md
```

**Key point**: One git repo, two separate deployments (Vercel for frontend, GCP for backend)

### How Authentication Works

```
User → Next.js Login (Better Auth) → JWT Token
    ↓
Frontend stores JWT in browser
    ↓
API calls include: Authorization: Bearer <JWT>
    ↓
FastAPI validates JWT → Looks up user preferences
    ↓
Returns user-specific data
```

**Database**: One PostgreSQL database shared by:
- Better Auth tables (`user`, `session`, `account`)
- Backend tables (`users` for preferences, `reddit_posts`, `anomaly_alerts`, etc.)

See [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) for detailed setup.

### Data Flow

```
Reddit → Scraper Worker → PostgreSQL
                              ↓
                    Metrics Aggregator (Phase 2A)
                              ↓
                    Anomaly Detector (Phase 2A)
                              ↓
                    API Gateway → Frontend
```

## What Data is Being Collected?

After 15-30 minutes of running, check what the scraper collected:

```bash
# How many posts?
docker-compose exec postgres psql -U akleao -d akleao -c \
  "SELECT COUNT(*) FROM reddit_posts;"

# Recent posts with stock mentions
docker-compose exec postgres psql -U akleao -d akleao -c \
  "SELECT title, mentioned_stocks, score FROM reddit_posts ORDER BY created_at DESC LIMIT 5;"

# Most mentioned stocks
docker-compose exec postgres psql -U akleao -d akleao -c \
  "SELECT primary_stock, COUNT(*) as mentions FROM reddit_posts WHERE primary_stock IS NOT NULL GROUP BY primary_stock ORDER BY mentions DESC LIMIT 10;"
```

You should see posts mentioning popular stocks like AAPL, TSLA, NVDA, etc.

## Setting Up Better Auth (Optional - Phase 0.2)

### 1. Install Better Auth in Frontend

```bash
npm install better-auth
```

### 2. Create Auth Configuration

Create `lib/auth.ts`:

```typescript
import { BetterAuth } from "better-auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const auth = new BetterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set true in production
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
})
```

### 3. Create Auth API Routes

Create `app/api/auth/[...all]/route.ts`:

```typescript
import { auth } from "@/lib/auth"

export const { GET, POST } = auth.handler
```

### 4. Create Login/Register Pages

See [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) for complete code examples.

## Development Workflow

### Terminal Setup (Recommended)

Use 3 terminal windows:

**Terminal 1: Backend**
```bash
cd backend
docker-compose logs -f api-gateway reddit-scraper
```

**Terminal 2: Frontend**
```bash
npm run dev
```

**Terminal 3: Development Tasks**
```bash
# Run commands, make changes, etc.
```

### Making Changes

#### Frontend Changes
1. Edit files in `app/`, `components/`, or `lib/`
2. Next.js hot reloads automatically ✅
3. Check browser for changes

#### Backend API Changes
1. Edit files in `backend/api-gateway/`
2. Restart API Gateway:
   ```bash
   docker-compose restart api-gateway
   ```
3. Test with curl or frontend

#### Worker Changes
1. Edit files in `backend/workers/<worker-name>/`
2. Rebuild and restart:
   ```bash
   docker-compose up -d --build reddit-scraper
   ```
3. Check logs:
   ```bash
   docker-compose logs -f reddit-scraper
   ```

#### Database Model Changes
1. Edit files in `backend/shared/models/`
2. Connect to database:
   ```bash
   docker-compose exec postgres psql -U akleao -d akleao
   ```
3. Run SQL to alter tables (manual for now)
4. Restart services:
   ```bash
   docker-compose restart
   ```

## Key Endpoints to Test

### API Documentation
```bash
open http://localhost:8000/docs
```

Interactive Swagger UI with all endpoints.

### Authentication (Phase 1 - Custom Auth)
```bash
# Register user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "secure123", "full_name": "Test User"}'

# Login (returns JWT token)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "secure123"}'

# Get profile (use token from login)
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Watchlist
```bash
# Add to watchlist
curl -X POST http://localhost:8000/api/auth/watchlist/AAPL \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Remove from watchlist
curl -X DELETE http://localhost:8000/api/auth/watchlist/AAPL \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### "Cannot connect to database"

**Check if PostgreSQL is running:**
```bash
docker-compose ps postgres
```

**If not running:**
```bash
docker-compose up -d postgres
```

**Test connection:**
```bash
docker-compose exec postgres psql -U akleao -d akleao -c "SELECT 1;"
```

### "Reddit Scraper not collecting data"

**Check logs:**
```bash
docker-compose logs reddit-scraper
```

**Common issues:**
1. Missing Reddit API credentials → Add to `backend/.env`
2. Reddit API rate limiting → Wait 15 minutes
3. Network connectivity → Check internet connection

**Manual test:**
```bash
docker-compose exec reddit-scraper python -c "import praw; print('OK')"
```

### "Frontend can't connect to API"

**Check API is running:**
```bash
curl http://localhost:8000/health
```

**If not responding:**
```bash
docker-compose logs api-gateway
docker-compose restart api-gateway
```

**Check CORS:**
- Verify `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`
- Check API allows localhost:3000 origin

### "Docker won't start"

**Clean slate:**
```bash
docker-compose down -v  # ⚠️ Deletes all data!
docker-compose up -d
```

**Check Docker Desktop:**
- Ensure Docker Desktop is running
- Check "Resources" → Enough memory allocated (4GB+)

### Database is empty

**Generate synthetic test data:**
```bash
cd backend/scripts
python generate_test_data.py
```

See [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) for data sync strategies.

## Next Steps

### Phase 0: Verify Local Setup ✅

**Validation checklist**:
- [ ] Can register a user via API
- [ ] Reddit scraper runs without errors
- [ ] Database has posts after 15 minutes
- [ ] API docs accessible at http://localhost:8000/docs
- [ ] Frontend displays stock data

**Time**: 15-30 minutes

### Phase 0.2: Better Auth Integration (Optional)

**Goal**: Replace custom auth with Better Auth

**Steps**:
1. Follow [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md)
2. Create login/register pages
3. Update API to validate Better Auth JWTs
4. Test authentication flow

**Time**: 2-3 hours

### Phase 2A: Anomaly Detection (High Priority)

**Goal**: Catch stocks before they go viral

**What to build**:
1. Metrics Aggregator worker - Calculate baseline metrics
2. Anomaly Detector worker - Real-time anomaly detection
3. Frontend dashboard - View alerts and tune thresholds
4. Pump filter - Distinguish organic vs coordinated

See [ANOMALY_DETECTION.md](./ANOMALY_DETECTION.md) for deep dive.

**Time**: 1-2 weeks

### Phase 0: GCP Deployment (When Ready)

**Goal**: Deploy to Google Cloud Platform

**Steps**:
1. Create GCP project
2. Set up Cloud SQL (PostgreSQL)
3. Deploy API Gateway to Cloud Run
4. Deploy workers as Cloud Run Jobs
5. Configure Cloud Scheduler

See [ROADMAP.md](./ROADMAP.md) Phase 0 for detailed instructions.

**Cost**: ~$45/month

**Time**: 2-3 hours

## Common Commands

### Backend

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart API
docker-compose restart api-gateway

# Rebuild worker
docker-compose up -d --build reddit-scraper

# Connect to database
docker-compose exec postgres psql -U akleao -d akleao

# Connect to Redis
docker-compose exec redis redis-cli

# Clean slate (deletes data!)
docker-compose down -v
docker-compose up -d
```

### Frontend

```bash
# Development
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint
npm run lint
```

### Database

```bash
# View all tables
docker-compose exec postgres psql -U akleao -d akleao -c "\dt"

# Count Reddit posts
docker-compose exec postgres psql -U akleao -d akleao -c \
  "SELECT COUNT(*) FROM reddit_posts;"

# Recent posts
docker-compose exec postgres psql -U akleao -d akleao -c \
  "SELECT title, score FROM reddit_posts ORDER BY created_at DESC LIMIT 5;"

# Most mentioned stocks
docker-compose exec postgres psql -U akleao -d akleao -c \
  "SELECT primary_stock, COUNT(*) FROM reddit_posts WHERE primary_stock IS NOT NULL GROUP BY primary_stock ORDER BY count DESC LIMIT 10;"
```

## Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and decisions
- [ROADMAP.md](./ROADMAP.md) - Detailed phase breakdown
- [ANOMALY_DETECTION.md](./ANOMALY_DETECTION.md) - Early signal detection
- [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) - Better Auth setup
- [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) - Development practices
- [COST_BREAKDOWN.md](./COST_BREAKDOWN.md) - GCP vs AWS costs

## Questions?

Check the documentation above or:
1. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for design decisions
2. Check [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) for development practices
3. See [ROADMAP.md](./ROADMAP.md) for what's next

## Ready to Start Building?

**Current priority: Phase 2A - Anomaly Detection**

This is the core value proposition. Everything else supports this.

See [ANOMALY_DETECTION.md](./ANOMALY_DETECTION.md) to begin.
