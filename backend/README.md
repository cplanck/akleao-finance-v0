# Akleao Finance Backend

**Early signal detection system** for identifying stocks gaining traction on Reddit before they go viral.

## Vision

Build a system that catches stock discussions in their **infancy** (Day 1-2) before mainstream awareness (Day 3+), giving users an information edge for investment decisions.

## What Makes This Different?

Traditional sentiment analysis tells you what's already trending. Akleao detects:
- **Volume anomalies**: 3x+ above baseline mentions
- **Cross-subreddit spread**: Organic interest vs coordinated pumps
- **Quality signals**: High-effort DD posts vs spam
- **Early catalysts**: Before price movement occurs

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                       │
│  • Better Auth for authentication                           │
│  • Stock watchlist & preferences                            │
│  • Anomaly alerts dashboard                                 │
│  • Tunable detection thresholds                             │
│  • Deployed on Vercel                                       │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP + JWT
                   ↓
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (FastAPI - Python)                 │
│  • Validates Better Auth JWT tokens                         │
│  • User preferences & watchlist management                  │
│  • Anomaly alerts API                                       │
│  • Detection config management                              │
│  • Deployed on GCP Cloud Run                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Cloud SQL│ │  Redis   │ │   Pub/Sub    │
│PostgreSQL│ │  Cache   │ │Event Queue   │
└────┬─────┘ └──────────┘ └──────────────┘
     │
     │ Reads/Writes
     │
┌────┴──────────────────────────────────────────────────────┐
│                    WORKER SERVICES                         │
│  • Reddit Scraper (every 5-15 min)                         │
│  • Metrics Aggregator (baseline tracking)                  │
│  • Anomaly Detector (real-time alerts)                     │
│  • Sentiment Analyzer (future)                             │
│  • Deep Research (future - RAG-based)                      │
│  • Deployed as GCP Cloud Run Jobs                          │
└────────────────────────────────────────────────────────────┘
```

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | Not started | GCP setup (Cloud SQL, Cloud Run) |
| **Phase 1** | ✅ Completed | Core infrastructure (auth, Reddit scraper, database) |
| **Phase 2A** | Not started | Anomaly detection (HIGH PRIORITY) |
| **Phase 2B** | Not started | Quality scoring & refinement |
| **Phase 2C** | Not started | RAG-based deep analysis |
| **Phase 3** | Not started | "For You" personalized insights |

**Next Step**: Complete Phase 0 (GCP setup) then begin Phase 2A (anomaly detection)

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend)
- Python 3.11+
- gcloud CLI (for production deployment)

### Local Development

```bash
# 1. Start backend services
cd backend
cp .env.example .env
# Edit .env and add Reddit API credentials
docker-compose up -d

# 2. Start frontend (separate terminal)
cd ..
npm install
npm run dev
```

Verify it works:
```bash
# Check API
curl http://localhost:8000/health

# Check database
docker-compose exec postgres psql -U akleao -d akleao -c "\dt"

# Check Reddit scraper logs
docker-compose logs -f reddit-scraper

# Open frontend
open http://localhost:3000
```

See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed setup instructions.

## Tech Stack

| Component | Technology | Why? |
|-----------|-----------|------|
| Frontend | Next.js 15 + React | Modern, fast, great DX |
| Backend API | FastAPI (Python) | Async, fast, great docs |
| Workers | Python 3.11+ | Great for data processing |
| Database | PostgreSQL 15 | Reliable, feature-rich |
| Cache | Redis | Fast, simple |
| Queue | GCP Pub/Sub | Event-driven architecture |
| Auth | Better Auth | Production-ready |
| Hosting (Frontend) | Vercel | Zero config, fast |
| Hosting (Backend) | GCP Cloud Run | Serverless, scalable |
| AI | Anthropic Claude / OpenAI | Best LLMs available |

**Why GCP over AWS?**
- 30-40% cheaper for our use case
- Cloud Run > ECS Fargate (scales to zero)
- Simpler deployment
- Better for event-driven architecture

See [COST_BREAKDOWN.md](./COST_BREAKDOWN.md) for detailed comparison.

## Project Structure (Monorepo)

```
akleao-finance-v0/                 (Git root)
├── app/                           ← Next.js frontend
├── components/                    ← React components
├── lib/                           ← Frontend utilities
├── package.json                   ← Frontend dependencies
├── backend/                       ← Python backend
│   ├── api-gateway/              ← FastAPI server
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── routers/
│   │   └── requirements.txt
│   ├── workers/                  ← Background workers
│   │   ├── reddit-scraper/       ← Data collection
│   │   ├── metrics-aggregator/   ← Baseline tracking (Phase 2A)
│   │   ├── anomaly-detector/     ← Alert generation (Phase 2A)
│   │   └── sentiment-analyzer/   ← Sentiment (Phase 2B)
│   ├── shared/                   ← Shared models
│   │   └── models/
│   ├── docker-compose.yml        ← Local dev environment
│   └── scripts/
│       └── generate_test_data.py ← Synthetic data generator
└── README.md
```

## Documentation

### Getting Started
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Setup and quick start
- [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) - Better Auth setup
- [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) - Development practices

### Architecture & Planning
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and decisions
- [ROADMAP.md](./ROADMAP.md) - Detailed phase breakdown
- [COST_BREAKDOWN.md](./COST_BREAKDOWN.md) - GCP vs AWS cost analysis

### Feature Deep Dives
- [ANOMALY_DETECTION.md](./ANOMALY_DETECTION.md) - Early signal detection system
- [PHASE1_COMPLETE.md](./PHASE1_COMPLETE.md) - What's been built so far

## Key Features

### Phase 1 (Completed) ✅
- User authentication (JWT-based)
- User preferences & watchlist
- Reddit scraper (7 subreddits, every 15 min)
- Stock mention extraction
- Database models for posts, comments, stocks

### Phase 2A (Next - High Priority)
- Baseline metrics tracking (know what's "normal")
- Anomaly detection (volume spikes, cross-subreddit spread)
- Pump filtering (distinguish organic vs coordinated)
- Tunable thresholds (frontend-controlled experimentation)
- Real-time alerts

See [ROADMAP.md](./ROADMAP.md) for full timeline.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get profile
- `PUT /api/auth/me` - Update profile

### Watchlist
- `GET /api/watchlist` - Get user watchlist
- `POST /api/watchlist/{symbol}` - Add to watchlist
- `DELETE /api/watchlist/{symbol}` - Remove from watchlist

### Anomaly Detection (Phase 2A - Future)
- `GET /api/anomalies/alerts` - Get recent alerts
- `GET /api/anomalies/config` - Get detection config
- `PUT /api/anomalies/config` - Update thresholds
- `POST /api/anomalies/alerts/{id}/feedback` - Provide feedback

See API docs at http://localhost:8000/docs when running locally.

## Workers

### Reddit Scraper (Running)
**Purpose**: Collect stock discussions from Reddit

**Runs**: Every 15 minutes

**Subreddits**: r/wallstreetbets, r/stocks, r/investing, r/StockMarket, r/pennystocks, r/Daytrading, r/options

**Output**: Stores posts + top 20 comments per post with stock mentions

### Metrics Aggregator (Phase 2A)
**Purpose**: Calculate baseline metrics for each stock

**Runs**: Every 5-15 minutes

**Metrics**: Mention volume, subreddit diversity, author diversity, engagement, velocity

**Output**: Stores rolling window metrics (1h, 6h, 24h, 7d)

### Anomaly Detector (Phase 2A)
**Purpose**: Detect early signals before stocks go viral

**Runs**: Continuously

**Algorithm**: Compare current metrics vs baseline with tunable thresholds

**Output**: Creates anomaly alerts with confidence scores

See [ANOMALY_DETECTION.md](./ANOMALY_DETECTION.md) for deep dive.

## Development Workflow

### Daily Development
```bash
# Terminal 1: Backend
cd backend && docker-compose up

