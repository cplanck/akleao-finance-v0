# Cost Breakdown: GCP vs AWS

## Executive Summary

**Recommendation: Google Cloud Platform (GCP)**

For Akleao Finance's use case (event-driven workers, bursty Reddit scraping, anomaly detection), GCP is **30-40% cheaper** than AWS while providing better developer experience for our architecture.

| Phase | GCP Monthly Cost | AWS Monthly Cost | Savings |
|-------|-----------------|------------------|---------|
| **Phase 0-1** (MVP) | ~$45 | ~$75 | $30/mo (40%) |
| **Phase 2** (Full System) | ~$80 | ~$135 | $55/mo (41%) |
| **Phase 3** (1000 users) | ~$150 | ~$225 | $75/mo (33%) |

---

## Detailed Cost Comparison

### Phase 0-1: MVP (Core Infrastructure)

#### GCP Costs

| Service | Tier | Usage | Cost/Month |
|---------|------|-------|------------|
| **Cloud SQL (PostgreSQL)** | db-f1-micro (0.6GB RAM, shared CPU) | Always-on database | $10 |
| **Cloud Run (API Gateway)** | 1 vCPU, 512MB RAM | ~10k requests/day, mostly idle | $2 |
| **Cloud Run Jobs (Reddit Scraper)** | 1 vCPU, 512MB RAM | Runs 15 min every 15 min = 24 hrs/day compute | $15 |
| **Cloud Run Jobs (Metrics Aggregator)** | 1 vCPU, 512MB RAM | Runs 5 min every 15 min = 8 hrs/day compute | $5 |
| **Cloud Run Jobs (Anomaly Detector)** | 1 vCPU, 512MB RAM | Runs 10 min every 15 min = 16 hrs/day compute | $8 |
| **Cloud Storage** | Standard | 10GB for backups | $0.20 |
| **Pub/Sub** | Standard | 100k messages/day | Free tier |
| **Cloud Logging** | Standard | 50GB/month | Free tier |
| **Networking** | Egress | ~100GB/month | $5 |

**Total GCP (Phase 1): ~$45/month**

#### AWS Costs (Equivalent)

