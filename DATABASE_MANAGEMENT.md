# Database Management - Development vs Production

## Overview

This guide explains how to manage databases across different environments (local, staging, production).

## Environments

### 1. Local Development (Current Setup)
- **Database**: PostgreSQL running in Docker (`akleao-postgres`)
- **Connection**: `postgresql://akleao:akleao_dev_password@localhost:5432/akleao`
- **Purpose**: Day-to-day development, testing features
- **Data**: Can be wiped/reset anytime

### 2. Staging (Cloud - Recommended)
- **Database**: Cloud SQL on GCP
- **Connection**: Via Cloud SQL Proxy
- **Purpose**: Testing in production-like environment before deploying
- **Data**: Should mirror production structure but with test data

### 3. Production (Cloud)
- **Database**: Cloud SQL on GCP
- **Connection**: Via Cloud SQL Proxy or Unix socket
- **Purpose**: Real user data
- **Data**: NEVER delete, regular backups required

## Environment Configuration

### Using Environment Variables

The key is to use different environment variables for each environment:

```bash
# .env.local (for local development - already have this)
DATABASE_URL=postgresql://akleao:akleao_dev_password@localhost:5432/akleao
REDIS_URL=redis://localhost:6379
ENV=development

# .env.staging (for staging environment)
DATABASE_URL=postgresql://akleao:STAGING_PASSWORD@/akleao?host=/cloudsql/PROJECT_ID:us-central1:akleao-staging
REDIS_URL=redis://STAGING_REDIS_IP:6379
ENV=staging

# .env.production (for production - NEVER commit this file!)
DATABASE_URL=postgresql://akleao:PROD_PASSWORD@/akleao?host=/cloudsql/PROJECT_ID:us-central1:akleao-prod
REDIS_URL=redis://PROD_REDIS_IP:6379
ENV=production
```

### Current Setup Files

You already have these files. Let's update them:

**backend/.env** (current local development)
```bash
DATABASE_URL=postgresql://akleao:akleao_dev_password@localhost:5432/akleao
REDIS_URL=redis://localhost:6379
ENV=development
```

## Migration Strategy

### How Alembic Migrations Work

1. **Local Development**:
   ```bash
   # Make schema changes to models
   # Generate migration
   cd backend/api-gateway
   alembic revision --autogenerate -m "Add new table"

   # Apply to local DB
   alembic upgrade head
   ```

2. **Commit Migration Files**:
   ```bash
   git add backend/api-gateway/alembic/versions/*.py
   git commit -m "Add migration: new table"
   ```

3. **Apply to Staging**:
   ```bash
   # Connect to staging DB
   cloud_sql_proxy -instances=PROJECT:us-central1:akleao-staging=tcp:5433 &

   # Run migrations against staging
   DATABASE_URL=postgresql://akleao:STAGING_PASSWORD@localhost:5433/akleao \
     alembic upgrade head
   ```

4. **Apply to Production** (after testing in staging):
   ```bash
   # Connect to production DB
   cloud_sql_proxy -instances=PROJECT:us-central1:akleao-prod=tcp:5434 &

   # Run migrations against production
   DATABASE_URL=postgresql://akleao:PROD_PASSWORD@localhost:5434/akleao \
     alembic upgrade head
   ```

## Setting Up Multiple Environments

### Step 1: Create Staging Database on GCP

```bash
# Create staging instance
gcloud sql instances create akleao-staging \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=STAGING_ROOT_PASSWORD

# Create database
gcloud sql databases create akleao --instance=akleao-staging

# Create user
gcloud sql users create akleao \
  --instance=akleao-staging \
  --password=STAGING_USER_PASSWORD
```

### Step 2: Create Production Database on GCP

```bash
# Create production instance (with backups!)
gcloud sql instances create akleao-prod \
  --database-version=POSTGRES_15 \
  --tier=db-g1-small \
  --region=us-central1 \
  --root-password=PROD_ROOT_PASSWORD \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=7

# Create database
gcloud sql databases create akleao --instance=akleao-prod

# Create user
gcloud sql users create akleao \
  --instance=akleao-prod \
  --password=PROD_USER_PASSWORD
```

