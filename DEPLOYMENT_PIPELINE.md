# Deployment Pipeline Guide

This guide covers the complete deployment workflow: from local development to production.

## Overview

```
Local Development (your machine)
    ↓ [export_local_data.sh]
Cloud Storage
    ↓ [import_to_production.sh]
Production Database
    ↓ [sync_from_production.sh]
Local Development (refreshed with prod data)
```

## Initial Production Setup

### 1. Export Your Current Local Data

This captures everything you've built so far:

```bash
cd backend/scripts
chmod +x export_local_data.sh
./export_local_data.sh
```

**What this does:**
- Exports your entire local database (schema + data)
- Creates SQL dump files
- Creates CSV files for inspection
- Shows statistics

**Output files:**
```
backend/scripts/db_exports/
├── local_data_YYYYMMDD_HHMMSS.sql       # Full dump
├── local_data_only_YYYYMMDD_HHMMSS.sql  # Data only
└── csv_YYYYMMDD_HHMMSS/                  # Human-readable CSVs
    ├── positions.csv
    ├── stocks.csv
    ├── reddit_posts.csv
    └── ...
```

### 2. Review the Export

**Important**: Check for any sensitive data before uploading to cloud:

```bash
cd backend/scripts/db_exports

# Look at CSV files
cat csv_*/positions.csv
cat csv_*/reddit_posts.csv

# Check for emails, passwords, real names, etc.
grep -r "@" csv_*/ || echo "No emails found"
```

### 3. Set Up Production Database on GCP

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1

# Create production Cloud SQL instance
gcloud sql instances create akleao-prod \
  --database-version=POSTGRES_15 \
  --tier=db-g1-small \
  --region=$GCP_REGION \
  --root-password=$(openssl rand -base64 32) \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=7 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4

# Create database and user
gcloud sql databases create akleao --instance=akleao-prod

# Generate secure password
PROD_DB_PASSWORD=$(openssl rand -base64 32)
echo "Save this password: $PROD_DB_PASSWORD"

gcloud sql users create akleao \
  --instance=akleao-prod \
  --password=$PROD_DB_PASSWORD

# Store password in Secret Manager
echo -n "$PROD_DB_PASSWORD" | gcloud secrets create DB_PASSWORD --data-file=-
```

### 4. Run Database Migrations on Production

Before importing data, set up the schema:

```bash
# Install Cloud SQL Proxy
brew install cloud-sql-proxy

# Start proxy
cloud_sql_proxy -instances=$GCP_PROJECT_ID:$GCP_REGION:akleao-prod=tcp:5434 &

# Get password from Secret Manager
PROD_DB_PASSWORD=$(gcloud secrets versions access latest --secret=DB_PASSWORD)

# Run migrations
cd backend/api-gateway
DATABASE_URL="postgresql://akleao:$PROD_DB_PASSWORD@localhost:5434/akleao" \
  alembic upgrade head

# Verify
DATABASE_URL="postgresql://akleao:$PROD_DB_PASSWORD@localhost:5434/akleao" \
  alembic current
```

### 5. Import Local Data to Production

```bash
cd backend/scripts
chmod +x import_to_production.sh

# Set environment variables
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1
export CLOUD_SQL_INSTANCE=akleao-prod
export DB_PASSWORD=$(gcloud secrets versions access latest --secret=DB_PASSWORD)

# Import (using the most recent export)
LATEST_EXPORT=$(ls -t db_exports/local_data_*.sql | head -1)
./import_to_production.sh $LATEST_EXPORT
```

**What this does:**
1. Creates Cloud Storage bucket (if needed)
2. Uploads your SQL dump to GCS
3. Imports to Cloud SQL
4. Verifies the import

### 6. Deploy Application to Cloud Run

Now deploy the backend that connects to this production database:

```bash
# Get database connection name
CONNECTION_NAME=$(gcloud sql instances describe akleao-prod --format='value(connectionName)')

# Deploy backend API
gcloud run deploy akleao-api \
  --image=us-central1-docker.pkg.dev/$GCP_PROJECT_ID/akleao-repo/api-gateway:latest \
  --region=$GCP_REGION \
  --add-cloudsql-instances=$CONNECTION_NAME \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest" \
  --allow-unauthenticated

# Get backend URL
BACKEND_URL=$(gcloud run services describe akleao-api --region=$GCP_REGION --format='value(status.url)')

# Deploy frontend
gcloud run deploy akleao-frontend \
  --image=us-central1-docker.pkg.dev/$GCP_PROJECT_ID/akleao-repo/frontend:latest \
  --region=$GCP_REGION \
  --set-env-vars="NEXT_PUBLIC_API_URL=$BACKEND_URL" \
  --allow-unauthenticated

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe akleao-frontend --region=$GCP_REGION --format='value(status.url)')

echo "🎉 Deployment complete!"
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $BACKEND_URL"
```

## Ongoing Development Workflow

### Syncing Production → Local

When you want to refresh your local database with production data:

```bash
cd backend/scripts
chmod +x sync_from_production.sh

export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1
export CLOUD_SQL_INSTANCE=akleao-prod

./sync_from_production.sh
```

**What this does:**
1. Exports production database to Cloud Storage
2. Downloads to your machine
3. **Anonymizes sensitive data** (removes PII)
4. Backs up your current local database
5. Replaces local with production data
6. Verifies the import

**Safety features:**
- Creates backup of local data before replacing
- Anonymizes user notes and other PII
- Asks for confirmation before proceeding

### Making Schema Changes

When you add new features that require database changes:

```bash
# 1. Local development
cd backend/shared/models
# Edit your model (e.g., add column to Position)

