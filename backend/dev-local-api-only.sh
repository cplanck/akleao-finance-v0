#!/bin/bash
# Start only API Gateway and database (no scrapers) for faster local development

set -e

echo "🚀 Starting local API + Database only (no workers)..."
echo ""

# Load environment variables from .env file
if [ -f .env ]; then
    echo "📝 Loading environment from .env"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  Warning: .env file not found. Using defaults."
fi

# Start only specific services
docker-compose -f docker-compose.yml -f docker-compose.local.yml up postgres redis api-gateway --build

echo ""
echo "✅ API + Database started!"
echo ""
echo "Services available at:"
echo "  • API Gateway: http://localhost:8001"
echo "  • PostgreSQL: localhost:5432"
echo "  • Redis: localhost:6379"
