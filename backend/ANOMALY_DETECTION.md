# Anomaly Detection: Early Signal Detection System

## The Problem We're Solving

**Scenario**: A small-cap stock is gaining traction on Reddit.

**Day 1 (2am ET)**:
- 3 mentions on r/pennystocks
- Quality DD post with research
- **Stock price**: $5.20

**Day 2 (10am ET)**:
- 25 mentions across r/stocks, r/investing
- Growing organically
- **Stock price**: $5.45 (+4.8%)

**Day 3 (market open)**:
- 500+ mentions, trending on r/wallstreetbets
- Mainstream financial Twitter picks it up
- **Stock price**: $7.80 (+50% from Day 1)

**The Question**: Can we alert users on **Day 1** or early **Day 2** instead of **Day 3**?

**Answer**: Yes, with anomaly detection + quality filtering.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ 1. CONTINUOUS INGESTION (Every 5-15 min)               │
├─────────────────────────────────────────────────────────┤
│ • Reddit Scraper collects posts/comments               │
│ • Extract stock mentions                                │
│ • Store with metadata (score, subreddit, author, time)  │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 2. BASELINE TRACKING (Every 5-15 min)                  │
├─────────────────────────────────────────────────────────┤
│ Metrics Aggregator calculates per-stock:               │
│ • Mention volume (1h, 6h, 24h, 7d windows)             │
│ • Subreddit diversity                                   │
│ • Author diversity                                      │
│ • Average post length                                   │
│ • Comment engagement rate                               │
│ • Mention velocity (acceleration)                       │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 3. ANOMALY DETECTION (Real-time)                       │
├─────────────────────────────────────────────────────────┤
│ Compare current metrics vs baseline:                   │
│ IF volume > (baseline * threshold)                     │
│    AND quality_filters_pass                            │
│    AND NOT pump_detected                               │
│ THEN create_alert()                                    │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 4. PUMP FILTERING (Fraud detection)                    │
├─────────────────────────────────────────────────────────┤
│ Calculate pump_risk_score:                             │
│ • Low author diversity = coordinated                    │
│ • New accounts = shills                                 │
│ • Copy-paste content = bots                             │
│ • Excessive emojis = spam                               │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 5. USER ALERT (Early signal!)                          │
├─────────────────────────────────────────────────────────┤
│ "🔔 RKLB mentions up 400% in last 6h"                   │
│ "Spreading from r/stocks to r/investing"               │
│ "Organic discussion about new contract"                │
│ "Confidence: 75% | Pump Risk: 15%"                     │
└─────────────────────────────────────────────────────────┘
```

---

## Key Metrics Tracked

### 1. Mention Volume

**What**: Count of stock mentions over time windows.

**Why**: Sudden spikes indicate growing interest.

**Implementation**:
```python
def calculate_mention_volume(stock_symbol, windows=['1h', '6h', '24h', '7d']):
    for window in windows:
        cutoff_time = now() - timedelta(hours=parse_hours(window))

        count = db.query(RedditPost).filter(
            RedditPost.mentioned_stocks.contains([stock_symbol]),
            RedditPost.created_at > cutoff_time
        ).count()

        count += db.query(RedditComment).filter(
            RedditComment.mentioned_stocks.contains([stock_symbol]),
            RedditComment.created_at > cutoff_time
        ).count()

        store_metric(stock_symbol, f'mentions_{window}', count)
```

**Baseline Example**:
- AAPL: 500 mentions/day (normal)
- RKLB: 3 mentions/day (normal)
- **Anomaly**: RKLB suddenly has 15 mentions/6h → 5x above baseline

### 2. Subreddit Diversity

**What**: Number of unique subreddits mentioning the stock.

**Why**: Cross-subreddit spread indicates organic interest, not isolated hype.

**Implementation**:
```python
def calculate_subreddit_diversity(stock_symbol, window='6h'):
    cutoff_time = now() - timedelta(hours=6)

    subreddits = db.query(distinct(RedditPost.subreddit)).filter(
        RedditPost.mentioned_stocks.contains([stock_symbol]),
        RedditPost.created_at > cutoff_time
    ).all()

    return len(subreddits)
