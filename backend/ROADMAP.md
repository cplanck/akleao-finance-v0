# Akleao Finance Development Roadmap

## Vision

Build an **early signal detection system** that identifies stocks gaining traction on Reddit **before they go viral**, giving users an information edge for investment decisions.

---

## Phase 0: Foundation & Cloud Setup

**Goal**: Get local development working and prepare cloud infrastructure.

### Step 0.1: Verify Local Setup ✅
**Status**: Ready to test

```bash
cd backend
cp .env.example .env
# Add Reddit API keys
docker-compose up
```

**Validation checklist**:
- [ ] Can register a user via API
- [ ] Reddit scraper runs without errors
- [ ] Database has posts after 15 minutes
- [ ] API docs accessible at http://localhost:8000/docs

**Time**: 15-30 minutes

### Step 0.2: GCP Project Setup
**Status**: Not started

**Actions**:
1. Create GCP account (free $300 credit)
2. Create project: `akleao-finance-prod`
3. Enable billing
4. Install `gcloud` CLI
5. Authenticate: `gcloud auth login`

**Cost**: $0 (free tier + credits)
**Time**: 10-15 minutes

### Step 0.3: Cloud SQL Setup
**Status**: Not started

```bash
# Create PostgreSQL instance
gcloud sql instances create akleao-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create akleao --instance=akleao-db
```

**Cost**: ~$10/month
**Time**: 20-30 minutes

### Step 0.4: Deploy API Gateway to Cloud Run
**Status**: Not started

```bash
cd backend/api-gateway
gcloud builds submit --tag gcr.io/PROJECT/api-gateway
gcloud run deploy api-gateway --image gcr.io/PROJECT/api-gateway
```

**Cost**: ~$2/month
**Time**: 30 minutes

### Step 0.5: Deploy Reddit Scraper as Scheduled Job
**Status**: Not started

```bash
cd backend/workers/reddit-scraper
gcloud builds submit --tag gcr.io/PROJECT/reddit-scraper
gcloud run jobs create reddit-scraper --image gcr.io/PROJECT/reddit-scraper
gcloud scheduler jobs create http reddit-scraper-schedule --schedule="*/15 * * * *"
```

**Cost**: ~$5/month
**Time**: 30 minutes

### Step 0.6: Set Up Pub/Sub (Event Queue)
**Status**: Not started

```bash
gcloud pubsub topics create stock-anomalies
gcloud pubsub subscriptions create anomaly-processor --topic=stock-anomalies
```

**Cost**: $0 (free tier)
**Time**: 10 minutes

**Phase 0 Total Cost**: ~$45/month

---

## Phase 1: Core Infrastructure ✅

**Status**: COMPLETED
**Duration**: 2-3 days

### 1.1 Authentication System ✅
- User registration and login
- JWT token-based authentication
- Password hashing with bcrypt
- User profile management
- Watchlist functionality
- Investment preference tracking

**Endpoints**:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `POST /api/auth/watchlist/{symbol}`

### 1.2 Reddit Scraper Worker ✅
- Scrapes 7 financial subreddits every 15 minutes
- Extracts stock ticker mentions ($AAPL, $TSLA, etc.)
- Stores posts and top 20 comments per post
- Filters relevant financial discussions
- Tracks engagement metrics (score, upvotes, comments)

**Subreddits monitored**:
- r/wallstreetbets, r/stocks, r/investing
- r/StockMarket, r/pennystocks, r/Daytrading, r/options

### 1.3 Database Models ✅
- User (authentication & preferences)
- Stock (cached price data & sentiment)
- RedditPost & RedditComment (social data)
- NewsArticle, SentimentAnalysis, ResearchReport, UserInsight (scaffolded)

### 1.4 Docker Infrastructure ✅
- PostgreSQL (port 5432)
- Redis (port 6379)
- API Gateway (port 8000)
- Reddit Scraper (background worker)

**What's Being Collected**: After 30 minutes of running, database contains Reddit posts with stock mentions, engagement metrics, and metadata.

---

## Phase 2A: Anomaly Detection (Tunable System)

**Goal**: Detect early signals **before** stocks go viral.

**Status**: Not started
**Estimated Duration**: 1-2 weeks
**Priority**: HIGH - This is the core value proposition

### 2A.1: Database Schema Extensions
**New tables**:

