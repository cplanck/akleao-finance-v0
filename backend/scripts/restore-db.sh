#!/bin/bash

# Database Restore Script
# Usage: ./scripts/restore-db.sh <backup_file.sql.gz>

set -e

if [ -z "$1" ]; then
    echo "❌ Error: Please provide a backup file to restore"
    echo "Usage: ./scripts/restore-db.sh <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh backups/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "⚠️  WARNING: This will REPLACE the current database with the backup!"
echo "📦 Backup file: ${BACKUP_FILE}"
echo ""
read -p "Type 'YES I UNDERSTAND' to continue: " confirmation

if [ "$confirmation" != "YES I UNDERSTAND" ]; then
    echo "❌ Restore aborted by user"
    exit 1
fi

echo ""
echo "🔄 Restoring database from backup..."

# Decompress if gzipped
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    echo "📦 Decompressing backup..."
    gunzip -c "${BACKUP_FILE}" | docker-compose exec -T postgres psql -U akleao akleao
else
    cat "${BACKUP_FILE}" | docker-compose exec -T postgres psql -U akleao akleao
fi

echo ""
echo "✅ Database restored successfully!"
