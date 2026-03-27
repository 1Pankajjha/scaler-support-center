const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const session = require('express-session');

// Initialize Google OAuth client
console.log('🔧 Initializing Google OAuth Client...');
console.log('🔑 Google Client ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware to verify Google ID token
const verifyGoogleToken = async (token) => {
  // DEBUG BYPASS REMOVED FOR SECURITY
  // No bypass allowed - must use valid Google OAuth token
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid token payload');
    }
    return payload;
  } catch (error) {
    console.error('Error verifying Google token:', error);
    throw new Error('Invalid Google OAuth token');
  }
};

// Check if user is authorized admin
const isAuthorizedAdmin = (email) => {
  // SECURITY: Only allow scaler.com domain emails
  // interviewbit.com removed for security
  
  if (!email || typeof email !== 'string') {
    console.log('❌ Invalid email format');
    return false;
  }
  
  const domain = email.split('@')[1];
  
  // STRICT: Only scaler.com domain allowed
  if (domain !== 'scaler.com') {
    console.log('❌ Access denied for domain:', domain);
    return false;
  }
  
  console.log('✅ User authorized:', email);
  return true;
};

// Generate JWT session token
const generateSessionToken = (user) => {
  return jwt.sign(
    { 
      email: user.email, 
      name: user.name,
      picture: user.picture,
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET || 'scaler_support_jwt_secret_2024_production',
    { expiresIn: '24h' }
  );
};

// Middleware to protect admin routes
const authenticateAdmin = (req, res, next) => {
  try {
    const token = req.cookies.admin_session || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('❌ Authentication failed: No token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'scaler_support_jwt_secret_2024_production');
    
    // Double-check authorization
    if (!isAuthorizedAdmin(decoded.email)) {
      console.log('❌ Unauthorized access attempt by:', decoded.email);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    req.user = decoded;
    console.log('✅ Admin authenticated:', decoded.email);
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
};

// Log admin access attempts
const logAdminAccess = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const email = req.user?.email || 'Unknown';
  
  console.log(`[${timestamp}] Admin Access - IP: ${ip}, Email: ${email}, Path: ${req.path}`);
  next();
};

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'scaler_support_session_secret_2024_production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
};

module.exports = {
  verifyGoogleToken,
  isAuthorizedAdmin,
  generateSessionToken,
  authenticateAdmin,
  logAdminAccess,
  sessionConfig
};
