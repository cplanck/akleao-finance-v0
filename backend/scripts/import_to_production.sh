#!/bin/bash
# Import data to production Cloud SQL instance

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  WARNING: This will import data to PRODUCTION${NC}"
echo ""

# Check required environment variables
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID not set${NC}"
    echo "Set it with: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

# Configuration
INSTANCE_NAME="${CLOUD_SQL_INSTANCE:-akleao-prod}"
REGION="${GCP_REGION:-us-central1}"
BUCKET_NAME="${GCS_BUCKET:-akleao-db-imports}"
IMPORT_FILE="$1"

if [ -z "$IMPORT_FILE" ]; then
    echo -e "${RED}Error: No import file specified${NC}"
    echo "Usage: $0 <path-to-sql-file>"
    echo ""
    echo "Available exports:"
    ls -lh ./db_exports/*.sql 2>/dev/null || echo "  No exports found. Run ./export_local_data.sh first"
    exit 1
fi

if [ ! -f "$IMPORT_FILE" ]; then
    echo -e "${RED}Error: File not found: $IMPORT_FILE${NC}"
    exit 1
fi

echo "📋 Import Configuration:"
echo "   Project:     $GCP_PROJECT_ID"
echo "   Instance:    $INSTANCE_NAME"
echo "   Region:      $REGION"
echo "   Import file: $IMPORT_FILE"
echo ""

# Final confirmation
echo -e "${YELLOW}This will REPLACE all data in the production database!${NC}"
read -p "Type 'IMPORT' to confirm: " -r
echo
if [ "$REPLY" != "IMPORT" ]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Create GCS bucket if it doesn't exist
echo "📦 Setting up Cloud Storage bucket..."
if ! gsutil ls -b "gs://$BUCKET_NAME" &>/dev/null; then
    gsutil mb -p "$GCP_PROJECT_ID" -l "$REGION" "gs://$BUCKET_NAME"
    echo "   ✅ Created bucket: gs://$BUCKET_NAME"
else
    echo "   ✅ Bucket already exists"
fi

# Step 2: Upload SQL file to GCS
FILENAME=$(basename "$IMPORT_FILE")
GCS_PATH="gs://$BUCKET_NAME/$FILENAME"

echo "☁️  Uploading to Cloud Storage..."
gsutil cp "$IMPORT_FILE" "$GCS_PATH"
echo "   ✅ Uploaded to: $GCS_PATH"

# Step 3: Grant Cloud SQL service account access
echo "🔐 Granting permissions..."
SERVICE_ACCOUNT=$(gcloud sql instances describe "$INSTANCE_NAME" \
    --format="value(serviceAccountEmailAddress)")

gsutil iam ch "serviceAccount:$SERVICE_ACCOUNT:objectViewer" "gs://$BUCKET_NAME"
echo "   ✅ Granted access to: $SERVICE_ACCOUNT"

# Step 4: Import to Cloud SQL
echo "📥 Importing to Cloud SQL (this may take a few minutes)..."
gcloud sql import sql "$INSTANCE_NAME" "$GCS_PATH" \
    --database=akleao \
    --quiet

echo ""
echo -e "${GREEN}✅ Import complete!${NC}"
echo ""

# Step 5: Verify import
echo "🔍 Verifying import..."
echo "   Connecting to production database..."

# Start Cloud SQL Proxy in background
cloud_sql_proxy -instances="$GCP_PROJECT_ID:$REGION:$INSTANCE_NAME"=tcp:5434 &
PROXY_PID=$!
sleep 3  # Wait for proxy to start

# Count rows (you'll need to provide password)
echo ""
echo "📊 Production Database Statistics:"
echo "   (Enter production database password when prompted)"
PGPASSWORD="${DB_PASSWORD}" psql \
    "postgresql://akleao@localhost:5434/akleao" \
    -c "SELECT
        schemaname,
        tablename,
        n_tup_ins as rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_tup_ins DESC;" 2>/dev/null || echo "   (Run manually to verify)"

# Cleanup
kill $PROXY_PID 2>/dev/null || true

echo ""
echo -e "${GREEN}🎉 Production database seeded successfully!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Test the production deployment"
echo "   2. Verify data in production UI"
echo "   3. Set up automated backups"
echo "   4. Clean up: gsutil rm $GCS_PATH"
echo ""
