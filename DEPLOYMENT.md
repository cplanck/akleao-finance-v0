# Akleao Finance - GCP Deployment Guide

This guide covers deploying the Akleao Finance application to Google Cloud Platform (GCP).

## Architecture Overview

The application consists of:
- **Frontend**: Next.js application (runs on port 3000)
- **Backend API**: FastAPI gateway (runs on port 8001)
- **Workers**: Python workers for scraping and processing
- **Database**: PostgreSQL
- **Cache**: Redis

## Recommended GCP Services

### Option 1: Cloud Run (Recommended for Getting Started)
**Best for**: Quick deployment, auto-scaling, pay-per-use
**Cost**: ~$20-50/month for light usage

- Frontend: Cloud Run (Next.js)
- Backend API: Cloud Run (FastAPI)
- Workers: Cloud Run Jobs
- Database: Cloud SQL (PostgreSQL)
- Cache: Memorystore (Redis)

### Option 2: Google Kubernetes Engine (GKE)
**Best for**: Full control, complex deployments
**Cost**: ~$100-200/month minimum

- All services run in Kubernetes
- Cloud SQL for database
- Memorystore for Redis

### Option 3: Compute Engine VMs
**Best for**: Simple setup, Docker Compose
**Cost**: ~$30-80/month

- Single VM running Docker Compose
- Managed database (Cloud SQL) or self-hosted PostgreSQL

## Quick Start: Cloud Run Deployment (Recommended)

This approach uses Cloud Run for containers and managed services for database/cache.

### Prerequisites

1. **Install Google Cloud CLI**
   ```bash
   # macOS
   brew install google-cloud-sdk

   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate and set up project**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable run.googleapis.com sqladmin.googleapis.com redis.googleapis.com artifactregistry.googleapis.com
   ```

3. **Create Artifact Registry for Docker images**
   ```bash
   gcloud artifacts repositories create akleao-repo \
     --repository-format=docker \
     --location=us-central1 \
     --description="Akleao Finance Docker images"
   ```

### Step 1: Set Up Database (Cloud SQL)

```bash
# Create PostgreSQL instance
gcloud sql instances create akleao-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create akleao --instance=akleao-db

# Create user
gcloud sql users create akleao \
  --instance=akleao-db \
  --password=YOUR_SECURE_USER_PASSWORD
```

**Connection String:**
```
postgresql://akleao:YOUR_SECURE_USER_PASSWORD@/akleao?host=/cloudsql/YOUR_PROJECT_ID:us-central1:akleao-db
```

### Step 2: Set Up Redis (Memorystore)

```bash
# Create Redis instance
gcloud redis instances create akleao-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

### Step 3: Build and Push Docker Images

#### Backend API

```bash
cd backend/api-gateway

# Build and tag
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/api-gateway:latest .

# Configure Docker to use gcloud credentials
gcloud auth configure-docker us-central1-docker.pkg.dev

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/api-gateway:latest
```

#### Frontend

First, create a Dockerfile for Next.js in the root directory:

```dockerfile
# Create this file: Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

Update `next.config.ts` to enable standalone output:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Add this line
};

export default nextConfig;
```

Build and push:

```bash
# From project root
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/frontend:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/frontend:latest
```

#### Workers

```bash
# Reddit Scraper
cd backend/workers/reddit-scraper
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/reddit-scraper:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/reddit-scraper:latest

# Comment Scraper
cd ../comment-scraper
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/comment-scraper:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/comment-scraper:latest

