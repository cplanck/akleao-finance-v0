# Akleao Finance Backend Architecture

## System Overview

Akleao Finance is an **early signal detection system** for stock market discussions on Reddit. The goal is to identify stocks gaining organic traction **before they go viral**, giving users an edge in discovering investment opportunities.

## Core Problem Being Solved

**Problem**: By the time a stock is trending on Reddit, it's often too late to benefit from the information. Price movement has already occurred.

**Solution**: Real-time anomaly detection that identifies unusual patterns in stock mentions:
- Volume spikes (3x+ above baseline)
- Cross-subreddit spread (organic interest)
- High-quality DD (due diligence) posts emerging
- Early-stage coordinated activity detection

## High-Level Architecture

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

## Why Google Cloud Platform (GCP)?

After comparing AWS and GCP, we chose **GCP** for several key reasons:

### GCP Advantages
1. **Cloud Run** - Superior to ECS Fargate
   - Auto-scales to zero (pay only when processing)
   - Simpler deployment (one command)
   - Better for bursty workloads (Reddit scraper)
   - ~40% cheaper for our use case

2. **BigQuery** - Built-in data warehouse
   - Perfect for historical Reddit data analysis
   - SQL-based, easy to query trends
   - Scales automatically

3. **Pub/Sub** - Simpler than SQS/SNS
   - Native event-driven architecture
   - Better integration with Cloud Run

4. **Cloud SQL** - Easier PostgreSQL setup
   - Automatic backups
   - Point-in-time recovery
   - Less configuration than AWS RDS

5. **Cost** - ~30-40% cheaper overall
   - Free tier more generous
   - Simpler pricing model