```

**Signal Example**:
- Day 1: Only r/pennystocks (diversity=1)
- Day 2: r/pennystocks + r/stocks + r/Daytrading (diversity=3) ← **Spreading**

### 3. Author Diversity

**What**: Ratio of unique authors to total mentions.

**Why**: High diversity = organic. Low diversity = coordinated pump.

**Implementation**:
```python
def calculate_author_diversity(stock_symbol, window='6h'):
    cutoff_time = now() - timedelta(hours=6)

    total_mentions = get_mention_count(stock_symbol, window)
    unique_authors = db.query(distinct(RedditPost.author)).filter(
        RedditPost.mentioned_stocks.contains([stock_symbol]),
        RedditPost.created_at > cutoff_time
    ).count()

    return unique_authors / max(total_mentions, 1)
```

**Interpretation**:
- Ratio 0.8+ (80% unique authors) = Organic
- Ratio 0.3- (30% unique authors) = Coordinated

**Example**:
- 20 mentions from 16 different users = 0.8 diversity ✓
- 20 mentions from 3 users = 0.15 diversity ✗ (likely pump)

### 4. Average Post Length

**What**: Mean character count of posts/comments.

**Why**: Longer posts = substance. Short posts = likely spam/memes.

**Implementation**:
```python
def calculate_avg_post_length(stock_symbol, window='6h'):
    cutoff_time = now() - timedelta(hours=6)

    posts = db.query(RedditPost).filter(
        RedditPost.mentioned_stocks.contains([stock_symbol]),
        RedditPost.created_at > cutoff_time
    ).all()

    lengths = [len(post.title) + len(post.content or '') for post in posts]
    return sum(lengths) / max(len(lengths), 1)
```

**Threshold**: >100 chars avg (filters "🚀🚀🚀 to the moon!" spam)

### 5. Comment Engagement Rate

**What**: Comments per post ratio.

**Why**: High engagement = people are debating/discussing (signal). Low = just mentions (noise).

**Implementation**:
```python
def calculate_engagement_rate(stock_symbol, window='6h'):
    cutoff_time = now() - timedelta(hours=6)

    posts = db.query(RedditPost).filter(
        RedditPost.mentioned_stocks.contains([stock_symbol]),
        RedditPost.created_at > cutoff_time
    ).all()

    total_comments = sum(post.num_comments for post in posts)
    return total_comments / max(len(posts), 1)
```

**Interpretation**:
- >10 comments/post avg = High engagement (people care)
- <3 comments/post avg = Low engagement (passing mention)

### 6. Mention Velocity

**What**: Rate of acceleration in mentions.

**Why**: Catching acceleration early = catching trend early.

**Implementation**:
```python
def calculate_mention_velocity(stock_symbol):
    hour_0 = get_mentions(stock_symbol, 'last_1h')  # Most recent hour
    hour_1 = get_mentions(stock_symbol, '1h_to_2h_ago')
    hour_2 = get_mentions(stock_symbol, '2h_to_3h_ago')

    # Is it accelerating?
    if hour_0 > hour_1 > hour_2:
        return 'accelerating'
    elif hour_0 < hour_1 < hour_2:
        return 'decelerating'
    else:
        return 'stable'
