# Google OAuth Setup for Admin Panel

## Overview
The admin panel now uses secure Google OAuth 2.0 authentication instead of mock authentication. This ensures only authorized users can access the admin dashboard.

## Setup Instructions

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application** as the application type
6. Add authorized JavaScript origins:
   - Development: `http://localhost:5176`
   - Production: `https://your-frontend-domain.com`
7. Add authorized redirect URIs:
   - Development: `http://localhost:5176/admin/login`
   - Production: `https://your-frontend-domain.com/admin/login`
8. Save and note down your **Client ID** and **Client Secret**

### 2. Backend Configuration

Create a `.env` file in the backend directory:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# JWT Secret (generate a strong random string)
JWT_SECRET=your_jwt_secret_key_here

# Session Secret (generate a strong random string)
SESSION_SECRET=your_session_secret_here

# Frontend URL
FRONTEND_URL=http://localhost:5176

# Environment
NODE_ENV=development
```

### 3. Frontend Configuration

Create a `.env.local` file in the frontend directory:

```env
# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 4. Authorized Users

By default, users with email domains:
- `@scaler.com`
- `@interviewbit.com`

Are authorized to access the admin panel.

To add specific emails, update the `adminWhitelist` array in `/backend/auth.js`:

```javascript
const adminWhitelist = [
  'admin@scaler.com',
  'support@scaler.com',
  'your-email@domain.com',
  // Add more authorized emails
];
```

## Security Features

### ✅ Implemented
- **OAuth 2.0 Flow**: Proper Google authentication
- **Token Verification**: Backend validates Google ID tokens
- **HTTP-Only Cookies**: Secure session management
- **Route Protection**: All admin routes require authentication
- **Access Control**: Domain and email whitelist validation
- **Audit Logging**: All login attempts are logged
- **CSRF Protection**: SameSite cookie attribute
- **Session Expiration**: 24-hour session timeout

### 🔒 Security Best Practices
- Tokens are never exposed to frontend
- Sessions are stored in HTTP-only cookies
- All admin API endpoints are protected
- Unauthorized access attempts are logged
- Secure cookie flags in production

## Testing

1. Start the backend server
2. Start the frontend development server
3. Navigate to `/admin/login`
4. Click "Continue with Google"
5. Sign in with an authorized Google account
6. You should be redirected to the admin dashboard

## Troubleshooting

### "Access denied" error
- Ensure your email domain is in the authorized list
- Check the `adminWhitelist` in `auth.js`

### "Invalid token" error
- Verify your Google Client ID is correct
- Ensure frontend and backend URLs match Google Console settings

### CORS errors
- Check `FRONTEND_URL` in backend `.env`
- Verify authorized origins in Google Console

## Production Deployment

1. Update environment variables with production values
2. Ensure HTTPS is enabled (required for OAuth)
3. Update Google Console with production URLs
4. Set `NODE_ENV=production`
