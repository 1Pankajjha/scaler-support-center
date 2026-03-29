const admin = require('firebase-admin');

// Lazy Initialize Firebase Admin client
let firebaseApp = null;
const getFirebaseAdmin = () => {
  if (firebaseApp) return firebaseApp;
  
  try {
    // Requires FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON stringified service account)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
    
    if (!serviceAccount.project_id) {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY missing or invalid! Admin Auth will FAIL.');
      return null;
    }
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return null;
  }
};

// Check if user is authorized admin
const isAuthorizedAdmin = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  const domain = email.split('@')[1];
  
  // STRICT: Only scaler.com domain allowed
  if (domain !== 'scaler.com') {
    console.log('❌ Access denied for domain:', domain);
    return false;
  }
  
  return true;
};

// Role Definitions
const ROLES = {
  ADMIN: 'admin',
  SUPPORT: 'support',
  VIEWER: 'viewer'
};

// Admin Email Role Mapping
const ADMIN_EMAILS = {
  'pankaj.jha@scaler.com': ROLES.ADMIN,
  'admin@scaler.com': ROLES.ADMIN,
  'support@scaler.com': ROLES.SUPPORT,
  'viewer@scaler.com': ROLES.VIEWER
};

/**
 * Middleware to protect admin routes using Firebase JWT Token
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.fb_access_token;

    if (!token) {
      // Fallback for browser-based requests if using our custom cookie
      token = req.cookies?.admin_session;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token found.' });
    }

    // Verify token with Firebase
    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) {
      return res.status(500).json({ error: 'Firebase Admin service is not configured on the server.' });
    }
    
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      console.error('Firebase token verification error:', err.message);
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    const userEmail = decodedToken.email;

    // Strict Domain Validation (Priority 1)
    if (!isAuthorizedAdmin(userEmail)) {
      console.log('❌ Unauthorized domain:', userEmail);
      return res.status(403).json({ error: 'Access denied. Only @scaler.com emails are allowed.' });
    }

    // Set user info for RBAC
    req.user = {
      email: userEmail,
      id: decodedToken.uid,
      role: ADMIN_EMAILS[userEmail] || ROLES.SUPPORT // Default role mapping
    };

    next();
  } catch (error) {
    console.error('Backend Auth Middleware Error:', error.message);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

// Middleware for Role-Based Access Control (RBAC)
const authorizeRole = (requiredRoles = []) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access denied. Role not found.' });
    }

    if (requiredRoles.length && !requiredRoles.includes(req.user.role)) {
      console.log(`❌ RBAC Violation: ${req.user.email} (Role: ${req.user.role}) attempted access to ${req.path}`);
      return res.status(403).json({ error: `Access denied. Higher permissions required.` });
    }

    next();
  };
};

// Audit Log Helper
const logAdminAction = (db, email, action, details = {}, ip = '0.0.0.0') => {
  try {
    const stmt = db.prepare('INSERT INTO admin_logs (email, action, timestamp, ip_address) VALUES (?, ?, CURRENT_TIMESTAMP, ?)');
    stmt.run(email, `${action}: ${JSON.stringify(details)}`, ip);
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};

module.exports = {
  isAuthorizedAdmin,
  authenticateAdmin,
  authorizeRole,
  logAdminAction,
  ROLES
};