```

**Example**:
- 3h ago: 1 mention
- 2h ago: 3 mentions
- 1h ago: 8 mentions
- **Status**: Accelerating ← **Early signal**

---

## Anomaly Detection Algorithm

### Core Logic

```python
def detect_anomalies(stock_symbol):
    # Get configuration (tunable thresholds)
    config = get_detection_config()

    # Current metrics (last 6 hours)
    current = {
        'mentions_6h': get_metric(stock_symbol, 'mentions_6h'),
        'subreddit_diversity': get_metric(stock_symbol, 'subreddit_diversity_6h'),
        'author_diversity': get_metric(stock_symbol, 'author_diversity_6h'),
        'avg_post_length': get_metric(stock_symbol, 'avg_post_length_6h'),
        'engagement_rate': get_metric(stock_symbol, 'engagement_rate_6h'),
        'velocity': get_metric(stock_symbol, 'mention_velocity')
    }

    # Baseline (last 24 hours average)
    baseline = {
        'mentions_24h_avg': get_metric(stock_symbol, 'mentions_24h') / 4  # 6h window
    }

    # ANOMALY CHECK 1: Volume Spike
    volume_multiplier = current['mentions_6h'] / max(baseline['mentions_24h_avg'], 1)
    if volume_multiplier < config['volume_multiplier_threshold']:
        return None  # Not anomalous enough

    # ANOMALY CHECK 2: Minimum Absolute Volume
    if current['mentions_6h'] < config['min_mentions_absolute']:
        return None  # Too few mentions to be meaningful

    # QUALITY CHECK 1: Author Diversity
    if current['author_diversity'] < config['min_author_diversity']:
        return None  # Likely coordinated, not organic

    # QUALITY CHECK 2: Content Quality
    if current['avg_post_length'] < config['min_post_length']:
        return None  # Low-effort spam

    # PUMP CHECK: Calculate fraud risk
    pump_risk = calculate_pump_risk(stock_symbol, current)
    if pump_risk > config['max_pump_risk']:
        return None  # Likely pump attempt

    # ALL CHECKS PASSED → Create Alert
    confidence = calculate_confidence_score(current, baseline, volume_multiplier)

    alert = {
        'stock_symbol': stock_symbol,
        'anomaly_type': 'volume_spike',
        'confidence_score': confidence,
        'pump_risk_score': pump_risk,
        'volume_multiplier': volume_multiplier,
        'current_metrics': current,
        'baseline_metrics': baseline,
        'description': generate_description(stock_symbol, current, volume_multiplier)
    }

    create_anomaly_alert(alert)
    return alert
```

### Tunable Thresholds (Configurable via Frontend)

```python
DEFAULT_CONFIG = {
    'volume_multiplier_threshold': 3.0,  # 3x above baseline
    'min_mentions_absolute': 5,          # At least 5 mentions
    'min_author_diversity': 0.6,         # 60% unique authors
    'min_post_length': 100,              # 100 chars avg
    'max_pump_risk': 0.5,                # 50% pump probability
    'subreddit_diversity_bonus': True,   # Boost confidence if spreading
    'velocity_bonus': True               # Boost confidence if accelerating
}
```

**Why Tunable?**
- Different users have different risk tolerances
- Need to experiment to find optimal thresholds
- Market conditions change (bear vs bull markets affect baseline)

---

## Pump Detection Logic

### Red Flags

```python
def calculate_pump_risk(stock_symbol, metrics):
    risk_score = 0.0

    # RED FLAG 1: Low Author Diversity
    # Coordinated pumps have same people posting repeatedly
    if metrics['author_diversity'] < 0.3:
        risk_score += 0.4

    # RED FLAG 2: Many New Accounts
    # Shills create accounts to pump
    new_account_ratio = get_new_account_ratio(stock_symbol, window='6h')
    if new_account_ratio > 0.5:  # >50% accounts <30 days old
        risk_score += 0.3

    # RED FLAG 3: Duplicate Content
    # Bots copy-paste the same message
    duplicate_ratio = detect_duplicate_content(stock_symbol, window='6h')
    if duplicate_ratio > 0.3:  # >30% posts are duplicates
        risk_score += 0.2

    # RED FLAG 4: Excessive Emojis
    # Pump spam uses 🚀🚀🚀 heavily
    emoji_density = count_emoji_density(stock_symbol, window='6h')
    if emoji_density > 0.05:  # >5% of content is emojis
        risk_score += 0.1

    # RED FLAG 5: Suspicious Timing
    # All mentions within 10-minute window = coordinated
    time_clustering = analyze_time_clustering(stock_symbol, window='6h')
    if time_clustering > 0.8:  # 80% of mentions in same 10min
        risk_score += 0.2

    return min(risk_score, 1.0)