### When AWS Might Be Better
- If using AWS Bedrock for AI (we're using Anthropic/OpenAI directly)
- If team has deep AWS expertise (we're open to learning)
- If already invested in AWS ecosystem

## Database Architecture

### Shared Database Model

We use **one PostgreSQL database** per environment:
- **Local Dev**: Docker Compose PostgreSQL on your laptop
- **Production**: Cloud SQL in GCP

All services connect to the same database:
- Better Auth tables: `user`, `session`, `account`
- Backend tables: `users` (preferences), `reddit_posts`, `reddit_comments`, `anomaly_alerts`, etc.

### Why Shared Database?

**Pros**:
- Simpler architecture (no cross-service queries)
- Easier transactions (user + preferences in one DB)
- Lower cost (one database instance)
- Better for small-medium scale

**Cons**:
- Potential bottleneck at massive scale (not our problem yet)
- Schema migrations affect multiple services

**Decision**: Start with shared database. If we reach millions of users, we can split later.

## Authentication Architecture

### Better Auth + FastAPI Backend

```
User → Next.js Login (Better Auth) → JWT Token
    ↓
Frontend stores JWT
    ↓
API calls include: Authorization: Bearer <JWT>
    ↓
FastAPI validates JWT → Looks up user preferences
    ↓
Returns user-specific data
```

### Why Better Auth Instead of Custom?

1. **Production-ready**: Battle-tested, secure, maintained
2. **UI/UX included**: Login/register pages, email verification, etc.
3. **OAuth support**: Google, GitHub login (future)
4. **Next.js native**: Built for Next.js 15 App Router
5. **Time savings**: Focus on unique features, not auth plumbing

### User Model Sync

- **Better Auth manages**: Email, password, sessions
- **Backend manages**: Investment preferences, watchlist, alert settings
- **Link**: `better_auth_user_id` column in backend `users` table

## Data Pipeline

### Stage 1: Ingestion (Reddit Scraper)
```
Every 5-15 minutes:
1. Scrape hot posts from 7 financial subreddits
2. Extract stock mentions ($AAPL, $TSLA, etc.)
3. Store posts + top 20 comments
4. Track metadata (score, subreddit, author, timestamp)
```

**Subreddits monitored**:
- r/wallstreetbets (high volume, meme stocks)
- r/stocks (serious discussion)
- r/investing (value investors)
- r/StockMarket (general market)
- r/pennystocks (small-cap opportunities)
- r/Daytrading (short-term plays)
- r/options (derivatives discussion)

### Stage 2: Baseline Tracking (Metrics Aggregator)
```
Every 5-15 minutes:
1. For each stock, calculate rolling metrics:
   - Mention volume (1h, 6h, 24h, 7d windows)
   - Subreddit diversity (# unique subs mentioning it)
   - Author diversity (# unique authors / total mentions)
   - Average post length (filter low-effort spam)
   - Comment engagement rate
   - Mention velocity (acceleration)
2. Store in stock_metrics table
```

**Purpose**: Know what's "normal" for each stock so we can detect anomalies.

### Stage 3: Anomaly Detection (Real-time Alerts)
```
Continuously compare current metrics vs baseline:

IF mention_volume_6h > (baseline_24h * threshold)
   AND author_diversity > 0.6
   AND avg_post_length > 100
   AND NOT pump_pattern_detected
THEN create_anomaly_alert()
```

**Key**: Thresholds are **tunable via frontend** for experimentation.

### Stage 4: Quality Filtering (Pump Detection)
```
Flag suspicious patterns:
- Low author diversity (<0.3) = coordinated
- New accounts (<30 days) = potential shills
- Copy-paste content = bot behavior
- Excessive emojis (🚀🚀🚀) = pump attempt

Calculate pump_risk_score (0-1)
Only alert if pump_risk < 0.5
```

### Stage 5: Deep Analysis (Future - Phase 2C)
```
For high-confidence anomalies:
1. RAG-based retrieval of all related discussions
2. LLM synthesis (Claude/GPT-4)
3. Extract key claims and catalysts
4. Cross-reference with news/fundamentals
5. Generate detailed summary with citations
```

## Monorepo Structure

```
akleao-finance-v0/                 (Git root)
├── app/                           ← Next.js frontend
├── components/
├── lib/
├── package.json                   ← Frontend deps
├── backend/                       ← Python backend
│   ├── api-gateway/              ← FastAPI server
│   ├── workers/
│   │   ├── reddit-scraper/       ← Data collection
│   │   ├── metrics-aggregator/   ← Baseline tracking
│   │   ├── anomaly-detector/     ← Alert generation
│   │   └── ...                   ← Future workers
│   ├── shared/
│   │   └── models/               ← Shared DB models
│   ├── docker-compose.yml        ← Local dev environment
│   └── scripts/
│       └── generate_test_data.py ← Synthetic data generator
└── README.md
```

### Why Monorepo?

**Pros**:
- Atomic commits (frontend + backend changes together)
- Shared TypeScript types (API contracts)
- Easier local development (one `git clone`)
- Better for solo/small team

**Cons**:
- Need separate deployments (but we planned for this)
- Dependency management requires discipline

**Decision**: Monorepo is ideal for your use case.

## Deployment Strategy

### Local Development
```bash
# Terminal 1: Start backend
cd backend
docker-compose up

# Terminal 2: Start frontend
npm run dev
```

Both connect to local Docker PostgreSQL.

### Production Deployment

**Frontend** (Vercel):
```bash
git push main
# Vercel auto-deploys from /
# Points to GCP Cloud SQL database
```

**Backend** (GCP Cloud Run):
```bash
cd backend/api-gateway
gcloud builds submit --tag gcr.io/PROJECT/api-gateway
gcloud run deploy api-gateway --image gcr.io/PROJECT/api-gateway
```

**Workers** (GCP Cloud Run Jobs + Scheduler):
```bash
cd backend/workers/reddit-scraper
gcloud builds submit --tag gcr.io/PROJECT/reddit-scraper
gcloud run jobs create reddit-scraper --image gcr.io/PROJECT/reddit-scraper
gcloud scheduler jobs create http reddit-scraper-schedule --schedule="*/15 * * * *"
```

## Scalability Plan

### Current Scale (Phase 1-2)
- **Users**: 1-100
- **Reddit posts/day**: ~1,000
- **API requests**: ~10k/day
- **Cost**: ~$45/month

### Medium Scale (Phase 3)
- **Users**: 100-10,000
- **Reddit posts/day**: ~10,000
- **API requests**: ~1M/day
- **Cost**: ~$150-200/month
- **Changes needed**:
  - Increase Cloud SQL tier (still f1-micro)
  - Add Cloud CDN for API
  - Optimize queries (add indexes)

### Large Scale (Future)
- **Users**: 10k+
- **Changes needed**:
  - Separate read replicas for Cloud SQL
  - BigQuery for historical analytics
  - Consider microservices split
  - Add caching layer (Redis)

## Technology Stack Summary

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

## Security Considerations

1. **Authentication**: Better Auth handles securely
2. **API Keys**: Stored in GCP Secret Manager
3. **Database**: Private IP, no public access
4. **API**: JWT validation on all protected endpoints
5. **Rate Limiting**: Implemented in FastAPI
6. **CORS**: Strict origin policy

## Monitoring & Observability

### Logs
- **Frontend**: Vercel logs
- **Backend**: GCP Cloud Logging
- **Workers**: GCP Cloud Logging

### Metrics
- **API performance**: Cloud Run metrics
- **Database**: Cloud SQL monitoring
- **Custom metrics**: Anomaly detection accuracy

### Alerts
- **API errors**: >1% error rate
- **Database**: Connection pool exhaustion
- **Workers**: Job failures
- **Cost**: >$100/day unexpected spike

## Next Steps

See [ROADMAP.md](./ROADMAP.md) for detailed phase breakdown.

See [ANOMALY_DETECTION.md](./ANOMALY_DETECTION.md) for early signal detection deep dive.

See [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md) for Better Auth setup.

See [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) for development practices.
