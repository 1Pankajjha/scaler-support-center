# Scaler Support Center - Railway Deployment Guide

This guide will help you deploy both the backend and frontend of the Scaler Support Center on Railway.

## Prerequisites

1. Railway account (sign up at [railway.app](https://railway.app))
2. GitHub account with the project repository
3. OpenAI API key (for chat functionality)

## Step 1: Prepare and Push Code

### 1.1 Add all files to git
```bash
# From the project root directory
git add .
git add backend/railway.json
git add frontend/railway.json
git add .gitignore
git add Dockerfile
git add start.sh
git add backend/server.js
```

### 1.2 Commit changes
```bash
git commit -m "Configure for Railway deployment - Add railway.json configs and health checks"
```

### 1.3 Push to GitHub
```bash
git push origin main
```

## Step 2: Deploy Backend on Railway

### 2.1 Create New Project
1. Login to Railway dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will automatically detect it's a Node.js project

### 2.2 Configure Backend
1. Once the project is created, click on it
2. Go to "Settings" tab
3. Set the "Root Directory" to: `backend`
4. Click "Save"

### 2.3 Add Environment Variables
Go to "Variables" tab and add:
```
NODE_ENV=production
OPENAI_API_KEY=your_openai_api_key_here
```

### 2.4 Deploy
1. Go to "Deployments" tab
2. Click "New Deployment"
3. Wait for deployment to complete
4. Note the backend URL (it will look like `https://your-app-name.up.railway.app`)

## Step 3: Deploy Frontend on Railway

### 3.1 Create New Project
1. In Railway dashboard, click "New Project"
2. Click "New Project" again (not from GitHub)
3. Choose "Empty project"

### 3.2 Configure Frontend
1. In the new project, go to "Settings"
2. Connect your GitHub repository
3. Set "Root Directory" to: `frontend`
4. Click "Save"

### 3.3 Add Environment Variables
Go to "Variables" tab and add:
```
NODE_ENV=production
VITE_API_URL=https://your-backend-url.up.railway.app
```
(Replace with your actual backend URL from Step 2)

### 3.4 Deploy
1. Go to "Deployments" tab
2. Click "New Deployment"
3. Wait for deployment to complete

## Step 4: Update Frontend API Configuration

The frontend needs to know where the backend is deployed. Update the API base URL:

In `frontend/src/services/api.js` (or wherever your API calls are made):
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
```

## Step 5: Verify Deployment

1. Check if backend is running: `https://your-backend-url.up.railway.app/api/health`
2. Check if frontend is running: `https://your-frontend-url.up.railway.app`
3. Test the chat functionality
4. Test article browsing

## Troubleshooting

### Common Issues

1. **Build fails with "package.json not found"**
   - Ensure the "Root Directory" is set correctly (backend or frontend)
   - Check that railway.json exists in the correct directory

2. **Frontend can't connect to backend**
   - Ensure CORS is configured in backend (it already is)
   - Check that VITE_API_URL is set correctly
   - Verify backend is accessible

3. **Chat not working**
   - Check that OPENAI_API_KEY is set in backend variables
   - Verify the key has credits available

4. **Database issues**
   - Railway uses ephemeral storage by default
   - For production, consider adding Railway's PostgreSQL volume

### Viewing Logs

1. Go to your project in Railway
2. Click on "Logs" tab
3. Select the service (backend or frontend)
4. View real-time logs

### Redeploying

To update your application:
1. Push changes to GitHub
2. Go to Railway project
3. Click "New Deployment"

## Production Considerations

1. **Database**: Consider using Railway's PostgreSQL for persistent storage
2. **Environment Variables**: Never commit API keys to git
3. **Monitoring**: Set up Railway's alerts for downtime
4. **Custom Domain**: Add custom domain in Railway settings

## Support

If you encounter issues:
1. Check Railway logs first
2. Ensure all environment variables are set
3. Verify the railway.json configurations
4. Check that the build commands are correct

## URLs After Deployment

- Backend: `https://<backend-project-name>.up.railway.app`
- Frontend: `https://<frontend-project-name>.up.railway.app`
- API Health Check: `https://<backend-project-name>.up.railway.app/api/health`
