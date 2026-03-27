const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const session = require('express-session');

// Initialize Google OAuth client
console.log('🔧 Initializing Google OAuth Client...');
console.log('🔑 Google Client ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware to verify Google ID token
const verifyGoogleToken = async (token) => {
  // TEMPORARY BYPASS FOR DEBUGGING
  if (token === 'DEBUG_BYPASS_TOKEN') {
    console.log('🚨 Using DEBUG BYPASS - returning mock payload');
    return {
      email: 'test@gmail.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg'
    };
  }
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    return payload;
  } catch (error) {
    console.error('Error verifying Google token:', error);
    throw new Error('Invalid token');
  }
};

// Check if user is authorized admin
const isAuthorizedAdmin = (email) => {
  console.log('🔍 Checking authorization for email:', email);
  
  // Option 1: Check authorized domain
  const authorizedDomains = ['scaler.com', 'interviewbit.com'];
  const domain = email.split('@')[1];
  
  console.log('📧 Email domain:', domain);
  console.log('✅ Authorized domains:', authorizedDomains);
  
  if (authorizedDomains.includes(domain)) {
    console.log('✅ User authorized via domain');
    return true;
  }
  
  // Option 2: Check against admin whitelist (you can add this to database)
  const adminWhitelist = [
    'admin@scaler.com',
    'support@scaler.com',
    'test@gmail.com', // Temporary debug email
    // Add more authorized emails as needed
  ];
  
  console.log('📋 Admin whitelist:', adminWhitelist);
  
  if (adminWhitelist.includes(email)) {
    console.log('✅ User authorized via whitelist');
    return true;
  }
  
  console.log('❌ User NOT authorized');
  return false;
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
      return res.status(401).json({ error: 'No authentication token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'scaler_support_jwt_secret_2024_production');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
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
  sessionConfig
};
