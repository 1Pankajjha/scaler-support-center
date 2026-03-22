# Netlify Deployment Guide

## Option 1: Netlify Frontend + Railway Backend (Recommended)

This gives you the best of both worlds:
- Netlify: Fast global CDN for frontend
- Railway: Reliable backend API hosting

### Step 1: Deploy Backend on Railway

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select `scaler-frontend` repo
4. Settings → Root Directory: `backend`
5. Add environment variables:
   - `NODE_ENV=production`
   - `OPENAI_API_KEY=your_key_here`
6. Deploy and note the URL (e.g., `https://app-name.up.railway.app`)

### Step 2: Configure Netlify

1. Update `netlify.toml` with your Railway URL:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-BACKEND-URL.up.railway.app/api/:splat"
  status = 200
```

2. Commit and push the change:
```bash
git add netlify.toml
git commit -m "Configure Netlify redirects"
git push origin main
```

### Step 3: Deploy Frontend on Netlify

1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Click "New site from Git"
4. Select GitHub → Choose `scaler-frontend` repo
5. Deploy settings (already configured in netlify.toml):
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
6. Click "Deploy site"

### Step 4: Update Netlify Redirect

After deploying backend:
1. In Netlify dashboard, go to Site settings → Build & deploy → Environment
2. Add environment variable:
   - `BACKEND_URL=https://your-backend-url.up.railway.app`
3. Or update netlify.toml and redeploy

## Option 2: Everything on Netlify (All-in-One)

### Convert Backend to Netlify Functions

1. Create `netlify/functions` directory:
```bash
mkdir -p netlify/functions
```

2. Move backend code to `netlify/functions/api.js`:
```javascript
// netlify/functions/api.js
const express = require('express');
const serverless = require('serverless-http');
const { OpenAI } = require('openai');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

// Copy all your backend routes here...

module.exports.handler = serverless(app);
```

3. Update `netlify/functions/package.json`

### Netlify Functions Pricing
- Free: 125,000 requests/month
- Pro: $19/month for 400,000 requests/month

## Netlify vs Railway Pricing

### Netlify (Free Tier)
- ✅ 100GB bandwidth/month
- ✅ 300 minutes build time
- ✅ 125,000 function invocations
- ✅ Custom domains
- ✅ Automatic HTTPS
- ✅ Global CDN

### Railway (Free Tier)
- ✅ $5/month credit
- ✅ 500 hours execution
- ✅ 100GB bandwidth
- ✅ Persistent storage
- ✅ Custom domains

## Testing the Deployment

1. **Frontend**: `https://your-app.netlify.app`
2. **Backend Health**: `https://your-app.railway.app/api/health`
3. **API through Netlify**: `https://your-app.netlify.app/api/health`

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Backend needs CORS enabled (already done)
   - Make sure redirect rule is correct

2. **API Not Working**
   - Check Netlify redirects in dashboard
   - Verify backend URL is correct
   - Check browser network tab

3. **Build Fails**
   - Check build logs in Netlify
   - Ensure all dependencies are in package.json

### Environment Variables

**Netlify:**
- Site settings → Build & deploy → Environment

**Railway:**
- Project settings → Variables

## Recommendation

For this project, I recommend **Option 1** (Netlify + Railway) because:
1. Better separation of concerns
2. Easier to debug backend issues
3. Can scale frontend and backend independently
4. Netlify's CDN is extremely fast
5. Railway handles Node.js backend better

## Quick Deploy Commands

```bash
# After configuring netlify.toml
git add netlify.toml frontend/src/services/api.js
git commit -m "Configure for Netlify deployment"
git push origin main

# Netlify will auto-deploy on push!
```

## Success!

Your app will be live at:
- Frontend: `https://your-app.netlify.app`
- Backend: `https://your-app.up.railway.app`