# 2. Generate migration
cd ../api-gateway
alembic revision --autogenerate -m "add_new_column"

# 3. Test locally
alembic upgrade head

# 4. Test the feature
# Make sure everything works!

# 5. Commit
git add .
git commit -m "Add new column to positions"
git push

# 6. Apply to production
cloud_sql_proxy -instances=$GCP_PROJECT_ID:$GCP_REGION:akleao-prod=tcp:5434 &

DATABASE_URL="postgresql://akleao:$PROD_DB_PASSWORD@localhost:5434/akleao" \
  alembic upgrade head

# 7. Deploy updated code
./deploy.sh  # Or your deployment command
```

## Database Management Commands

### Backup Production

```bash
# Manual backup
gcloud sql backups create \
  --instance=akleao-prod \
  --description="Manual backup before major change"

# List backups
gcloud sql backups list --instance=akleao-prod

# Restore from backup
gcloud sql backups restore BACKUP_ID \
  --backup-instance=akleao-prod \
  --backup-id=BACKUP_ID
```

### Connect to Production Database

```bash
# Start proxy
cloud_sql_proxy -instances=$GCP_PROJECT_ID:$GCP_REGION:akleao-prod=tcp:5434 &

# Connect with psql
PROD_DB_PASSWORD=$(gcloud secrets versions access latest --secret=DB_PASSWORD)
PGPASSWORD=$PROD_DB_PASSWORD psql \
  "postgresql://akleao@localhost:5434/akleao"

# Or use a GUI (TablePlus, Postico, etc.)
# Host: localhost
# Port: 5434
# User: akleao
# Password: (from Secret Manager)
# Database: akleao
```

### View Production Logs

```bash
# Application logs
gcloud run services logs read akleao-api --region=$GCP_REGION --limit=100

# Database logs
gcloud sql operations list --instance=akleao-prod --limit=20
```

## Environment Variables Reference

### Local Development (.env)
```bash
DATABASE_URL=postgresql://akleao:akleao_dev_password@localhost:5432/akleao
REDIS_URL=redis://localhost:6379
ENV=development
OPENAI_API_KEY=sk-...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```

### Production (Secret Manager + Cloud Run)
```bash
# Stored in Secret Manager
DATABASE_URL=postgresql://akleao:PASSWORD@/akleao?host=/cloudsql/PROJECT:REGION:akleao-prod
DB_PASSWORD=...
OPENAI_API_KEY=sk-...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
JWT_SECRET_KEY=...
ENCRYPTION_KEY=...

# Set as environment variables
ENV=production
REDIS_URL=redis://REDIS_IP:6379
```

## Troubleshooting

### "Permission denied" when importing

```bash
# Grant service account access to bucket
SERVICE_ACCOUNT=$(gcloud sql instances describe akleao-prod \
  --format="value(serviceAccountEmailAddress)")

gsutil iam ch "serviceAccount:$SERVICE_ACCOUNT:objectViewer" \
  gs://YOUR_BUCKET
```

### "Cloud SQL Proxy connection refused"

```bash
# Check instance is running
gcloud sql instances describe akleao-prod

# Restart proxy
pkill cloud_sql_proxy
cloud_sql_proxy -instances=$GCP_PROJECT_ID:$GCP_REGION:akleao-prod=tcp:5434 &
```

### "Disk full" on Cloud SQL

```bash
# Check disk usage
gcloud sql instances describe akleao-prod --format="value(settings.dataDiskSizeGb)"

# Increase disk size
gcloud sql instances patch akleao-prod --disk-size=20
```

## Cost Optimization

### Production Database Sizing

Start small, scale up as needed:

```bash
# Start with small instance (~$25/month)
--tier=db-g1-small

# Scale up if needed
gcloud sql instances patch akleao-prod --tier=db-custom-2-7680

# Scale down during low traffic
gcloud sql instances patch akleao-prod --tier=db-f1-micro  # Dev only!
```

### Backup Retention

```bash
# Reduce backup retention to save costs
gcloud sql instances patch akleao-prod --retained-backups-count=3

# Or use automated backups only
gcloud sql instances patch akleao-prod --no-enable-point-in-time-recovery
```

## Security Best Practices

1. **Never commit credentials**
   - Use Secret Manager for all passwords
   - Use `.gitignore` for `.env` files

2. **Use least privilege**
   - Create read-only users for analytics
   - Use separate users for workers

3. **Enable SSL**
   ```bash
   gcloud sql instances patch akleao-prod --require-ssl
   ```

4. **Restrict access**
   ```bash
   # Only allow Cloud Run to connect
   gcloud sql instances patch akleao-prod \
     --authorized-networks=0.0.0.0/0 \
     --no-assign-ip  # Use private IP only
   ```

5. **Monitor access**
   ```bash
   gcloud sql operations list --instance=akleao-prod --limit=50
   ```

## Next Steps

- [ ] Set up staging environment (between local and production)
- [ ] Automate deployments with Cloud Build
- [ ] Set up monitoring and alerting
- [ ] Configure automatic backups
- [ ] Set up database read replicas for scaling
- [ ] Implement blue-green deployments