### Step 3: Install Cloud SQL Proxy

```bash
# macOS
brew install cloud-sql-proxy

# Or download directly
# https://cloud.google.com/sql/docs/postgres/sql-proxy
```

### Step 4: Connect to Remote Databases

```bash
# Terminal 1: Connect to staging
cloud_sql_proxy \
  --instances=YOUR_PROJECT:us-central1:akleao-staging=tcp:5433

# Terminal 2: Connect to production
cloud_sql_proxy \
  --instances=YOUR_PROJECT:us-central1:akleao-prod=tcp:5434

# Now you can connect:
# Staging: postgresql://akleao:STAGING_PASSWORD@localhost:5433/akleao
# Production: postgresql://akleao:PROD_PASSWORD@localhost:5434/akleao
```

## Workflow: Making Database Changes

### 1. Local Development

```bash
# 1. Make changes to models in backend/shared/models/
# For example, add a new column to Position model

# 2. Generate migration
cd backend/api-gateway
alembic revision --autogenerate -m "Add position_type column"

# 3. Review the generated migration file
# Check backend/api-gateway/alembic/versions/XXXX_add_position_type_column.py

# 4. Test locally
alembic upgrade head

# 5. Test the feature with the new schema
# Make sure everything works!

# 6. If needed, rollback
alembic downgrade -1
```

### 2. Commit Changes

```bash
# Commit both model changes and migration
git add backend/shared/models/position.py
git add backend/api-gateway/alembic/versions/XXXX_add_position_type_column.py
git commit -m "Add position_type column to positions table"
git push
```

### 3. Deploy to Staging

```bash
# Option A: Run migrations manually
cloud_sql_proxy -instances=PROJECT:us-central1:akleao-staging=tcp:5433 &
DATABASE_URL=postgresql://akleao:STAGING_PASSWORD@localhost:5433/akleao \
  alembic upgrade head

# Option B: Use Cloud Run Job (automated)
gcloud run jobs execute db-migrate-staging --region=us-central1
```

### 4. Test in Staging

```bash
# Deploy code to staging
gcloud run deploy akleao-api-staging \
  --image=... \
  --set-cloudsql-instances=PROJECT:us-central1:akleao-staging

# Test the feature thoroughly in staging environment
# Access: https://akleao-api-staging-xxx.run.app
```

### 5. Deploy to Production

```bash
# Run migrations on production
cloud_sql_proxy -instances=PROJECT:us-central1:akleao-prod=tcp:5434 &
DATABASE_URL=postgresql://akleao:PROD_PASSWORD@localhost:5434/akleao \
  alembic upgrade head

# Deploy code to production
gcloud run deploy akleao-api \
  --image=... \
  --set-cloudsql-instances=PROJECT:us-central1:akleao-prod
```

## Data Seeding

### Local Development Data

Create seed scripts for local development:

```python
# backend/scripts/seed_local.py
"""Seed local database with test data."""
import sys
sys.path.insert(0, "../shared")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shared.models.position import Position
from shared.models.stock import Stock
from datetime import datetime, timedelta

DATABASE_URL = "postgresql://akleao:akleao_dev_password@localhost:5432/akleao"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Add test positions
positions = [
    Position(
        user_id="test_user",
        stock_symbol="AAPL",
        shares=10,
        entry_price=150.00,
        entry_date=datetime.now() - timedelta(days=30),
        is_active=True,
        notes="Test position for Apple"
    ),
    Position(
        user_id="test_user",
        stock_symbol="TSLA",
        shares=5,
        entry_price=200.00,
        entry_date=datetime.now() - timedelta(days=60),
        is_active=True,
        notes="Test position for Tesla"
    ),
]

for position in positions:
    session.add(position)

session.commit()
print("✅ Local database seeded!")
```

Run it:
```bash
cd backend/scripts
python seed_local.py
```

## Database Management Scripts

Create helper scripts:

```bash
# backend/scripts/db_reset_local.sh
#!/bin/bash
# Reset local database completely

echo "⚠️  This will DELETE all local data!"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

cd ../api-gateway

# Drop all tables
alembic downgrade base

# Re-run all migrations
alembic upgrade head

# Seed data
cd ../scripts
python seed_local.py

echo "✅ Local database reset complete!"
```

