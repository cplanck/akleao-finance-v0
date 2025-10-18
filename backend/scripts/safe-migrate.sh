#!/bin/bash

# Safe Migration Script
# This script enforces safety checks before running database migrations

set -e

echo "🔍 Pre-Migration Safety Checklist"
echo "=================================="
echo ""

# Check if migration file is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the migration file to review"
    echo "Usage: ./scripts/safe-migrate.sh <migration_revision_id>"
    echo ""
    echo "To see pending migrations, run:"
    echo "  docker-compose exec api-gateway alembic current"
    echo "  docker-compose exec api-gateway alembic history"
    exit 1
fi

MIGRATION_ID="$1"
MIGRATION_FILE="api-gateway/alembic/versions/${MIGRATION_ID}*.py"

# Find the migration file
FOUND_FILE=$(ls ${MIGRATION_FILE} 2>/dev/null | head -1)

if [ -z "$FOUND_FILE" ]; then
    echo "❌ Error: Migration file not found for ID: ${MIGRATION_ID}"
    echo "Looking for: ${MIGRATION_FILE}"
    exit 1
fi

echo "📄 Migration file: ${FOUND_FILE}"
echo ""

# Check for dangerous operations
echo "🔍 Checking for dangerous operations..."
DANGEROUS_OPS=$(grep -n "op.drop_table\|op.drop_column" "${FOUND_FILE}" || true)

if [ -n "$DANGEROUS_OPS" ]; then
    echo "⚠️  WARNING: Found potentially dangerous operations:"
    echo ""
    echo "$DANGEROUS_OPS"
    echo ""
    echo "❓ Are you SURE you want to drop these tables/columns?"
    echo "   This will DELETE DATA PERMANENTLY!"
    echo ""
    read -p "Type 'YES I UNDERSTAND' to continue: " confirmation

    if [ "$confirmation" != "YES I UNDERSTAND" ]; then
        echo "❌ Migration aborted by user"
        exit 1
    fi
else
    echo "✅ No dangerous DROP operations found"
fi

# Create backup
echo ""
echo "💾 Creating database backup before migration..."
./scripts/backup-db.sh "pre_migration_${MIGRATION_ID}"

# Show the full migration
echo ""
echo "📖 Full migration content:"
echo "=================================="
cat "${FOUND_FILE}"
echo "=================================="
echo ""

# Final confirmation
read -p "Continue with migration? (y/N): " final_confirm

if [ "$final_confirm" != "y" ] && [ "$final_confirm" != "Y" ]; then
    echo "❌ Migration aborted by user"
    exit 1
fi

# Run migration
echo ""
echo "🚀 Running migration..."
docker-compose exec api-gateway alembic upgrade head

echo ""
echo "✅ Migration completed!"
echo "💡 If something went wrong, restore with:"
echo "   ./scripts/restore-db.sh backups/pre_migration_${MIGRATION_ID}.sql.gz"
