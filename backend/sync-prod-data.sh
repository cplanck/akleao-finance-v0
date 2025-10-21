#!/bin/bash
# Sync production data to local development database
# Preserves local users and positions while getting fresh Reddit/stock data

set -e

echo "🔄 Syncing production data to local database..."
echo ""

PROD_DB="postgresql://akleao:YTmLuVfpJPuTwYiG%2FFaLUFoY5me1TYyY1UAlc7TvGUw%3D@34.44.5.181:5432/akleao"
LOCAL_DB="postgresql://akleao:akleao_dev_password@localhost:5432/akleao"

# Tables to sync (data that changes frequently)
TABLES_TO_SYNC=(
  "reddit_posts"
  "reddit_comments"
  "stocks"
  "tracked_subreddits"
  "stock_subreddit_mappings"
  "scraper_runs"
)

# Tables to preserve (local dev data)
TABLES_TO_PRESERVE=(
  "user"
  "session"
  "account"
  "verification"
  "pinned_stocks"
  "user_api_keys"
  "openai_usage"
  "positions"
  "research_reports"
)

echo "📥 Dumping production data..."
docker exec akleao-postgres-local pg_dump "$PROD_DB" \
  --data-only \
  $(printf -- "--table=%s " "${TABLES_TO_SYNC[@]}") \
  > /tmp/prod_sync.sql

if [ $? -ne 0 ]; then
  echo "❌ Failed to dump production data"
  exit 1
fi

echo "✅ Dumped $(wc -l < /tmp/prod_sync.sql) lines of data"
echo ""

echo "🗑️  Clearing local tables (preserving user data)..."
TRUNCATE_CMD="BEGIN; "
for table in "${TABLES_TO_SYNC[@]}"; do
  TRUNCATE_CMD+="TRUNCATE TABLE $table CASCADE; "
done
TRUNCATE_CMD+="COMMIT;"

docker exec akleao-postgres-local psql -U akleao -d akleao -c "$TRUNCATE_CMD"

echo "📥 Importing production data..."
docker exec -i akleao-postgres-local psql -U akleao -d akleao < /tmp/prod_sync.sql > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Failed to import production data"
  exit 1
fi

echo ""
echo "✅ Sync complete!"
echo ""

# Show stats
echo "📊 Local database stats:"
docker exec akleao-postgres-local psql -U akleao -d akleao -c "
SELECT
  'Reddit Posts' as table_name,
  COUNT(*) as count,
  MAX(posted_at) as most_recent,
  AGE(NOW(), MAX(posted_at)) as age
FROM reddit_posts
UNION ALL
SELECT
  'Comments',
  COUNT(*),
  MAX(created_at),
  AGE(NOW(), MAX(created_at))
FROM reddit_comments
UNION ALL
SELECT
  'Stocks',
  COUNT(*),
  MAX(created_at),
  AGE(NOW(), MAX(created_at))
FROM stocks;
"

echo ""
echo "🎉 Ready for development with fresh data!"
echo ""
echo "To sync again later, just run: ./sync-prod-data.sh"