## Best Practices

### 1. Never Connect to Production from Local Code

Always use explicit DATABASE_URL:
```bash
# ❌ BAD - might accidentally use wrong DB
python script.py

# ✅ GOOD - explicitly set environment
DATABASE_URL=postgresql://localhost:5432/akleao python script.py
```

### 2. Always Test Migrations in Staging First

```bash
# Migration workflow:
# Local (test) → Staging (verify) → Production (deploy)
```

### 3. Backup Before Migrations

```bash
# Production backup before migration
gcloud sql backups create \
  --instance=akleao-prod \
  --description="Pre-migration backup"
```

### 4. Version Control Everything

```bash
# ✅ Commit these:
- Model changes (backend/shared/models/)
- Migration files (backend/api-gateway/alembic/versions/)
- Seed scripts (backend/scripts/)

# ❌ NEVER commit these:
- .env.production
- .env.staging
- Database credentials
- User data dumps
```

### 5. Use Migration Naming Conventions

```bash
# Good migration names:
alembic revision --autogenerate -m "add_position_type_column"
alembic revision --autogenerate -m "create_watchlist_table"
alembic revision --autogenerate -m "add_index_to_reddit_posts"

# Bad migration names:
alembic revision --autogenerate -m "changes"
alembic revision --autogenerate -m "update"
```

## Environment-Specific Configuration

### Backend Config (backend/api-gateway/config.py)

Update to handle multiple environments:

```python
import os
from typing import List

class Settings:
    ENV: str = os.getenv("ENV", "development")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL")

    # CORS - different per environment
    CORS_ORIGINS: List[str] = {
        "development": ["http://localhost:3000"],
        "staging": ["https://akleao-staging-xxx.run.app"],
        "production": ["https://akleao.com", "https://www.akleao.com"],
    }.get(ENV, ["http://localhost:3000"])

    # Logging
    LOG_LEVEL: str = {
        "development": "DEBUG",
        "staging": "INFO",
        "production": "WARNING",
    }.get(ENV, "INFO")

    # Feature flags
    ENABLE_DEBUG_ENDPOINTS: bool = ENV != "production"

settings = Settings()
```

## Viewing Data Across Environments

### Local
```bash
# Using psql
docker exec -it akleao-postgres psql -U akleao -d akleao

# Or use a GUI like Postico, TablePlus, pgAdmin
```

### Staging/Production
```bash
# Start proxy
cloud_sql_proxy -instances=PROJECT:us-central1:akleao-staging=tcp:5433

# Connect with psql
psql "postgresql://akleao:PASSWORD@localhost:5433/akleao"

# Or use GUI and connect to localhost:5433
```

## Common Commands Reference

```bash
# Local Development
docker-compose up -d postgres                    # Start local DB
docker-compose logs -f postgres                  # View DB logs
docker exec -it akleao-postgres psql -U akleao   # Connect to DB
alembic upgrade head                             # Run migrations
alembic downgrade -1                             # Rollback one migration
alembic current                                  # Show current version
alembic history                                  # Show migration history

# Cloud SQL
gcloud sql instances list                        # List instances
gcloud sql instances describe akleao-prod        # Get instance info
gcloud sql databases list --instance=akleao-prod # List databases
gcloud sql backups list --instance=akleao-prod   # List backups

# Cloud SQL Proxy
cloud_sql_proxy -instances=INSTANCE=tcp:PORT     # Connect to instance
```

## Troubleshooting

### "Migration already exists"
```bash
# Check migration history
alembic history

# If needed, manually set current version
alembic stamp head
```

### "Cannot connect to Cloud SQL"
```bash
# Check instance is running
gcloud sql instances describe akleao-prod

# Check proxy is running
ps aux | grep cloud_sql_proxy

# Verify credentials
gcloud auth application-default login
```

### "Migration conflict"
```bash
# If multiple developers create migrations
# Merge them manually or recreate from models
alembic merge heads -m "merge migrations"
```

## Next Steps

1. Set up staging environment on GCP
2. Create seed scripts for test data
3. Document your migration process
4. Set up automated backups for production
5. Create database access policies (who can access what)
