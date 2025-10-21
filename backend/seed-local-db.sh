#!/bin/bash
# Seed the local database with sample data

set -e

echo "🌱 Seeding local database..."
echo ""

# Check if postgres is running
if ! docker ps | grep -q akleao-postgres-local; then
    echo "❌ Error: PostgreSQL container is not running!"
    echo ""
    echo "Please start the database first:"
    echo "  docker-compose -f docker-compose.yml -f docker-compose.local.yml up postgres -d"
    exit 1
fi

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Install dependencies if needed
if ! python3 -c "import asyncpg" 2>/dev/null; then
    echo "📦 Installing required dependencies..."
    pip3 install asyncpg sqlalchemy
fi

# Run seed script
echo "🌱 Running seed script..."
python3 scripts/seed_local_db.py

echo ""
echo "✅ Database seeded successfully!"
echo ""
echo "You can now:"
echo "  1. Start the API: ./dev-local-api-only.sh"
echo "  2. Start everything: ./dev-local.sh"
echo "  3. Start frontend: cd .. && npm run dev"
