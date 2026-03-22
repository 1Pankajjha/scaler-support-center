# Railway Deployment Configuration

## Environment Variables Required

### Backend Service
1. **NODE_ENV** (set to `production`)
2. **PORT** (automatically set by Railway)
3. **OPENAI_API_KEY** - Your OpenAI API key for the chatbot functionality

### Frontend Service
1. **VITE_API_URL** - The backend service URL (e.g., https://your-backend-service.up.railway.app)

## Deployment Architecture

This project is configured as a monorepo with separate services:

### Current Setup
- Single Railway service running the backend API
- Frontend needs to be deployed as a separate service

### Recommended Setup
1. **Backend Service**: 
   - Root directory with railway.json and Procfile
   - Runs the Express API server
   - Handles all /api routes

2. **Frontend Service** (separate deployment):
   - Deploy only the `/frontend` directory
   - Static build served by Railway
   - VITE_API_URL should point to backend service

## Database Notes
- Currently uses SQLite with better-sqlite3
- For production, consider Railway's Postgres addon
- SQLite file is stored at `scaler.db` in the backend directory

## Deployment Steps
1. Push changes to GitHub
2. In Railway dashboard:
   - Create new project from GitHub
   - Set environment variables
   - Deploy will automatically start
3. For frontend, create a separate service pointing to the frontend directory
