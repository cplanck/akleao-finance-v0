#!/bin/bash

# Database Backup Script
# Usage: ./scripts/backup-db.sh [backup_name]

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME=${1:-"backup_${TIMESTAMP}"}
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "🔒 Creating database backup..."
echo "📁 Backup file: ${BACKUP_FILE}"

# Create backup
docker-compose exec -T postgres pg_dump -U akleao akleao > "${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get file size
SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo "✅ Backup created successfully!"
echo "📦 File: ${BACKUP_FILE}"
echo "💾 Size: ${SIZE}"

# Keep only last 10 backups
echo "🧹 Cleaning old backups (keeping last 10)..."
cd "${BACKUP_DIR}"
ls -t *.sql.gz | tail -n +11 | xargs -r rm --

echo "✨ Done!"