```sql
-- Baseline metrics per stock
CREATE TABLE stock_metrics (
  id SERIAL PRIMARY KEY,
  stock_symbol VARCHAR(10),
  window VARCHAR(10),  -- '1h', '6h', '24h', '7d'
  mentions_count INTEGER,
  subreddit_diversity INTEGER,
  author_diversity FLOAT,
  avg_post_length INTEGER,
  avg_score FLOAT,
  comment_engagement_rate FLOAT,
  mention_velocity FLOAT,
  calculated_at TIMESTAMP
);

-- Detected anomalies
CREATE TABLE anomaly_alerts (
  id SERIAL PRIMARY KEY,
  stock_symbol VARCHAR(10),
  anomaly_type VARCHAR(50),  -- 'volume_spike', 'cross_subreddit', 'high_quality_dd'
  confidence_score FLOAT,
  pump_risk_score FLOAT,
  trigger_metrics JSONB,  -- What caused the alert
  description TEXT,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP
);

-- Tunable detection config
CREATE TABLE detection_config (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50),  -- NULL for global, or per-user override
  config_name VARCHAR(50),
  thresholds JSONB,  -- Volume multipliers, diversity thresholds, etc.
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP
);
```

**Time**: 1-2 hours

### 2A.2: Metrics Aggregator Worker
**Purpose**: Calculate baseline metrics for anomaly detection

**Logic**:
```python
Every 5-15 minutes:
  For each stock:
    - Count mentions in last 1h, 6h, 24h, 7d
    - Calculate subreddit diversity (# unique subs)
    - Calculate author diversity (unique authors / total mentions)
    - Calculate avg post length, score, comments
    - Calculate mention velocity (acceleration)
    - Store in stock_metrics table
```

**Output**: Know what's "normal" for each stock.

**Time**: 2-3 days

### 2A.3: Anomaly Detector Worker
**Purpose**: Compare current metrics vs baseline, generate alerts

**Detection algorithm**:
```python
config = get_detection_config(user_id)

for stock in stocks_with_recent_activity:
  current = get_current_metrics(stock, window='6h')
  baseline = get_baseline_metrics(stock, window='24h')

  # Volume anomaly
  if current.mentions > (baseline.mentions * config.volume_multiplier):

    # Quality filters
    if current.author_diversity > config.min_author_diversity:
      if current.avg_post_length > config.min_post_length:

        # Pump detection
        pump_risk = calculate_pump_risk(current)
        if pump_risk < config.max_pump_risk:

          # Create alert
          create_anomaly_alert(
            stock=stock,
            type='volume_spike',
            confidence=calculate_confidence(current, baseline),
            pump_risk=pump_risk,
            metrics=current
          )
```

**Tunable thresholds** (via frontend):
- `volume_multiplier`: Default 3x (trigger when mentions 3x above normal)
- `min_mentions_absolute`: Default 5 (ignore low-volume noise)
- `subreddit_diversity_threshold`: Default 2 (cross-subreddit spread)
- `min_author_diversity`: Default 0.6 (60% unique authors)
- `min_post_length`: Default 100 chars (filter spam)
- `max_pump_risk`: Default 0.5 (50% pump probability threshold)

**Time**: 3-4 days

### 2A.4: Pump Filter Logic
**Purpose**: Distinguish organic interest from coordinated pumps

**Red flags**:
```python
def calculate_pump_risk(metrics):
  risk_score = 0.0

  # Low author diversity = coordinated
  if metrics.author_diversity < 0.3:
    risk_score += 0.4

  # Many new accounts = suspicious
  new_account_ratio = count_accounts_under_30_days() / total_authors
  if new_account_ratio > 0.5:
    risk_score += 0.3

  # Copy-paste content = bots
  duplicate_content_ratio = detect_duplicate_posts()
  if duplicate_content_ratio > 0.3:
    risk_score += 0.2

  # Excessive emojis = pump spam
  emoji_density = count_emojis() / total_chars
  if emoji_density > 0.05:  # >5% emojis
    risk_score += 0.1

  return min(risk_score, 1.0)
```

**Time**: 2-3 days

### 2A.5: API Endpoints for Tuning
```python
# Get current detection config
GET /api/anomalies/config

# Update thresholds (admin/user)
PUT /api/anomalies/config
Body: {
  "volume_multiplier": 4.0,
  "min_author_diversity": 0.7,
  ...
}

# Get recent alerts
GET /api/anomalies/alerts?limit=20&stock=AAPL&min_confidence=0.7

# Provide feedback (training loop)
POST /api/anomalies/alerts/{id}/feedback
Body: {"useful": true}  # or false

# Backtest thresholds on historical data
POST /api/anomalies/backtest
Body: {
  "config": {...thresholds...},
  "date_range": "2024-01-01 to 2024-01-31"
}
```

**Time**: 2 days

### 2A.6: Frontend Dashboard
**Components**:
1. **Alerts Feed**: Real-time anomaly alerts
2. **Config Panel**: Sliders to adjust thresholds
3. **Stock Detail**: Metrics visualization over time
4. **Feedback UI**: 👍/👎 buttons to train the system
5. **Backtesting Tool**: Test configs on historical data

**Time**: 3-4 days

**Phase 2A Total Time**: 1-2 weeks
**Phase 2A Additional Cost**: Minimal (~$5-10/month for extra workers)

---

## Phase 2B: Quality Scoring & Refinement

