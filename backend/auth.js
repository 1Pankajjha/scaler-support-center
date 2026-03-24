const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const session = require('express-session');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware to verify Google ID token
const verifyGoogleToken = async (token) => {
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
  // Option 1: Check authorized domain
  const authorizedDomains = ['scaler.com', 'interviewbit.com'];
  const domain = email.split('@')[1];
  
  if (authorizedDomains.includes(domain)) {
    return true;
  }
  
  // Option 2: Check against admin whitelist (you can add this to database)
  const adminWhitelist = [
    'admin@scaler.com',
    'support@scaler.com',
    // Add more authorized emails as needed
  ];
  
  return adminWhitelist.includes(email);
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
    process.env.JWT_SECRET || 'your-secret-key',
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-session-secret',
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