```

### Example Scenarios

**Organic Signal (Low Pump Risk)**:
```
RKLB mentions:
- 15 mentions from 13 unique authors (0.87 diversity) ✓
- Account ages: 2y, 5y, 1y, 8mo, 3y... (mostly old) ✓
- Content varies significantly ✓
- Emojis: 2% of content ✓
- Timing spread across 6 hours ✓

→ Pump Risk: 0.1 (10%)
```

**Pump Attempt (High Pump Risk)**:
```
SCAM mentions:
- 20 mentions from 4 unique authors (0.2 diversity) ✗
- Account ages: 15d, 8d, 22d, 5d (all new) ✗
- Content: "SCAM to $100! 🚀🚀🚀" repeated ✗
- Emojis: 15% of content ✗
- Timing: All within 8-minute window ✗

→ Pump Risk: 0.9 (90%)
```

---

## Confidence Scoring

### How We Calculate Confidence

```python
def calculate_confidence_score(current, baseline, volume_multiplier):
    confidence = 0.0

    # BASE: Volume multiplier
    # Higher spike = higher confidence
    if volume_multiplier >= 5:
        confidence += 0.4
    elif volume_multiplier >= 3:
        confidence += 0.3
    else:
        confidence += 0.2

    # BONUS: Subreddit diversity
    # Cross-subreddit spread = organic interest
    if current['subreddit_diversity'] >= 3:
        confidence += 0.2
    elif current['subreddit_diversity'] >= 2:
        confidence += 0.1

    # BONUS: High engagement
    # Active discussion = real interest
    if current['engagement_rate'] > 10:
        confidence += 0.2
    elif current['engagement_rate'] > 5:
        confidence += 0.1

    # BONUS: Acceleration
    # Growing momentum = early trend
    if current['velocity'] == 'accelerating':
        confidence += 0.1

    # BONUS: Quality content
    # Long posts = research-backed
    if current['avg_post_length'] > 500:
        confidence += 0.1

    return min(confidence, 1.0)
```

### Confidence Interpretation

- **0.8-1.0** (80-100%): Very high confidence - strong organic signal
- **0.6-0.8** (60-80%): High confidence - likely worth investigating
- **0.4-0.6** (40-60%): Medium confidence - monitor closely
- **0.2-0.4** (20-40%): Low confidence - possibly noise
- **0.0-0.2** (0-20%): Very low - likely false alarm

---

## Thread Structure vs Individual Analysis

### The Debate

**Option 1: Analyze Individual Comments**
```
Post: "Thoughts on RKLB?"
├─ Comment 1: "Overvalued" → Sentiment: -0.5
├─ Comment 2: "Great long term" → Sentiment: +0.7
└─ Comment 3: "🚀🚀🚀" → Sentiment: +1.0

→ Average sentiment: +0.4
```

**Pros**: Fast, parallelizable
**Cons**: Loses context, misses debate structure

**Option 2: Analyze Entire Threads**
```
Post: "DD: Why RKLB is undervalued"
  (2000 words, sources, data)
  → This is high-quality research

├─ Top Comment: "Great analysis, but you missed..."
│    (500 words with counterpoints)
│    → Constructive debate
│
└─ Other Comment: "🚀🚀🚀"
     → Low-quality noise

→ Signal: High-quality DD with thoughtful discussion
```

**Pros**: Understands context, identifies DD
**Cons**: Slower, more complex

### Our Approach: Hybrid

**Phase 2A**: Individual analysis (fast, good enough)
- Quick sentiment per comment
- Aggregate to stock-level
- Detect volume spikes

**Phase 2B**: Thread-aware analysis (quality)
- Identify "DD" posts (long, well-sourced)
- Analyze debate structure
- Weight top-level posts more

**Phase 2C**: Full context with RAG (deep)
- Retrieve related threads
- Synthesize cross-thread narrative
- Generate research report

---

## Experimentation Framework

### A/B Testing Thresholds

```python
# Create multiple configs
configs = [
    {'name': 'conservative', 'volume_multiplier': 5.0, 'min_author_diversity': 0.7},
    {'name': 'balanced', 'volume_multiplier': 3.0, 'min_author_diversity': 0.6},
    {'name': 'aggressive', 'volume_multiplier': 2.0, 'min_author_diversity': 0.5},
]

