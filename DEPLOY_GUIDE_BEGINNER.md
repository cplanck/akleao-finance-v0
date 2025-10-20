# Complete GCP Deployment Guide (Beginner Friendly)

This guide assumes you've never used Google Cloud Platform before and walks you through every single step.

## Overview

We're deploying:
- **Frontend**: Vercel (free, automatic deployments)
- **Backend API**: Google Cloud Run (auto-scaling, pay per use)
- **Database**: Cloud SQL PostgreSQL (managed database)
- **Cache**: Memorystore Redis (managed cache)
- **Workers**: Cloud Run Jobs (scheduled tasks)

**Estimated monthly cost**: $50-80 with light usage

---

## Part 1: Google Cloud Setup (15 minutes)

### Step 1: Create Google Cloud Account

1. Go to https://console.cloud.google.com
2. Sign in with your Google account
3. You'll get $300 free credits for 90 days (no credit card required initially)

### Step 2: Create a New Project

1. In the Cloud Console, click the project dropdown (top bar)
2. Click "New Project"
3. Name it: `akleao-finance`
4. Click "Create"
5. Wait for project creation (30 seconds)
6. Select your new project from the dropdown

### Step 3: Enable Billing

1. Click the hamburger menu (☰) → "Billing"
2. Click "Link a billing account"
3. Add your credit card (you won't be charged with free credits)
4. Link it to your `akleao-finance` project

### Step 4: Install Google Cloud CLI

**macOS:**
```bash
brew install google-cloud-sdk
```

**Windows:**
Download from: https://cloud.google.com/sdk/docs/install

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Step 5: Authenticate

```bash
# Login to your Google account
gcloud auth login

# Set your project
gcloud config set project akleao-finance

# Verify it's set
gcloud config get-value project
# Should output: akleao-finance
```

### Step 6: Enable Required APIs

This enables all the services we'll use:

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com
```

This takes ~2 minutes. You'll see progress messages.

---

## Part 2: Set Up Database (20 minutes)

### Step 1: Create Cloud SQL Instance

```bash
# This creates your PostgreSQL database server
gcloud sql instances create akleao-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-size=10GB \
  --storage-type=SSD \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=7

# This takes 5-10 minutes. You'll see: "Creating Cloud SQL instance...done."
```

**What this does:**
- Creates a PostgreSQL 15 database server
- db-f1-micro = smallest/cheapest tier (~$7/month)
- 10GB storage
- Daily backups at 3 AM
- Keeps 7 days of backups

### Step 2: Set Root Password

```bash
# Generate a secure password
DB_ROOT_PASSWORD=$(openssl rand -base64 32)
echo "Save this somewhere safe: $DB_ROOT_PASSWORD"

# Set the root password
gcloud sql users set-password postgres \
  --instance=akleao-db \
  --password="$DB_ROOT_PASSWORD"
```

**IMPORTANT**: Copy and save that password somewhere safe (password manager, notes, etc.)

### Step 3: Create Database and User

```bash
# Create the database
gcloud sql databases create akleao --instance=akleao-db

# Generate password for app user
DB_USER_PASSWORD=$(openssl rand -base64 32)
echo "App password (save this too): $DB_USER_PASSWORD"

# Create app user
gcloud sql users create akleao \
  --instance=akleao-db \
  --password="$DB_USER_PASSWORD"
```

### Step 4: Store Password in Secret Manager

```bash
# Create secret for database password
echo -n "$DB_USER_PASSWORD" | gcloud secrets create DATABASE_PASSWORD --data-file=-

# Verify it was stored
gcloud secrets versions access latest --secret=DATABASE_PASSWORD
# Should output your password
```

### Step 5: Install Cloud SQL Proxy

This lets you connect to Cloud SQL from your computer:

```bash
# macOS
brew install cloud-sql-proxy

# Windows/Linux
# Download from: https://cloud.google.com/sql/docs/postgres/sql-proxy
```

### Step 6: Connect and Run Migrations

```bash
# Get your project ID
PROJECT_ID=$(gcloud config get-value project)

# Start Cloud SQL Proxy in background
cloud_sql_proxy --port=5434 "$PROJECT_ID:us-central1:akleao-db" &

# Save the process ID to kill it later
PROXY_PID=$!
echo "Proxy running as PID: $PROXY_PID"

# Wait a few seconds for proxy to start
sleep 5

# Test connection
PGPASSWORD="$DB_USER_PASSWORD" psql \
  -h localhost -p 5434 \
  -U akleao -d akleao \
  -c "SELECT version();"

# Should show PostgreSQL version

# Run database migrations
cd backend/api-gateway
DATABASE_URL="postgresql://akleao:$DB_USER_PASSWORD@localhost:5434/akleao" \
  alembic upgrade head

# Verify migrations ran
DATABASE_URL="postgresql://akleao:$DB_USER_PASSWORD@localhost:5434/akleao" \
  alembic current

# Stop the proxy (we'll start it again later when needed)
kill $PROXY_PID
```

---

## Part 3: Set Up Secrets (5 minutes)

Store all your API keys and secrets:

```bash
# OpenAI API Key
echo -n "YOUR_OPENAI_API_KEY" | gcloud secrets create OPENAI_API_KEY --data-file=-

# Reddit API
echo -n "YOUR_REDDIT_CLIENT_ID" | gcloud secrets create REDDIT_CLIENT_ID --data-file=-
echo -n "YOUR_REDDIT_CLIENT_SECRET" | gcloud secrets create REDDIT_CLIENT_SECRET --data-file=-

# Generate secure JWT and encryption keys
echo -n "$(openssl rand -base64 32)" | gcloud secrets create JWT_SECRET_KEY --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create ENCRYPTION_KEY --data-file=-

# Create DATABASE_URL secret (for Cloud Run to connect)
CONNECTION_NAME="$PROJECT_ID:us-central1:akleao-db"
DATABASE_URL="postgresql://akleao:$DB_USER_PASSWORD@/akleao?host=/cloudsql/$CONNECTION_NAME"
echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=-

# List all secrets to verify
gcloud secrets list
```

---

## Part 4: Build and Deploy Backend (20 minutes)

### Step 1: Create Artifact Registry

This is where we'll store Docker images:

```bash
gcloud artifacts repositories create akleao-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Akleao Finance Docker images"

# Configure Docker to use this registry
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Step 2: Build Backend Docker Image

```bash
cd backend/api-gateway

# Build the image
docker build -t us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/api-gateway:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/api-gateway:latest
```

This takes ~5 minutes (depends on your internet speed).

### Step 3: Deploy to Cloud Run

```bash
# Get the Cloud SQL connection name
CONNECTION_NAME=$(gcloud sql instances describe akleao-db --format='value(connectionName)')

# Deploy!
gcloud run deploy akleao-api \
  --image=us-central1-docker.pkg.dev/$PROJECT_ID/akleao-repo/api-gateway:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances=$CONNECTION_NAME \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,REDDIT_CLIENT_ID=REDDIT_CLIENT_ID:latest,REDDIT_CLIENT_SECRET=REDDIT_CLIENT_SECRET:latest,JWT_SECRET_KEY=JWT_SECRET_KEY:latest,ENCRYPTION_KEY=ENCRYPTION_KEY:latest" \
  --set-env-vars="ENV=production,REDDIT_USER_AGENT=AkleaoFinance/1.0" \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=60

# Get the URL
BACKEND_URL=$(gcloud run services describe akleao-api --region=us-central1 --format='value(status.url)')
echo "🎉 Backend deployed at: $BACKEND_URL"

# Test it
curl "$BACKEND_URL/health"
# Should return: {"status":"healthy"}
```

### Step 4: Update CORS

```bash
# Update CORS to allow Vercel
gcloud run services update akleao-api \
  --region=us-central1 \
  --set-env-vars="CORS_ORIGINS=[\"https://your-app.vercel.app\",\"http://localhost:3000\"]"

# We'll update the Vercel URL after deploying frontend
```

---

## Part 5: Deploy Frontend to Vercel (5 minutes)

### Step 1: Push to GitHub

```bash
# If not already a git repo
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub
# Go to https://github.com/new
# Name: akleao-finance-v0
# Don't initialize with README

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/akleao-finance-v0.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Import Project"
4. Select your `akleao-finance-v0` repository
5. Vercel auto-detects Next.js settings
6. Add environment variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: (your backend URL from above, e.g., `https://akleao-api-xxx.run.app`)
7. Click "Deploy"
8. Wait 2-3 minutes
9. Get your URL: `https://akleao-finance-v0.vercel.app`

### Step 3: Update Backend CORS

```bash
# Replace with your actual Vercel URL
FRONTEND_URL="https://akleao-finance-v0.vercel.app"

gcloud run services update akleao-api \
  --region=us-central1 \
  --set-env-vars="CORS_ORIGINS=[\"$FRONTEND_URL\",\"http://localhost:3000\"]"
```

---

## Part 6: Import Your Local Data (Optional)

If you want to seed production with your local development data:

```bash
cd backend/scripts

# Make scripts executable
chmod +x export_local_data.sh import_to_production.sh

# Export local data
./export_local_data.sh

# Set environment variables
export GCP_PROJECT_ID=$(gcloud config get-value project)
export CLOUD_SQL_INSTANCE=akleao-db
export DB_PASSWORD=$(gcloud secrets versions access latest --secret=DATABASE_PASSWORD)

# Import to production
LATEST_EXPORT=$(ls -t db_exports/local_data_*.sql | head -1)
./import_to_production.sh $LATEST_EXPORT
```

---

## Part 7: Verify Everything Works

### Test Backend

```bash
# Health check
curl https://akleao-api-XXX.run.app/health

# Test API endpoint (replace URL)
curl https://akleao-api-XXX.run.app/api/positions/
```

### Test Frontend

1. Open your Vercel URL in browser
2. Try creating a position
3. Check if data appears

### Check Logs

```bash
# Backend logs
gcloud run services logs read akleao-api --region=us-central1 --limit=50

# Database logs
gcloud sql operations list --instance=akleao-db --limit=10
```

---

## Costs Breakdown

Here's what you'll pay monthly:

| Service | Tier | Cost |
|---------|------|------|
| Cloud Run (Backend) | Pay per use | $5-15 |
| Cloud SQL (Database) | db-f1-micro | $7 |
| Artifact Registry | Storage | $0-2 |
| Secret Manager | Per access | $0-1 |
| Vercel (Frontend) | Hobby (free) | $0 |
| **Total** | | **~$12-25/month** |

With free trial: $0 for first 90 days!

---

## Common Issues

### "Permission denied" when pushing to Artifact Registry

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
gcloud auth login
```

### "Cloud Run service not found"

Make sure you're in the right region:
```bash
gcloud config set run/region us-central1
```

### "Cannot connect to Cloud SQL"

```bash
# Verify instance is running
gcloud sql instances describe akleao-db

# Restart proxy
pkill cloud_sql_proxy
cloud_sql_proxy --port=5434 "$PROJECT_ID:us-central1:akleao-db" &
```

### Frontend can't reach backend

1. Check CORS settings
2. Verify `NEXT_PUBLIC_API_URL` in Vercel
3. Check backend is deployed: `curl YOUR_BACKEND_URL/health`

---

## Next Steps

After basic deployment works:

1. **Set up custom domain** (optional)
   - Frontend: Add domain in Vercel settings
   - Backend: `gcloud run domain-mappings create`

2. **Set up monitoring**
   ```bash
   # Enable Cloud Monitoring
   gcloud services enable monitoring.googleapis.com
   ```

3. **Deploy workers** (for Reddit scraping, etc.)
   - See DEPLOYMENT.md for worker deployment

4. **Set up CI/CD**
   - Vercel: Auto-deploys on git push (already done!)
   - Backend: Set up Cloud Build triggers

5. **Enable Redis cache**
   ```bash
   gcloud redis instances create akleao-redis \
     --size=1 \
     --region=us-central1
   ```

---

## Quick Reference

### Useful Commands

```bash
# View backend logs
gcloud run services logs read akleao-api --region=us-central1

# Restart backend
gcloud run services update akleao-api --region=us-central1

# Connect to database
cloud_sql_proxy --port=5434 "PROJECT:us-central1:akleao-db" &
psql -h localhost -p 5434 -U akleao -d akleao

# View costs
gcloud billing accounts list
```

### Important URLs

- GCP Console: https://console.cloud.google.com
- Vercel Dashboard: https://vercel.com/dashboard
- Backend Logs: https://console.cloud.google.com/run?project=akleao-finance
- Database: https://console.cloud.google.com/sql?project=akleao-finance

---

## Help & Support

If you get stuck:

1. Check logs: `gcloud run services logs read akleao-api`
2. Check GCP status: https://status.cloud.google.com
3. Vercel status: https://www.vercel-status.com

**Need help?** Share the error message and I'll help you fix it!
