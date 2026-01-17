#!/bin/bash

# BetterLeetSync Backend - Deploy to GCP Cloud Run

set -e

# Configuration
PROJECT_ID="your-gcp-project-id"
SERVICE_NAME="betterleet-backend"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying BetterLeetSync Backend to Cloud Run..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Create .env with: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, HMAC_SECRET"
    exit 1
fi

# Load environment variables
source .env

# Authenticate (if needed)
echo "📝 Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Build and push Docker image
echo "🐳 Building Docker image..."
gcloud builds submit --tag ${IMAGE_NAME}

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --set-env-vars "GITHUB_TOKEN=${GITHUB_TOKEN},GITHUB_OWNER=${GITHUB_OWNER},GITHUB_REPO=${GITHUB_REPO},HMAC_SECRET=${HMAC_SECRET}" \
  --memory 512Mi \
  --timeout 60s \
  --max-instances 10

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "Update your Chrome extension options with this backend URL:"
echo "${SERVICE_URL}"
