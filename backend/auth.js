const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Lazy Initialize Supabase client
let supabase = null;
const getSupabase = () => {
  if (supabase) return supabase;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.warn('⚠️ Supabase configuration missing! Admin Auth will FAIL.');
    return null;
  }
  
  supabase = createClient(url, key);
  return supabase;
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
 * Middleware to protect admin routes using Supabase Session
 * This replaces the previous Google OAuth/Custom JWT flow.
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.sb_access_token;

    if (!token) {
      // Fallback for browser-based requests if using our custom cookie
      token = req.cookies?.admin_session;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token found.' });
    }

    // Verify token with Supabase
    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      return res.status(500).json({ error: 'Supabase auth service is not configured on the server.' });
    }
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      console.error('Supabase auth error:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    // Strict Domain Validation (Priority 1)
    if (!isAuthorizedAdmin(user.email)) {
      console.log('❌ Unauthorized domain:', user.email);
      return res.status(403).json({ error: 'Access denied. Only @scaler.com emails are allowed.' });
    }

    // Whitelist check (Optional but recommended by requirement)
    // If you want more strict control, you can uncomment this part to ONLY allow emails in the map
    /*
    if (!ADMIN_EMAILS[user.email]) {
       console.log('❌ User not in whitelist:', user.email);
       return res.status(403).json({ error: 'Access denied. Email not in whitelist.' });
    }
    */

    // Set user info for RBAC
    req.user = {
      email: user.email,
      id: user.id,
      role: ADMIN_EMAILS[user.email] || ROLES.SUPPORT // Default role mapping
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
