const { auth: auth0Middleware } = require('express-oauth2-jwt-bearer');

const checkJwt = (req, res, next) => {
  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_AUDIENCE) {
    console.warn('⚠️ AUTH0_DOMAIN or AUTH0_AUDIENCE missing! API Auth will FAIL unconditionally.');
    return res.status(500).json({ error: 'OAuth2 configuration missing on the server.' });
  }

  const jwtMiddleware = auth0Middleware({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  });
  
  jwtMiddleware(req, res, next);
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
 * Middleware to protect admin routes using Auth0 Access Token (JWT)
 */
const authenticateAdmin = (req, res, next) => {
  checkJwt(req, res, (err) => {
    if (err) {
      console.error('Auth0 token verification error:', err.message);
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    const payload = req.auth?.payload || {};
    
    // Auth0 access tokens don't include user email by default unless an Action is created.
    // We check standard claims and a custom scaler namespace claim.
    const userEmail = payload['https://scaler.com/email'] || payload.email || undefined;

    if (!userEmail) {
      console.warn(`⚠️ Token authorized for sub ${payload.sub}, but NO email claim found. RBAC functions may be limited.`);
    } else {
      // Strict Domain Validation (Priority 1)
      if (!isAuthorizedAdmin(userEmail)) {
        console.log('❌ Unauthorized domain:', userEmail);
        return res.status(403).json({ error: 'Access denied. Only @scaler.com emails are allowed.' });
      }
    }

    // Set user info for RBAC
    req.user = {
      email: userEmail || `Auth0User-${payload.sub}`,
      id: payload.sub,
      role: ADMIN_EMAILS[userEmail] || ROLES.SUPPORT // Default role mapping
    };

    next();
  });
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