# Terminal 2: Frontend
npm run dev

# Terminal 3: Development tasks
# Make changes, run tests, etc.
```

### Making Changes

**Frontend changes**: Hot reload automatically

**Backend API changes**:
```bash
docker-compose restart api-gateway
```

**Worker changes**:
```bash
docker-compose up -d --build reddit-scraper
```

See [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) for detailed workflows.

## Deployment

### Frontend (Vercel)
```bash
git push origin main  # Auto-deploys
```

### Backend (GCP Cloud Run)
```bash
# Deploy API
cd backend/api-gateway
gcloud builds submit --tag gcr.io/PROJECT/api-gateway
gcloud run deploy api-gateway --image gcr.io/PROJECT/api-gateway

# Deploy worker
cd backend/workers/reddit-scraper
gcloud builds submit --tag gcr.io/PROJECT/reddit-scraper
gcloud run jobs create reddit-scraper --image gcr.io/PROJECT/reddit-scraper
```

See [ROADMAP.md](./ROADMAP.md) Phase 0 for cloud setup instructions.

## Monitoring

### Local
```bash
# Logs
docker-compose logs -f api-gateway reddit-scraper

# Database
docker-compose exec postgres psql -U akleao -d akleao
```

### Production (GCP)
```bash
# Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Cloud SQL metrics
gcloud sql operations list --instance=akleao-db
```

## Cost Estimates

| Phase | GCP Monthly Cost | What It Includes |
|-------|-----------------|------------------|
| **Phase 0-1** (MVP) | ~$45 | Cloud SQL + Cloud Run + workers |
| **Phase 2** (Full System) | ~$80 | + AI APIs + BigQuery |
| **Phase 3** (1k users) | ~$150 | + CDN + increased usage |

See [COST_BREAKDOWN.md](./COST_BREAKDOWN.md) for detailed breakdown.

## Success Metrics

### Phase 2A Success Criteria
- Detect at least 3 early signals per week
- <20% false positive rate
- Alert users at least 6 hours before mainstream awareness

### Phase 2B Success Criteria
- Reduce false positives by 50%
- Improve prediction accuracy to >60%

### Phase 3 Success Criteria
- Users check "For You" page daily
- >50% of insights lead to user action

## Contributing

This is currently a solo project. Open to contributions once Phase 2A is complete.

## Troubleshooting

### Docker Issues
```bash
# Restart everything
docker-compose restart

# Clean slate
docker-compose down -v
docker-compose up -d
```

### Database Connection
```bash
# Check PostgreSQL
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U akleao -d akleao -c "SELECT 1;"
```

### Reddit Scraper Not Working
```bash
# Check logs
docker-compose logs reddit-scraper

# Verify API credentials
docker-compose exec reddit-scraper env | grep REDDIT
```

See [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) for more troubleshooting.

## Next Steps

1. ✅ Complete Phase 1 (DONE)
2. 🎯 Set up GCP infrastructure (Phase 0)
3. 🎯 Integrate Better Auth with frontend
4. 🎯 Begin Phase 2A (anomaly detection)
5. Collect real Reddit data for 1-2 weeks to establish baselines
6. Experiment with detection thresholds via frontend

See [ROADMAP.md](./ROADMAP.md) for complete timeline.

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Better Auth Documentation](https://better-auth.com/)
- [GCP Cloud Run Documentation](https://cloud.google.com/run/docs)
- [PRAW (Reddit API)](https://praw.readthedocs.io/)
- [Anthropic Claude API](https://docs.anthropic.com/)

## License

Private project - All rights reserved
