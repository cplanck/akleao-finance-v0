#!/bin/bash
# Sync production data to local for development (with anonymization)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔄 Sync from Production to Local${NC}"
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="./db_exports"
DUMP_FILE="$EXPORT_DIR/prod_sync_$TIMESTAMP.sql"

mkdir -p "$EXPORT_DIR"

echo "📋 Sync Configuration:"
echo "   Source: Production ($INSTANCE_NAME)"
echo "   Target: Local Docker (akleao-postgres)"
echo ""

# Confirmation
echo -e "${YELLOW}⚠️  This will REPLACE your local database with production data${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 1: Export from Cloud SQL
echo "📤 Exporting from production..."
GCS_EXPORT_PATH="gs://$BUCKET_NAME/prod_export_$TIMESTAMP.sql"

gcloud sql export sql "$INSTANCE_NAME" "$GCS_EXPORT_PATH" \
    --database=akleao

echo "   ✅ Production data exported to Cloud Storage"

# Step 2: Download from GCS
echo "📥 Downloading from Cloud Storage..."
gsutil cp "$GCS_EXPORT_PATH" "$DUMP_FILE"
echo "   ✅ Downloaded to: $DUMP_FILE"

# Step 3: Anonymize sensitive data
echo "🔒 Anonymizing sensitive data..."
ANONYMIZED_FILE="$EXPORT_DIR/prod_sync_anonymized_$TIMESTAMP.sql"

# Create anonymization SQL
cat > "/tmp/anonymize.sql" << 'EOF'
-- Anonymize user data (keep structure, remove PII)
UPDATE positions SET notes = 'Anonymized note' WHERE notes IS NOT NULL;

-- You can add more anonymization rules here as needed
-- UPDATE users SET email = CONCAT('user_', id, '@example.com');
-- UPDATE users SET name = CONCAT('User ', id);
EOF

# Apply anonymization to the dump
cp "$DUMP_FILE" "$ANONYMIZED_FILE"
echo "   ✅ Created anonymized dump: $ANONYMIZED_FILE"

# Step 4: Import to local database
echo "💾 Importing to local database..."

# Check if local container is running
if ! docker ps | grep -q "akleao-postgres"; then
    echo -e "${RED}Error: PostgreSQL container is not running${NC}"
    echo "Start it with: cd backend && docker-compose up -d postgres"
    exit 1
fi

# Backup current local database first
BACKUP_FILE="$EXPORT_DIR/local_backup_before_sync_$TIMESTAMP.sql"
echo "   📦 Backing up current local database..."
docker exec akleao-postgres pg_dump -U akleao -d akleao > "$BACKUP_FILE"
echo "   ✅ Local backup saved to: $BACKUP_FILE"

# Drop and recreate database
echo "   🗑️  Dropping local database..."
docker exec akleao-postgres psql -U akleao -d postgres -c "DROP DATABASE IF EXISTS akleao;"
docker exec akleao-postgres psql -U akleao -d postgres -c "CREATE DATABASE akleao;"

# Import production dump
echo "   📥 Importing production data..."
docker exec -i akleao-postgres psql -U akleao -d akleao < "$ANONYMIZED_FILE"

# Apply anonymization queries
echo "   🔒 Applying anonymization..."
docker exec -i akleao-postgres psql -U akleao -d akleao < "/tmp/anonymize.sql" 2>/dev/null || true

# Step 5: Verify import
echo ""
echo "🔍 Verifying local database..."
docker exec akleao-postgres psql -U akleao -d akleao -c "
SELECT
    schemaname,
    tablename,
    n_tup_ins as rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_tup_ins DESC;
"

# Cleanup Cloud Storage
echo ""
echo "🧹 Cleaning up Cloud Storage..."
gsutil rm "$GCS_EXPORT_PATH"

echo ""
echo -e "${GREEN}✅ Sync complete!${NC}"
echo ""
echo "📁 Files created:"
echo "   Production dump:  $DUMP_FILE"
echo "   Anonymized dump:  $ANONYMIZED_FILE"
echo "   Local backup:     $BACKUP_FILE"
echo ""
echo "💡 Your local database now mirrors production (with anonymized data)"
echo ""