# Run all in parallel
for config in configs:
    alerts = run_detector(config)
    track_performance(config, alerts)

# Compare results
# Which config caught the most real signals?
# Which had lowest false positive rate?
```

### Backtesting

```python
# Test against historical data
def backtest_config(config, date_range):
    alerts = []

    for date in date_range:
        # Run detector on past data
        day_alerts = run_detector_on_date(config, date)
        alerts.extend(day_alerts)

    # Evaluate
    for alert in alerts:
        # Did the stock price move in next 24-48h?
        price_change = get_price_change(alert.stock, hours=48)

        alert.was_correct = abs(price_change) > 5%  # >5% move = signal was real

    accuracy = len([a for a in alerts if a.was_correct]) / len(alerts)
    return accuracy

# Example
accuracy = backtest_config(
    config={'volume_multiplier': 3.0, ...},
    date_range=('2024-01-01', '2024-01-31')
)
print(f"Accuracy: {accuracy:.1%}")
```

### Feedback Loop

```python
# Track user feedback
POST /api/anomalies/alerts/{id}/feedback
Body: {
    "useful": true,  # or false
    "outcome": "stock_moved",  # or "false_alarm", "too_late", etc.
    "notes": "Good catch, bought at $5.20"
}

# Learn from feedback
def update_config_based_on_feedback():
    # Which alerts did users find useful?
    useful_alerts = get_alerts(feedback='useful')

    # What were their characteristics?
    avg_volume_multiplier = mean([a.volume_multiplier for a in useful_alerts])
    avg_author_diversity = mean([a.metrics['author_diversity'] for a in useful_alerts])

    # Adjust config toward those characteristics
    update_config({
        'volume_multiplier_threshold': avg_volume_multiplier * 0.9,
        'min_author_diversity': avg_author_diversity * 0.95
    })
```

---

## Performance Considerations

### Real-Time Requirements

**Goal**: Alert within 15 minutes of anomaly emerging.

**Pipeline Timing**:
- Scrape: Every 5-15 min (configurable)
- Metrics: Calculate in <30 seconds
- Detection: Run in <10 seconds
- Alert: Deliver immediately

**Total latency**: 5-15 minutes (acceptable)

### Scalability

**Current load** (100 stocks, 1000 posts/day):
- Metrics calculation: <1 second
- Anomaly detection: <5 seconds
- Cost: ~$5/month

**At scale** (1000 stocks, 10k posts/day):
- Metrics calculation: ~10 seconds
- Anomaly detection: ~30 seconds
- Cost: ~$20/month

**Bottlenecks**:
- Database queries (add indexes)
- Not compute (Python is fast enough)

---

## Success Criteria

### Phase 2A Goals

1. **Catch signals early**: Alert at least 6 hours before mainstream awareness
2. **Low false positives**: <20% false positive rate
3. **High coverage**: Detect at least 3 genuine early signals per week
4. **User trust**: >70% of alerts rated "useful" by users

### Measurement

```python
# Weekly report
alerts_generated = count_alerts(week=this_week)
user_feedback_positive = count_feedback(useful=True, week=this_week)
false_positives = count_feedback(useful=False, week=this_week)

accuracy = user_feedback_positive / (user_feedback_positive + false_positives)
print(f"Week {week_num}: {alerts_generated} alerts, {accuracy:.1%} accuracy")
```

---

## Next Steps

1. **Implement baseline tracking** (metrics aggregator worker)
2. **Build anomaly detector** with default thresholds
3. **Add pump filters** (basic version)
4. **Create API endpoints** for config management
5. **Build frontend dashboard** with threshold sliders
6. **Collect 2 weeks of data** to establish baselines
7. **Start detecting anomalies** and iterate based on feedback

See [ROADMAP.md](./ROADMAP.md) for full implementation timeline.
