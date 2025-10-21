#!/bin/bash

# Backend Deployment Script
# Builds and pushes all Docker images to GCR

set -e  # Exit on error

PROJECT_ID="akleao-finance-v0"
REGION="us-central1"
PLATFORM="linux/amd64"

echo "🚀 Starting backend deployment to GCR..."
echo "Project: $PROJECT_ID"
echo "Platform: $PLATFORM"
echo ""

# Configure Docker to use gcloud as credential helper
gcloud auth configure-docker

# Build and push API Gateway
echo "📦 Building API Gateway..."
docker build --platform $PLATFORM -t gcr.io/$PROJECT_ID/akleao-api:latest -f api-gateway/Dockerfile .
echo "⬆️  Pushing API Gateway..."
docker push gcr.io/$PROJECT_ID/akleao-api:latest

# Build and push Reddit Scraper
echo "📦 Building Reddit Scraper..."
docker build --platform $PLATFORM -t gcr.io/$PROJECT_ID/reddit-scraper:latest -f workers/reddit-scraper/Dockerfile .
echo "⬆️  Pushing Reddit Scraper..."
docker push gcr.io/$PROJECT_ID/reddit-scraper:latest

# Build and push Comment Scraper
echo "📦 Building Comment Scraper..."
docker build --platform $PLATFORM -t gcr.io/$PROJECT_ID/comment-scraper:latest -f workers/comment-scraper/Dockerfile .
echo "⬆️  Pushing Comment Scraper..."
docker push gcr.io/$PROJECT_ID/comment-scraper:latest

# Build and push Deep Research Worker
echo "📦 Building Deep Research Worker..."
# Copy shared directory into deep-research for Docker build
cp -r shared workers/deep-research/
cd workers/deep-research
docker build --platform $PLATFORM -t gcr.io/$PROJECT_ID/deep-research:latest .
# Cleanup shared directory copy
rm -rf shared
cd ../..
echo "⬆️  Pushing Deep Research Worker..."
docker push gcr.io/$PROJECT_ID/deep-research:latest

echo ""
echo "✅ All images built and pushed successfully!"
echo ""
echo "Next steps:"
echo "1. SSH into your production server"
echo "2. Pull the latest images: docker-compose -f docker-compose.prod.yml pull"
echo "3. Restart services: docker-compose -f docker-compose.prod.yml up -d"
echo ""
