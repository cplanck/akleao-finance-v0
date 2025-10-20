#!/bin/bash
# Export local database data to seed production

set -e

echo "📦 Exporting local database data..."
echo ""

# Configuration
CONTAINER_NAME="akleao-postgres"
DB_USER="akleao"
DB_NAME="akleao"
EXPORT_DIR="./db_exports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="$EXPORT_DIR/local_data_$TIMESTAMP.sql"

# Create export directory
mkdir -p "$EXPORT_DIR"

echo "🔍 Checking if database container is running..."
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Error: PostgreSQL container '$CONTAINER_NAME' is not running"
    echo "   Start it with: cd backend && docker-compose up -d postgres"
    exit 1
fi

echo "✅ Container is running"
echo ""

# Export schema and data
echo "💾 Exporting database to: $EXPORT_FILE"
docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    > "$EXPORT_FILE"

# Also create a data-only export (for refreshing existing schemas)
DATA_ONLY_FILE="$EXPORT_DIR/local_data_only_$TIMESTAMP.sql"
echo "💾 Creating data-only export: $DATA_ONLY_FILE"
docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --data-only \
    --no-owner \
    --no-acl \
    > "$DATA_ONLY_FILE"

# Create a CSV export for easier inspection
CSV_DIR="$EXPORT_DIR/csv_$TIMESTAMP"
mkdir -p "$CSV_DIR"

echo "📊 Exporting tables to CSV..."

# Export each table to CSV
TABLES=("positions" "stocks" "reddit_posts" "subreddit_tracking" "reddit_analyses")

for table in "${TABLES[@]}"; do
    echo "   - Exporting $table..."
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c \
        "COPY (SELECT * FROM $table) TO STDOUT WITH CSV HEADER" \
        > "$CSV_DIR/${table}.csv" 2>/dev/null || echo "   ⏭️  Table $table doesn't exist, skipping"
done

# Get statistics
echo ""
echo "📈 Database Statistics:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT
    schemaname,
    tablename,
    n_tup_ins as total_rows
FROM pg_stat_user_tables
ORDER BY n_tup_ins DESC;
" | grep -v "^$"

echo ""
echo "✅ Export complete!"
echo ""
echo "📁 Files created:"
echo "   Full dump:  $EXPORT_FILE"
echo "   Data only:  $DATA_ONLY_FILE"
echo "   CSV files:  $CSV_DIR/"
echo ""
echo "📝 Next steps:"
echo "   1. Review the CSV files to ensure no sensitive data"
echo "   2. Upload to Cloud Storage: gsutil cp $EXPORT_FILE gs://YOUR_BUCKET/"
echo "   3. Import to production: ./import_to_production.sh"
echo ""
