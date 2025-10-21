#!/bin/bash
# Start local development environment with local PostgreSQL database

set -e

echo "🚀 Starting local development environment..."
echo ""
echo "This will:"
echo "  • Start a local PostgreSQL database"
echo "  • Start Redis"
echo "  • Start API Gateway"
echo "  • Start all workers (scrapers, research, etc.)"
echo ""

# Load environment variables from .env file
if [ -f .env ]; then
    echo "📝 Loading environment from .env"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  Warning: .env file not found. Using defaults."
fi

# Start services with local overrides
docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build

echo ""
echo "✅ Local development environment started!"
echo ""
echo "Services available at:"
echo "  • API Gateway: http://localhost:8001"
echo "  • PostgreSQL: localhost:5432"
echo "  • Redis: localhost:6379"