| Service | Tier | Usage | Cost/Month |
|---------|------|-------|------------|
| **RDS PostgreSQL** | db.t3.micro (1GB RAM, 2 vCPU) | Always-on database | $18 |
| **ECS Fargate (API Gateway)** | 0.5 vCPU, 1GB RAM | Always-on (can't scale to zero) | $15 |
| **ECS Fargate (Reddit Scraper)** | 0.5 vCPU, 1GB RAM | Always-on (can't scale to zero) | $15 |
| **Lambda (Metrics Aggregator)** | 1GB RAM, 8hrs/day | Alternative to Fargate | $5 |
| **Lambda (Anomaly Detector)** | 1GB RAM, 16hrs/day | Alternative to Fargate | $10 |
| **S3** | Standard | 10GB for backups | $0.23 |
| **SQS/SNS** | Standard | 100k messages/day | $0.50 |
| **CloudWatch Logs** | Standard | 50GB/month | $2.50 |
| **Networking** | Data transfer | ~100GB/month | $9 |

**Total AWS (Phase 1): ~$75/month**

#### Why GCP is Cheaper (Phase 1)

1. **Cloud Run scales to zero** - Only pay when processing
   - AWS Fargate must run 24/7 (can't scale to zero)
   - For bursty workloads (Reddit scraper runs every 15 min), Cloud Run saves ~60%

2. **Cloud SQL is cheaper** - db-f1-micro ($10) vs RDS t3.micro ($18)

3. **Networking is cheaper** - GCP charges $0.05/GB, AWS charges $0.09/GB

4. **Pub/Sub generous free tier** - 10GB/month free (SQS/SNS charges immediately)

---

### Phase 2: Full Anomaly Detection System

Adds sentiment analysis, RAG-based deep research, vector database.

#### GCP Costs (Phase 2)

| Service | Tier | Usage | Cost/Month |
|---------|------|-------|------------|
| **Cloud SQL (PostgreSQL)** | db-g1-small (1.7GB RAM, 1 vCPU) | Upgraded for more connections | $30 |
| **Cloud Run (API Gateway)** | 2 vCPU, 1GB RAM | ~100k requests/day | $5 |
| **Cloud Run Jobs (All Workers)** | Combined | Reddit, metrics, anomaly, sentiment | $30 |
| **Pgvector (PostgreSQL extension)** | - | Embedded in Cloud SQL | $0 |
| **BigQuery** | On-demand | 100GB stored, 1TB queries/month | $5 |
| **Cloud Storage** | Standard | 50GB for backups + vector embeddings | $1 |
| **Anthropic API (Claude)** | - | ~500 deep research queries/month @ $0.02/query | $10 |
| **OpenAI API (GPT-4o-mini)** | - | ~10k sentiment analyses/month @ $0.0001/analysis | $1 |
| **Networking** | Egress | ~200GB/month | $10 |

**Total GCP (Phase 2): ~$82/month**

#### AWS Costs (Phase 2)

| Service | Tier | Usage | Cost/Month |
|---------|------|-------|------------|
| **RDS PostgreSQL** | db.t3.small (2GB RAM, 2 vCPU) | Upgraded | $40 |
| **ECS Fargate (All Services)** | Combined | API + 4 workers always-on | $60 |
| **Pinecone (Vector DB)** | Starter | 100k vectors | $70 |
| **S3** | Standard | 50GB | $1.15 |
| **Athena (Data Warehouse)** | On-demand | 1TB queries/month | $5 |
| **Anthropic API (Claude)** | - | ~500 queries/month | $10 |
| **OpenAI API (GPT-4o-mini)** | - | ~10k analyses/month | $1 |
| **CloudWatch** | Standard | 100GB logs | $5 |
| **Networking** | Data transfer | ~200GB/month | $18 |

**Total AWS (Phase 2): ~$135/month**

**Why GCP Saves $53/month**:
1. **Pgvector is free** (PostgreSQL extension) - Pinecone costs $70/month
2. **Cloud Run still scales to zero** - Fargate runs 24/7
3. **BigQuery cheaper than Athena + S3** for historical analysis
4. **Lower networking costs**

---

### Phase 3: Production with 1000 Users

#### GCP Costs (Phase 3)

| Service | Tier | Usage | Cost/Month |
|---------|------|-------|------------|
| **Cloud SQL** | db-n1-standard-1 (3.75GB RAM, 1 vCPU) | Handle 1000 concurrent users | $60 |
| **Cloud Run (API Gateway)** | Auto-scale 0-10 instances | 1M requests/month | $15 |
| **Cloud Run Jobs (All Workers)** | Combined | Same workload | $30 |
| **BigQuery** | On-demand | 1TB stored, 10TB queries/month | $25 |
| **Cloud CDN** | Standard | Cache API responses | $5 |
| **Cloud Storage** | Standard | 200GB | $4 |
| **AI APIs (Anthropic + OpenAI)** | - | 5k deep research + 100k sentiment | $100 (scales with usage) |
| **Networking** | Egress with CDN | ~500GB/month | $10 |

**Total GCP (Phase 3): ~$249/month**

**But with optimization**: ~$150/month
- Use Cloud CDN aggressively (reduces API calls by 60%)
- Cache sentiment results in Redis
- Batch AI API calls

#### AWS Costs (Phase 3)

| Service | Tier | Usage | Cost/Month |
|---------|------|-------|------------|
| **RDS PostgreSQL** | db.t3.medium (4GB RAM, 2 vCPU) | 1000 users | $80 |
| **ECS Fargate** | Auto-scale 3-10 tasks | 1M requests/month | $50 |
| **Pinecone** | Standard | 1M vectors | $70 |
| **S3** | Standard | 200GB | $4.60 |
| **Athena** | On-demand | 10TB queries/month | $50 |
| **CloudFront (CDN)** | Standard | 500GB | $10 |
| **AI APIs** | - | Same usage | $100 |
| **ElastiCache Redis** | cache.t3.micro | Caching layer | $15 |
| **Networking** | Data transfer | ~500GB with CloudFront | $20 |

**Total AWS (Phase 3): ~$399/month**

**With optimization**: ~$225/month

**GCP still saves ~$75/month at scale**

---

## Why GCP Wins for This Use Case

### 1. Cloud Run > ECS Fargate

**Cloud Run advantages**:
- **Scales to zero**: Pay only when processing
- **Faster cold starts**: 100-300ms vs 2-5s for Fargate
- **Simpler deployment**: One command (`gcloud run deploy`)
- **Better for bursty workloads**: Reddit scraper runs every 15 min

**Fargate disadvantages**:
- **Always-on billing**: Can't scale to zero (minimum 1 task)
- **Complex setup**: VPC, security groups, load balancers, ECS clusters
- **Slower iteration**: Longer deployment times

**Cost example (Reddit Scraper)**:
- Runs 15 minutes out of every hour (25% utilization)
- **GCP Cloud Run**: $15/month (pay for 25% usage)
- **AWS Fargate**: $30/month (pay for 100% because always-on)

### 2. Pgvector > Pinecone

**Pgvector** (PostgreSQL extension):
- **Free**: Just part of your PostgreSQL database
- **Simpler architecture**: No separate service to manage
- **Good enough for <1M vectors**: Our use case
- **SQL-native**: Use familiar SQL queries

**Pinecone**:
- **$70/month minimum** for starter plan
- **Separate service**: More complexity
- **Better at scale**: Only worth it for 10M+ vectors

**When to switch to Pinecone**: If you exceed 1M vector embeddings (Phase 4+)

### 3. BigQuery > Athena + S3

**BigQuery**:
- **Built-in**: Part of GCP, easy to set up
- **Serverless**: No cluster management
- **Better for time-series**: Perfect for Reddit data over time
- **Simpler pricing**: $5/TB queried

**Athena + S3**:
- **More setup**: Partition S3 buckets, manage schemas
- **Similar pricing**: $5/TB queried + S3 storage
- **Better for data lake**: If you have massive diverse data sources

**Our use case**: BigQuery is simpler and sufficient

### 4. Pub/Sub > SQS/SNS

**Pub/Sub**:
- **10GB/month free tier**
- **Simpler**: One service (vs SQS for queues + SNS for topics)
- **Better Cloud Run integration**: Native support

**SQS/SNS**:
- **No free tier** (charges from first message)
- **Two services**: Need both for pub/sub pattern
- **Good AWS integrations**: But we're not using other AWS services

### 5. Cloud SQL > RDS

**Cloud SQL**:
- **Cheaper small tiers**: db-f1-micro ($10) vs db.t3.micro ($18)
- **Automatic backups**: Included, point-in-time recovery
- **Less configuration**: Easier to set up

**RDS**:
- **More expensive tiers**: Similar performance costs ~20% more
- **More options**: Aurora, etc. (we don't need complexity)

---

## When AWS Might Be Better

### Use AWS if:

1. **Already using AWS Bedrock for AI**
   - We're not - we're using Anthropic/OpenAI APIs directly
   - If you were using Bedrock, staying in AWS makes sense

2. **Team has deep AWS expertise**
   - We're open to learning GCP
   - GCP is simpler for our use case

3. **Need AWS-specific services**
   - SageMaker for ML training (we're not doing custom ML)
   - DynamoDB for global distribution (we're US-only)

4. **Multi-cloud strategy**
   - We're focused on one platform for simplicity

5. **Already invested in AWS credits**
   - If you have $10k in AWS credits, use them!

### Use GCP if:

1. **Event-driven architecture** ✅ (our case)
2. **Bursty workloads** ✅ (Reddit scraper every 15 min)
3. **Startup wanting to minimize costs** ✅
4. **Need simple deployment** ✅ (Cloud Run)
5. **Time-series analytics** ✅ (BigQuery for Reddit trends)

---

## Cost Optimization Tips

### GCP Optimizations

1. **Use Cloud CDN aggressively**
   - Cache API responses for 5 minutes
   - Reduces Cloud Run invocations by 60%
   - Saves ~$20/month at 1M requests

2. **Batch AI API calls**
   - Don't analyze every comment individually
   - Batch 10 comments into one API call
   - Reduces AI costs by 90%

3. **Use Committed Use Discounts**
   - If Cloud SQL runs 24/7, commit to 1 year
   - Save 37% (~$20/month on db-n1-standard-1)

4. **Scale to zero aggressively**
   - Set Cloud Run min instances = 0
   - Workers only run when needed
   - Don't keep warm instances

5. **Use BigQuery efficiently**
   - Partition tables by date
   - Only query recent data
   - Use clustering for common filters

### AWS Optimizations

1. **Use Reserved Instances**
   - Commit to 1 year for RDS
   - Save 40% (~$30/month on db.t3.medium)

2. **Use Lambda instead of Fargate where possible**
   - For short-lived tasks (<15 min)
   - Much cheaper for bursty workloads

3. **Use S3 Intelligent-Tiering**
   - Automatically moves old data to cheaper storage
   - Saves ~50% on storage costs

4. **CloudFront caching**
   - Same strategy as GCP Cloud CDN
   - Reduces origin requests

---

## Cost Projections by Phase

| Metric | Phase 1 (MVP) | Phase 2 (Full) | Phase 3 (1k users) | Phase 4 (10k users) |
|--------|---------------|----------------|--------------------|--------------------|
| **Users** | 1-10 | 10-100 | 100-1,000 | 1,000-10,000 |
| **API Requests/Day** | 10k | 100k | 1M | 10M |
| **Reddit Posts/Day** | 1,000 | 5,000 | 5,000 | 10,000 |
| **AI API Calls/Month** | 0 | 10k | 100k | 1M |
| **GCP Cost** | $45 | $80 | $150 | $400 |
| **AWS Cost** | $75 | $135 | $225 | $650 |
| **Savings (GCP)** | $30 | $55 | $75 | $250 |

---

## Break-Even Analysis

### When does scale justify AWS?

**AWS becomes competitive at**:
- 100k+ users
- 100M+ API requests/month
- Need for AWS-specific services (SageMaker, Bedrock)

**Why**: At massive scale, AWS Reserved Instances and volume discounts kick in.

**But for 0-10k users**: GCP is clearly better.

---

## Free Tier Comparison

### GCP Free Tier (Always Free)

- **Cloud Run**: 2M requests/month
- **Cloud Functions**: 2M invocations/month
- **Pub/Sub**: 10GB messages/month
- **Cloud Storage**: 5GB/month
- **BigQuery**: 10GB storage + 1TB queries/month
- **Cloud Logging**: 50GB/month

**Our usage in Phase 1**: Mostly covered by free tier! (~$20/month just for Cloud SQL)

### AWS Free Tier (12 months only)

- **Lambda**: 1M requests/month (12 months)
- **RDS**: 750 hours/month db.t2.micro (12 months)
- **S3**: 5GB storage (12 months)
- **CloudFront**: 1TB transfer (12 months)

**After 12 months**: Costs jump to ~$75/month

**GCP advantage**: Free tier is permanent

---

## Conclusion

**For Akleao Finance, GCP is the clear winner**:

1. **30-40% cheaper** at all scale levels (0-10k users)
2. **Better developer experience** (Cloud Run, BigQuery, Pub/Sub)
3. **Permanent free tier** (vs AWS 12 months)
4. **Perfect fit for event-driven architecture**
5. **Simpler deployment** (fewer services to manage)

**Total savings over 2 years**: ~$1,800

**Recommendation**: Start with GCP. Reevaluate only if you reach 100k+ users or need AWS-specific services.

---

## Monthly Budget Recommendations

### Phase 1 (MVP - Months 1-2)
**Budget**: $50/month
- Actual GCP cost: $45/month
- $5 buffer for experimentation

### Phase 2 (Full System - Months 3-6)
**Budget**: $100/month
- Actual GCP cost: $80/month
- $20 for AI API experimentation

### Phase 3 (Growing User Base - Months 7-12)
**Budget**: $200/month
- Actual GCP cost: $150/month
- $50 for AI APIs as usage grows

### Alert Thresholds

Set up billing alerts in GCP:
- **Warning**: $40/month (Phase 1), $75/month (Phase 2), $140/month (Phase 3)
- **Critical**: $60/month (Phase 1), $100/month (Phase 2), $200/month (Phase 3)

---

## References

- [GCP Pricing Calculator](https://cloud.google.com/products/calculator)
- [AWS Pricing Calculator](https://calculator.aws/)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- [BigQuery Pricing](https://cloud.google.com/bigquery/pricing)