# Deep Research Worker
cd ../deep-research
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/deep-research:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/deep-research:latest
```

### Step 4: Deploy to Cloud Run

#### Deploy Backend API

```bash
gcloud run deploy akleao-api \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/api-gateway:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:akleao-db \
  --set-env-vars="DATABASE_URL=postgresql://akleao:YOUR_SECURE_USER_PASSWORD@/akleao?host=/cloudsql/YOUR_PROJECT_ID:us-central1:akleao-db" \
  --set-env-vars="REDIS_URL=redis://REDIS_IP:6379" \
  --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest,REDDIT_CLIENT_ID=REDDIT_CLIENT_ID:latest,REDDIT_CLIENT_SECRET=REDDIT_CLIENT_SECRET:latest,JWT_SECRET_KEY=JWT_SECRET_KEY:latest,ENCRYPTION_KEY=ENCRYPTION_KEY:latest" \
  --set-env-vars="CORS_ORIGINS=[\"https://YOUR_FRONTEND_URL\"]" \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=10
```

#### Deploy Frontend

```bash
# Get backend API URL
BACKEND_URL=$(gcloud run services describe akleao-api --region=us-central1 --format='value(status.url)')

gcloud run deploy akleao-frontend \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/frontend:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_API_URL=$BACKEND_URL" \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=10
```

#### Deploy Workers as Cloud Run Jobs

```bash
# Reddit Scraper (runs on schedule)
gcloud run jobs create reddit-scraper \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/reddit-scraper:latest \
  --region=us-central1 \
  --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:akleao-db \
  --set-env-vars="DATABASE_URL=postgresql://akleao:YOUR_SECURE_USER_PASSWORD@/akleao?host=/cloudsql/YOUR_PROJECT_ID:us-central1:akleao-db" \
  --set-env-vars="REDIS_URL=redis://REDIS_IP:6379" \
  --set-secrets="REDDIT_CLIENT_ID=REDDIT_CLIENT_ID:latest,REDDIT_CLIENT_SECRET=REDDIT_CLIENT_SECRET:latest" \
  --cpu=1 \
  --memory=512Mi \
  --max-retries=3 \
  --task-timeout=30m

# Schedule it to run every 15 minutes
gcloud scheduler jobs create http reddit-scraper-schedule \
  --location=us-central1 \
  --schedule="*/15 * * * *" \
  --uri="https://YOUR_REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/YOUR_PROJECT_ID/jobs/reddit-scraper:run" \
  --http-method=POST \
  --oauth-service-account-email=YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### Step 5: Set Up Secrets

Store sensitive credentials in Secret Manager:

```bash
# Create secrets
echo -n "YOUR_OPENAI_KEY" | gcloud secrets create OPENAI_API_KEY --data-file=-
echo -n "YOUR_REDDIT_CLIENT_ID" | gcloud secrets create REDDIT_CLIENT_ID --data-file=-
echo -n "YOUR_REDDIT_CLIENT_SECRET" | gcloud secrets create REDDIT_CLIENT_SECRET --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create JWT_SECRET_KEY --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create ENCRYPTION_KEY --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for all secrets
```

### Step 6: Run Database Migrations

```bash
# Option 1: Run migrations via Cloud Run job
gcloud run jobs create db-migrate \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/akleao-repo/api-gateway:latest \
  --region=us-central1 \
  --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:akleao-db \
  --set-env-vars="DATABASE_URL=postgresql://akleao:YOUR_SECURE_USER_PASSWORD@/akleao?host=/cloudsql/YOUR_PROJECT_ID:us-central1:akleao-db" \
  --command="alembic" \
  --args="upgrade,head"

# Execute migration
gcloud run jobs execute db-migrate --region=us-central1

# Option 2: Connect via Cloud SQL Proxy and run locally
cloud_sql_proxy -instances=YOUR_PROJECT_ID:us-central1:akleao-db=tcp:5432 &
cd backend/api-gateway
DATABASE_URL="postgresql://akleao:YOUR_SECURE_USER_PASSWORD@localhost:5432/akleao" alembic upgrade head
```

## Alternative: Compute Engine VM with Docker Compose

For a simpler, single-VM deployment:

```bash
# Create VM
gcloud compute instances create akleao-vm \
  --machine-type=e2-medium \
  --zone=us-central1-a \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --boot-disk-size=50GB \
  --tags=http-server,https-server

# SSH into VM
gcloud compute ssh akleao-vm --zone=us-central1-a

# Install Docker and Docker Compose (on the VM)
docker --version  # Already installed on Container-Optimized OS

# Clone your repo or copy files
git clone https://github.com/YOUR_USERNAME/akleao-finance-v0.git
cd akleao-finance-v0

# Create .env file with production values
cat > .env << EOF
OPENAI_API_KEY=your_key_here
REDDIT_CLIENT_ID=your_id_here
REDDIT_CLIENT_SECRET=your_secret_here
JWT_SECRET_KEY=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
EOF

# Start services
cd backend
docker-compose up -d

# Frontend (separate terminal or PM2)
cd ..
npm install
npm run build
npm start
```

## Cost Estimates

### Cloud Run (Recommended)
- Cloud Run Services (frontend + backend): $10-30/month
- Cloud SQL (db-f1-micro): $7-15/month
- Memorystore Redis (1GB): $30/month
- Cloud Run Jobs (workers): $5-10/month
- **Total: ~$50-85/month**

### Compute Engine
- e2-medium VM: $25/month
- Persistent disk (50GB): $8/month
- **Total: ~$33/month** (but requires more management)

### GKE
- GKE Cluster: $70+/month
- Node pools: $30+/month
- Cloud SQL: $15/month
- **Total: ~$115+/month**

## Environment Variables

### Production Environment Variables

Create a `.env.production` file:

```bash
# Database
DATABASE_URL=postgresql://akleao:PASSWORD@/akleao?host=/cloudsql/PROJECT:REGION:INSTANCE

# Redis
REDIS_URL=redis://REDIS_IP:6379

# API Keys
OPENAI_API_KEY=sk-...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...

# Security
JWT_SECRET_KEY=...
ENCRYPTION_KEY=...

# CORS
CORS_ORIGINS=["https://your-frontend-url.run.app"]

# Frontend
NEXT_PUBLIC_API_URL=https://your-backend-url.run.app
```

## Monitoring & Logging

```bash
# View logs
gcloud run services logs read akleao-api --region=us-central1 --limit=50

# Set up alerts
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05
```

## Custom Domain Setup

```bash
# Map custom domain
gcloud run services update akleao-frontend \
  --region=us-central1 \
  --add-domain-mapping=www.yourdomain.com

# Follow instructions to update DNS records
```

## CI/CD with Cloud Build

Create `cloudbuild.yaml`:

```yaml
steps:
  # Build frontend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/frontend:$SHORT_SHA', '.']

  # Push frontend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/frontend:$SHORT_SHA']

  # Deploy frontend
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'deploy'
      - 'akleao-frontend'
      - '--image=us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/frontend:$SHORT_SHA'
      - '--region=us-central1'
      - '--platform=managed'

  # Build backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/api-gateway:$SHORT_SHA', './backend/api-gateway']

  # Deploy backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/api-gateway:$SHORT_SHA']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'deploy'
      - 'akleao-api'
      - '--image=us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/api-gateway:$SHORT_SHA'
      - '--region=us-central1'
```

## Next Steps

1. Set up domain and SSL certificates
2. Configure Cloud CDN for frontend assets
3. Set up monitoring and alerting
4. Implement backup strategy for Cloud SQL
5. Set up staging environment
6. Configure autoscaling policies

## Troubleshooting

### Cannot connect to Cloud SQL
- Ensure Cloud SQL instance is running
- Check Cloud SQL connection name is correct
- Verify service account has Cloud SQL Client role

### Workers not processing
- Check Cloud Scheduler is enabled
- Verify service account permissions
- Check worker logs for errors

### Frontend can't reach backend
- Verify CORS settings in backend
- Check NEXT_PUBLIC_API_URL is set correctly
- Ensure backend service allows unauthenticated access (or implement auth)

## Support

For issues, check:
- Cloud Run logs: `gcloud run services logs read SERVICE_NAME`
- Cloud SQL logs: `gcloud sql operations list --instance=akleao-db`
- Billing: `gcloud billing accounts list`
