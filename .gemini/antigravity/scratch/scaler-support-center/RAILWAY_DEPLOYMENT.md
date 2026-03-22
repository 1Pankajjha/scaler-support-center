# Railway Deployment Guide

## Overview
This guide will help you deploy both the backend and frontend of the Scaler Support Center on Railway.

## Prerequisites
- Railway account (sign up at [railway.app](https://railway.app))
- GitHub repository with the code (already done!)

## Step 1: Deploy Backend

1. **Login to Railway**
   - Go to [railway.app](https://railway.app)
   - Login with your GitHub account

2. **Create New Project**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select the `scaler-frontend` repository
   - Click "Deploy Now"

3. **Configure Backend Service**
   - Once the project is created, click on it
   - Click "Settings" tab
   - Set the "Root Directory" to: `backend`
   - Click "Save"

4. **Add Environment Variables**
   - Go to "Variables" tab
   - Add these variables:
     ```
     NODE_ENV=production
     OPENAI_API_KEY=your_openai_api_key_here
     ```
   - Click "Save Variables"

5. **Deploy Backend**
   - Go to "Deployments" tab
   - Click "New Deployment"
   - Wait for deployment to complete
   - Note the backend URL (it will look like `https://your-app-name.up.railway.app`)

## Step 2: Deploy Frontend

1. **Create New Service**
   - In the same Railway project, click "New Service"
   - Select "GitHub Repo"
   - Choose the same `scaler-frontend` repository
   - Click "Deploy Now"

2. **Configure Frontend Service**
   - Click on the new service
   - Go to "Settings" tab
   - Set the "Root Directory" to: `frontend`
   - Click "Save"

3. **Add Environment Variables**
   - Go to "Variables" tab
   - Add this variable:
     ```
     NODE_ENV=production
     ```
   - Click "Save Variables"

4. **Deploy Frontend**
   - Go to "Deployments" tab
   - Click "New Deployment"
   - Wait for deployment to complete

## Step 3: Connect Frontend to Backend

Since we're deploying both on Railway, we need to proxy API calls from frontend to backend:

1. **Add a Proxy to Frontend**
   - In the frontend service settings:
   - Go to "Settings" → "Environment"
   - Add a new variable:
     ```
     VITE_API_URL=https://your-backend-url.up.railway.app
     ```
   - Replace with your actual backend URL from Step 1

2. **Alternative: Use Railway's Networking**
   - Railway automatically connects services in the same project
   - The frontend can access backend at: `http://backend:5001`

## Step 4: Verify Deployment

1. **Test Backend**
   - Open: `https://your-backend-url.up.railway.app/api/health`
   - Should return: `{"status":"ok"}`

2. **Test Frontend**
   - Open: `https://your-frontend-url.up.railway.app`
   - The app should load and connect to the backend

3. **Test Full Functionality**
   - Try browsing articles
   - Test the chat feature
   - Check if all API calls work

## Railway Pricing (as of 2024)

- **Free Tier**: $5/month credit
  - 500 hours of execution time
  - 100GB bandwidth
  - Perfect for development/small projects

- **Hobby Plan**: $5/month
  - Everything in Free + more hours
  - Custom domains
  - Better performance

## Troubleshooting

### Common Issues

1. **Build fails with "package.json not found"**
   - Check that "Root Directory" is set correctly (backend or frontend)
   - Ensure railway.json exists in the right directory

2. **Frontend can't connect to backend**
   - Check CORS settings in backend (already configured)
   - Verify VITE_API_URL is set correctly
   - Ensure backend is deployed and running

3. **Database issues**
   - Railway uses ephemeral storage by default
   - Database resets on each deployment
   - For production, add a Railway PostgreSQL volume

### Viewing Logs

1. Go to your Railway project
2. Click on the service (backend or frontend)
3. Click "Logs" tab
4. View real-time logs

### Redeploying

1. Push changes to GitHub
2. Go to Railway service
3. Click "New Deployment"

## Production Considerations

1. **Database**: Add Railway PostgreSQL for persistent storage
2. **Environment Variables**: Never commit API keys to git
3. **Custom Domains**: Add custom domains in settings
4. **Monitoring**: Set up alerts for downtime

## URLs After Deployment

- Backend: `https://<service-name>.up.railway.app`
- Frontend: `https://<service-name>.up.railway.app`

## Success!

Your app is now live on Railway! The free tier should be sufficient for development and moderate usage.
