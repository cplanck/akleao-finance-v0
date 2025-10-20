#!/bin/bash

# Akleao Finance - GCP Deployment Script
# This script helps deploy the application to Google Cloud Platform

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-us-central1}"
REGISTRY="$REGION-docker.pkg.dev"
REPO_NAME="akleao-repo"

# Function to print colored messages
print_message() {
    echo -e "${GREEN}==>${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    print_error "GCP_PROJECT_ID environment variable is not set"
    echo "Please set it with: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

# Confirm deployment
echo ""
print_warning "This will deploy Akleao Finance to GCP project: $PROJECT_ID"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 1: Configure gcloud
print_message "Configuring gcloud..."
gcloud config set project "$PROJECT_ID"

# Step 2: Enable required APIs
print_message "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudscheduler.googleapis.com

# Step 3: Create Artifact Registry if it doesn't exist
print_message "Setting up Artifact Registry..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Akleao Finance Docker images"
else
    print_message "Artifact Registry already exists"
fi

# Step 4: Configure Docker authentication
print_message "Configuring Docker authentication..."
gcloud auth configure-docker "$REGISTRY"

# Step 5: Build and push images
print_message "Building and pushing Docker images..."

# Frontend
print_message "Building frontend..."
docker build -t "$REGISTRY/$PROJECT_ID/$REPO_NAME/frontend:latest" .
docker push "$REGISTRY/$PROJECT_ID/$REPO_NAME/frontend:latest"

# Backend API
print_message "Building backend API..."
docker build -t "$REGISTRY/$PROJECT_ID/$REPO_NAME/api-gateway:latest" ./backend/api-gateway
docker push "$REGISTRY/$PROJECT_ID/$REPO_NAME/api-gateway:latest"

# Workers
print_message "Building workers..."
docker build -t "$REGISTRY/$PROJECT_ID/$REPO_NAME/reddit-scraper:latest" ./backend/workers/reddit-scraper
docker push "$REGISTRY/$PROJECT_ID/$REPO_NAME/reddit-scraper:latest"

docker build -t "$REGISTRY/$PROJECT_ID/$REPO_NAME/comment-scraper:latest" ./backend/workers/comment-scraper
docker push "$REGISTRY/$PROJECT_ID/$REPO_NAME/comment-scraper:latest"

docker build -t "$REGISTRY/$PROJECT_ID/$REPO_NAME/deep-research:latest" ./backend/workers/deep-research
docker push "$REGISTRY/$PROJECT_ID/$REPO_NAME/deep-research:latest"

# Step 6: Deploy services
print_message "Deploying services to Cloud Run..."

# Check if secrets exist
if ! gcloud secrets describe OPENAI_API_KEY &>/dev/null; then
    print_warning "Secrets not found. Please create secrets first:"
    echo "  See DEPLOYMENT.md for instructions on creating secrets"
    echo ""
    read -p "Press enter to continue deployment (services may fail without secrets)..."
fi

# Deploy Backend API
print_message "Deploying backend API..."
gcloud run deploy akleao-api \
    --image="$REGISTRY/$PROJECT_ID/$REPO_NAME/api-gateway:latest" \
    --platform=managed \
    --region="$REGION" \
    --allow-unauthenticated \
    --cpu=1 \
    --memory=512Mi \
    --min-instances=0 \
    --max-instances=10 \
    --set-env-vars="ENV=production"

# Get backend URL
BACKEND_URL=$(gcloud run services describe akleao-api --region="$REGION" --format='value(status.url)')
print_message "Backend deployed at: $BACKEND_URL"

# Deploy Frontend
print_message "Deploying frontend..."
gcloud run deploy akleao-frontend \
    --image="$REGISTRY/$PROJECT_ID/$REPO_NAME/frontend:latest" \
    --platform=managed \
    --region="$REGION" \
    --allow-unauthenticated \
    --set-env-vars="NEXT_PUBLIC_API_URL=$BACKEND_URL" \
    --cpu=1 \
    --memory=512Mi \
    --min-instances=0 \
    --max-instances=10

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe akleao-frontend --region="$REGION" --format='value(status.url)')
print_message "Frontend deployed at: $FRONTEND_URL"

# Step 7: Update backend CORS
print_message "Updating backend CORS settings..."
gcloud run services update akleao-api \
    --region="$REGION" \
    --set-env-vars="CORS_ORIGINS=[\"$FRONTEND_URL\"]"

# Done!
echo ""
print_message "Deployment complete! 🎉"
echo ""
echo "Frontend URL: $FRONTEND_URL"
echo "Backend URL:  $BACKEND_URL"
echo ""
print_warning "Next steps:"
echo "1. Set up Cloud SQL database (see DEPLOYMENT.md)"
echo "2. Configure secrets (see DEPLOYMENT.md)"
echo "3. Run database migrations"
echo "4. Deploy workers as Cloud Run Jobs"
echo "5. Set up custom domain (optional)"
echo ""
