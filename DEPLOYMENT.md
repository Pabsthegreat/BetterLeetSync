# Deploying Backend to Google Cloud Platform

This guide shows how to deploy the BetterLeetSync backend to GCP Cloud Run.

## Prerequisites

1. **Google Cloud Account** - [Sign up](https://cloud.google.com/free) (includes $300 free credits)
2. **gcloud CLI** - [Install](https://cloud.google.com/sdk/docs/install)
3. **Enable APIs** in your GCP project:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API

## Step-by-Step Deployment

### 1. Create GCP Project

```bash
# Login to GCP
gcloud auth login

# Create a new project (or use existing)
gcloud projects create betterleet-sync --name="BetterLeetSync"

# Set as active project
gcloud config set project betterleet-sync
```

### 2. Enable Required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 3. Configure Deployment Script

Edit `backend/deploy.sh` and update:

```bash
PROJECT_ID="betterleet-sync"  # Your GCP project ID
REGION="us-central1"          # Or your preferred region
```

### 4. Verify Environment Variables

Ensure `backend/.env` has:

```env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=YourGitHubUsername
GITHUB_REPO=Leetcode
HMAC_SECRET=leetcodeverylongsectretthatissecure12345
```

### 5. Deploy

```bash
cd backend
chmod +x deploy.sh
./deploy.sh
```

The script will:
- Build a Docker container with your backend
- Push it to Google Container Registry
- Deploy to Cloud Run
- Output your public service URL

### 6. Update Extension

1. Copy the service URL from deployment output (e.g., `https://betterleet-backend-xxxxx-uc.a.run.app`)
2. Open Chrome extension options
3. Update "Backend URL" field with the Cloud Run URL
4. Save settings

## Cost Estimate

Cloud Run pricing (as of 2026):
- **Free tier**: 2 million requests/month, 360,000 GB-seconds/month
- **Your usage**: ~100-500 requests/month (syncs)
- **Estimated cost**: $0/month (within free tier)

## Updating the Backend

After making code changes:

```bash
cd backend
./deploy.sh
```

No need to change the extension URL - it stays the same.

## Monitoring

View logs:
```bash
gcloud run services logs read betterleet-backend --region us-central1
```

Check service status:
```bash
gcloud run services describe betterleet-backend --region us-central1
```

## Troubleshooting

### Build fails
- Check Dockerfile syntax
- Ensure `package.json` has all dependencies

### Deployment fails
- Verify APIs are enabled
- Check GCP quotas/billing

### Extension can't connect
- Verify Cloud Run URL in extension settings
- Check Cloud Run service is "allow unauthenticated"
- Test endpoint: `curl https://your-service-url/health`

## Alternative: Railway (Easier)

If GCP is too complex, try [Railway](https://railway.app):

1. Sign up at railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select your BetterLeetSync repo
4. Select `backend` folder
5. Add environment variables in Railway dashboard
6. Get deployed URL from Railway

Railway also has a generous free tier and simpler setup.