**Goal**: Improve signal-to-noise ratio.

**Status**: Not started
**Estimated Duration**: 1 week

### 2B.1: Author Reputation System
**Track per author**:
- Historical prediction accuracy (did their stock picks move?)
- Account age and karma
- Post quality (length, engagement)
- Spam/shill patterns

**Use case**: Weight comments from experienced users more heavily.

**Time**: 3-4 days

### 2B.2: Thread Structure Analysis
**Instead of analyzing comments individually**:
- Analyze entire threads as conversations
- Track argument structure (claim → evidence → counterargument)
- Identify "DD" (due diligence) posts vs memes

**Time**: 3-4 days

### 2B.3: Content Quality Classifier
**Use LLM to classify**:
- High-quality DD (research-backed)
- Opinion (personal belief)
- Meme/joke (ignore)
- Pump attempt (spam)

**Time**: 2-3 days

**Phase 2B Total Time**: 1 week
**Phase 2B Cost**: +$10/month (OpenAI API calls)

---

## Phase 2C: Deep Analysis with RAG

**Goal**: Generate detailed summaries only for promising signals.

**Status**: Not started
**Estimated Duration**: 1-2 weeks

### 2C.1: Vector Database Setup
**Options**:
- Pgvector (PostgreSQL extension) - Simple, cheaper
- Pinecone - Managed, more features

**Store embeddings of**:
- Reddit post summaries
- News article summaries
- Research reports

**Time**: 1-2 days

### 2C.2: RAG Pipeline
**Triggered only for high-confidence anomalies**:

```python
anomaly = get_high_confidence_anomaly(stock='RKLB')

# Retrieve relevant context
relevant_posts = vector_search(
  query=f"Recent discussions about {anomaly.stock}",
  limit=20
)

# LLM synthesis
summary = claude.generate(
  prompt=f"""
  Analyze recent Reddit discussions about {anomaly.stock}.

  Context: {relevant_posts}

  Provide:
  1. Key claims being made
  2. What's driving the interest (catalyst)?
  3. Consensus sentiment
  4. Notable counter-arguments
  5. Your confidence in this being a genuine opportunity vs pump
  """,
  temperature=0.3
)

store_research_report(anomaly, summary)
```

**Time**: 1 week

### 2C.3: Cross-Reference with News
**Before generating final summary**:
- Fetch recent news about the stock
- Compare Reddit narrative vs news narrative
- Flag discrepancies (Reddit ahead of news? or lagging?)

**Time**: 2-3 days

**Phase 2C Total Time**: 1-2 weeks
**Phase 2C Cost**: +$20-30/month (Anthropic API + vector DB)

---

## Phase 3: "For You" Insights & Personalization

**Goal**: Generate personalized insight feed based on user preferences.

**Status**: Not started (low priority until Phase 2 complete)
**Estimated Duration**: 2-3 weeks

### 3.1: User Preference Engine
- Track user's watchlist, sectors of interest
- Learn from user feedback (which alerts were useful?)
- Investment style matching (value, growth, dividend, etc.)

### 3.2: Insights Generator Worker
- Combine anomaly alerts + research reports + user preferences
- Generate personalized "For You" insights
- Prioritize by relevance score

### 3.3: Real-Time Updates
- WebSocket support for live alerts
- Push notifications (optional)

**Phase 3 Total Time**: 2-3 weeks

---

## Timeline Summary

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|--------------|
| **Phase 0** | 2-3 days | HIGH | None |
| **Phase 1** | DONE ✅ | - | Phase 0 |
| **Phase 2A** | 1-2 weeks | HIGH | Phase 1 |
| **Phase 2B** | 1 week | MEDIUM | Phase 2A |
| **Phase 2C** | 1-2 weeks | MEDIUM | Phase 2A |
| **Phase 3** | 2-3 weeks | LOW | Phase 2A+2B+2C |

**Total to MVP (Phase 2A)**: ~3-4 weeks
**Total to Full System**: ~8-10 weeks

---

## Success Metrics

### Phase 2A Success
- Detect at least 3 early signals per week
- <20% false positive rate
- Alert users at least 6 hours before mainstream awareness

### Phase 2B Success
- Reduce false positives by 50%
- Improve prediction accuracy to >60%

### Phase 2C Success
- Generate actionable summaries in <5 seconds
- 80% of summaries rated "useful" by users

### Phase 3 Success
- Users check "For You" page daily
- >50% of insights lead to user action (research, watchlist add)

---

## Next Steps

1. **Right now**: Complete Phase 0.1 (verify local setup works)
2. **This week**: Integrate Better Auth (see [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md))
3. **Next week**: Begin Phase 2A (anomaly detection)
4. **Ongoing**: Collect real Reddit data for baseline establishment

See [ANOMALY_DETECTION.md](./ANOMALY_DETECTION.md) for deep dive on Phase 2A.
