require('./utils/otel');
require('dotenv').config();
const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

// --- SENTRY INITIALIZATION (Must be at the very top) ---
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development'
  });
}

const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const rateLimit = require('express-rate-limit');
const { 
  isAuthorizedAdmin, 
  authenticateAdmin,
  authorizeRole,
  logAdminAction,
  ROLES
} = require('./auth');
const { logger, requestLogger } = require('./utils/logger');
const ConversationManager = require('./utils/conversationManager');

const app = express();
const port = process.env.PORT || 5001;

// The request handler is handled automatically by Sentry v8+ instrumentation
// Attach request logger for structured records 
app.use(requestLogger);

logger.info('SERVER_STARTING', { port, node_env: process.env.NODE_ENV || 'development' });

// --- SECURITY: RATE LIMITING (Priority 12) ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 login attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in an hour.' }
});

// Apply global rate limit to all /api routes
// --- HEALTH CHECK API (MOVED ABOVE RATE LIMITER) ---
app.get('/api/health', (req, res) => {
  try {
    // Perform a dummy DB operation to verify connection health
    const dbTest = db.prepare('SELECT 1').get();
    
    if (dbTest) {
      res.json({ 
        status: 'UP', 
        components: {
          database: { status: 'UP', engine: 'better-sqlite3' }
        },
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    }
  } catch (error) {
    logger.error('CRITICAL: Health check failure', { error: error.message });
    res.status(503).json({ 
      status: 'DOWN', 
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Explicit endpoint that Railway checks sometimes (public articles)
app.get('/api/articles/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Apply global rate limit to all /api routes AFTER health checks
app.use('/api/', apiLimiter);

// Initialize SQLite DB (in-memory or file) 
const isVercel = process.env.VERCEL === '1';
const dbPath = isVercel ? '/tmp/scaler.db' : 'scaler.db';
const db = new Database(dbPath);

// Logging for Auth0 Auth Check
console.log('--- Auth0 Configuration Check ---');
console.log('AUTH0_DOMAIN exists:', !!process.env.AUTH0_DOMAIN);
console.log('AUTH0_AUDIENCE exists:', !!process.env.AUTH0_AUDIENCE);
console.log('---------------------------');

app.use(cors({
  origin: true, // Allow frontends from Railway
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Robust session configuration (Step 4 & 9)
app.use(session({
  store: new SQLiteStore({
    db: dbPath,
    table: 'admin_sessions',
    dir: isVercel ? '/tmp' : '.',
  }),
  secret: process.env.SESSION_SECRET || 'scaler_support_session_secret_2024_production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax'
  }
}));

// Migrate to robust articles schema
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    issue_category TEXT,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS popular_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    link TEXT NOT NULL,
    link_type TEXT DEFAULT 'article',
    order_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    order_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT
  );

  -- Hybrid Support System Tables
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_conversations INTEGER DEFAULT 0,
    total_escalations INTEGER DEFAULT 0,
    csat_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT UNIQUE NOT NULL,
    user_id TEXT,
    status TEXT DEFAULT 'active', -- active, escalated, resolved, closed
    mode TEXT DEFAULT 'ai', -- ai, human, hybrid
    sentiment TEXT DEFAULT 'neutral', -- positive, neutral, negative
    issue_category TEXT,
    issue_summary TEXT,
    escalation_id TEXT,
    ticket_id TEXT,
    assigned_agent_id TEXT,
    csat_collected INTEGER DEFAULT 0,
    csat_score INTEGER,
    csat_feedback TEXT,
    resolution_time INTEGER, -- in minutes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    message_id TEXT UNIQUE NOT NULL,
    sender_type TEXT NOT NULL, -- user, ai, human_agent
    sender_id TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- text, file, system_notification
    intent_detected TEXT,
    sentiment_detected TEXT,
    confidence_score REAL,
    metadata TEXT, -- JSON for additional data
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
  );

  CREATE TABLE IF NOT EXISTS escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    escalation_id TEXT UNIQUE NOT NULL,
    conversation_id TEXT NOT NULL,
    user_id TEXT,
    escalation_reason TEXT,
    trigger_type TEXT, -- user_request, sentiment_negative, unresolved_attempts, explicit_escalation
    priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
    status TEXT DEFAULT 'pending', -- pending, assigned, resolved, cancelled
    assigned_agent_id TEXT,
    assigned_at DATETIME,
    resolved_at DATETIME,
    resolution_summary TEXT,
    context_package TEXT, -- JSON with full conversation context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

  CREATE TABLE IF NOT EXISTS callbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    callback_id TEXT UNIQUE NOT NULL,
    user_id TEXT,
    conversation_id TEXT,
    phone_number TEXT NOT NULL,
    preferred_time DATETIME,
    status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled, missed
    agent_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
  );

  CREATE TABLE IF NOT EXISTS csat_surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id TEXT UNIQUE NOT NULL,
    conversation_id TEXT NOT NULL,
    user_id TEXT,
    score INTEGER NOT NULL, -- 1-5 or thumbs up/down
    feedback TEXT,
    follow_up_requested INTEGER DEFAULT 0,
    agent_reviewed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

  CREATE TABLE IF NOT EXISTS ai_training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interaction_id TEXT UNIQUE NOT NULL,
    conversation_id TEXT NOT NULL,
    user_query TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    user_feedback TEXT, -- thumbs up/down, rating
    escalation_triggered INTEGER DEFAULT 0,
    admin_correction TEXT,
    marked_as_ideal INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
  );

  CREATE TABLE IF NOT EXISTS support_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'support_agent', -- support_agent, senior_agent, team_lead
    status TEXT DEFAULT 'available', -- available, busy, offline
    max_concurrent_chats INTEGER DEFAULT 5,
    current_chats INTEGER DEFAULT 0,
    skills TEXT, -- JSON array of specialties
    avg_response_time INTEGER, -- in seconds
    csat_average REAL,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS intent_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent TEXT NOT NULL,
    patterns TEXT NOT NULL, -- JSON array of regex patterns
    examples TEXT, -- JSON array of example phrases
    priority INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS escalation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL,
    conditions TEXT NOT NULL, -- JSON conditions
    actions TEXT NOT NULL, -- JSON actions
    priority INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed categories if empty
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (categoryCount.count === 0) {
  const seedCategories = [
    { title: 'Course Curriculum', description: 'Syllabus, lectures, and study materials', icon: 'BookOpen', order_index: 1 },
    { title: 'Payments & EMI', description: 'Fee payment, EMI options, refunds', icon: 'CreditCard', order_index: 2 },
    { title: 'Mentorship', description: 'Mentor sessions, doubts, guidance', icon: 'User', order_index: 3 },
    { title: 'Platform & Tech', description: 'Access issues, video playback, downloads', icon: 'Monitor', order_index: 4 },
    { title: 'Career & Placements', description: 'Job referrals, mock interviews, career support', icon: 'Briefcase', order_index: 5 }
  ];
  const insertCat = db.prepare('INSERT INTO categories (title, description, icon, order_index) VALUES (?, ?, ?, ?)');
  seedCategories.forEach(c => {
    insertCat.run(c.title, c.description, c.icon, c.order_index);
  });
}

// Seed intent patterns if empty
const intentCount = db.prepare('SELECT COUNT(*) as count FROM intent_patterns').get();
if (intentCount.count === 0) {
  const seedIntents = [
    {
      intent: 'refund',
      patterns: JSON.stringify(['refund', 'money back', 'return', 'chargeback', 'refund policy', 'get my money back']),
      examples: JSON.stringify(['I want a refund', 'How do I get my money back?', 'What is your refund policy?']),
      priority: 3
    },
    {
      intent: 'technical',
      patterns: JSON.stringify(['not working', 'broken', 'error', 'bug', 'issue', 'problem', 'login', 'access', 'video', 'download']),
      examples: JSON.stringify(['The video is not playing', 'I cannot login', 'Download is broken']),
      priority: 2
    },
    {
      intent: 'payment',
      patterns: JSON.stringify(['payment', 'emi', 'card', 'transaction', 'billing', 'invoice', 'fee', 'cost']),
      examples: JSON.stringify(['Payment failed', 'EMI issue', 'Card not working']),
      priority: 3
    },
    {
      intent: 'escalation',
      patterns: JSON.stringify(['talk to human', 'chat with dev', 'speak to agent', 'customer service', 'support team', 'help me']),
      examples: JSON.stringify(['I want to talk to a human', 'Connect me to support', 'Chat with dev']),
      priority: 5
    },
    {
      intent: 'general',
      patterns: JSON.stringify(['hello', 'hi', 'help', 'question', 'information', 'how to', 'what is']),
      examples: JSON.stringify(['Hello', 'How does this work?', 'I have a question']),
      priority: 1
    }
  ];
  
  const insertIntent = db.prepare('INSERT INTO intent_patterns (intent, patterns, examples, priority) VALUES (?, ?, ?, ?)');
  seedIntents.forEach(intent => {
    insertIntent.run(intent.intent, intent.patterns, intent.examples, intent.priority);
  });
}

// Seed escalation rules if empty
const escalationRulesCount = db.prepare('SELECT COUNT(*) as count FROM escalation_rules').get();
if (escalationRulesCount.count === 0) {
  const seedRules = [
    {
      rule_name: 'Negative Sentiment Escalation',
      conditions: JSON.stringify({ sentiment: 'negative', min_confidence: 0.7 }),
      actions: JSON.stringify({ escalate: true, priority: 'high', reason: 'Negative sentiment detected' }),
      priority: 4
    },
    {
      rule_name: 'Explicit Escalation Request',
      conditions: JSON.stringify({ intent: 'escalation', min_confidence: 0.8 }),
      actions: JSON.stringify({ escalate: true, priority: 'normal', reason: 'User requested human agent' }),
      priority: 5
    },
    {
      rule_name: 'Multiple Failed Attempts',
      conditions: JSON.stringify({ failed_attempts: 3, time_window: 300 }),
      actions: JSON.stringify({ escalate: true, priority: 'normal', reason: 'Multiple unresolved attempts' }),
      priority: 3
    },
    {
      rule_name: 'High Priority Issues',
      conditions: JSON.stringify({ intent: ['refund', 'payment'], sentiment: 'negative' }),
      actions: JSON.stringify({ escalate: true, priority: 'high', reason: 'High priority financial issue with negative sentiment' }),
      priority: 5
    }
  ];
  
  const insertRule = db.prepare('INSERT INTO escalation_rules (rule_name, conditions, actions, priority) VALUES (?, ?, ?, ?)');
  seedRules.forEach(rule => {
    insertRule.run(rule.rule_name, rule.conditions, rule.actions, rule.priority);
  });
}

// Seed support agents if empty
const agentsCount = db.prepare('SELECT COUNT(*) as count FROM support_agents').get();
if (agentsCount.count === 0) {
  const seedAgents = [
    {
      agent_id: 'agent_001',
      name: 'Sarah Johnson',
      email: 'sarah.j@scaler.com',
      role: 'senior_agent',
      skills: JSON.stringify(['technical', 'payments', 'curriculum']),
      max_concurrent_chats: 8
    },
    {
      agent_id: 'agent_002', 
      name: 'Mike Chen',
      email: 'mike.c@scaler.com',
      role: 'support_agent',
      skills: JSON.stringify(['general', 'mentorship', 'placements']),
      max_concurrent_chats: 5
    }
  ];
  
  const insertAgent = db.prepare('INSERT INTO support_agents (agent_id, name, email, role, skills, max_concurrent_chats) VALUES (?, ?, ?, ?, ?, ?)');
  seedAgents.forEach(agent => {
    insertAgent.run(agent.agent_id, agent.name, agent.email, agent.role, agent.skills, agent.max_concurrent_chats);
  });
}

// Initialize Conversation Manager
const conversationManager = new ConversationManager(db);

// --- BOOTSTRAP LOGGING: Article Inventory ---
const articleInventory = db.prepare('SELECT count(*) as count FROM articles').get();
const categoryInventory = db.prepare('SELECT count(*) as count FROM categories').get();
console.log('--- DATABASE INVENTORY ON STARTUP ---');
console.log(`ARTICLES: ${articleInventory.count}`);
console.log(`CATEGORIES: ${categoryInventory.count}`);
console.log('-------------------------------------');

// --- PUBLIC ARTICLES (FAQs) API ---
// Only show published articles to public
app.get('/api/articles', (req, res) => {
  console.log('Public articles hit at /api/articles');
  console.log('📘 Public articles hit at /api/articles');
  const articles = db.prepare("SELECT * FROM articles WHERE status = 'published' ORDER BY updated_at DESC").all();
  res.json(articles);
});

// --- CATEGORIES API ---
app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY order_index ASC').all();
  res.json(categories);
});

// --- POPULAR TOPICS API (Public) ---
app.get('/api/popular-topics', (req, res) => {
  let topics = db.prepare('SELECT * FROM popular_topics ORDER BY order_index ASC').all();
  
  // If no popular topics exist, insert default ones
  if (topics.length === 0) {
    const defaultTopics = [
      { label: 'How to pause my course?', link: '/course/pause', link_type: 'article', order_index: 1 },
      { label: 'Refund policy', link: '/billing/refund', link_type: 'article', order_index: 2 },
      { label: 'Certificate download issues', link: '/certificates/download', link_type: 'article', order_index: 3 },
      { label: 'Login problems', link: '/account/login', link_type: 'article', order_index: 4 }
    ];
    
    const insertStmt = db.prepare('INSERT INTO popular_topics (label, link, link_type, order_index) VALUES (?, ?, ?, ?)');
    defaultTopics.forEach(topic => {
      insertStmt.run(topic.label, topic.link, topic.link_type, topic.order_index);
    });
    
    // Fetch again after inserting defaults
    topics = db.prepare('SELECT * FROM popular_topics ORDER BY order_index ASC').all();
  }
  
  res.json(topics);
});

// --- TICKETS API ---
app.post('/api/tickets', (req, res) => {
  const { user_email, issue_category } = req.body;
  const stmt = db.prepare('INSERT INTO tickets (user_email, issue_category) VALUES (?, ?)');
  const info = stmt.run(user_email, issue_category);
  res.status(201).json({ id: info.lastInsertRowid, status: 'Ticket created successfully.' });
});

// --- AUTHENTICATION ROUTES ---

// Google OAuth verification endpoint (Priority 12: Rate Limited)
// Deprecated Google OAuth endpoint
app.post('/api/auth/google', (req, res) => {
  res.status(410).json({ error: 'Google OAuth is no longer supported. Please use the new Email login.' });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('admin_session');
  res.json({ success: true });
});

// Get current session
app.get('/api/auth/me', authenticateAdmin, (req, res) => {
  res.json({
    user: req.user
  });
});

// --- PROTECTED ADMIN ROUTES (Priority 1 & 3) ---

// Protect all admin routes
const adminRoutes = express.Router();
adminRoutes.use(authenticateAdmin);

// Admin insights (Available to all authenticated staff)
adminRoutes.get('/insights', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const totalCount = db.prepare("SELECT count(*) as count FROM tickets").get();
  const openCount = db.prepare("SELECT count(*) as count FROM tickets WHERE status = 'open'").get();
  const resolvedCount = db.prepare("SELECT count(*) as count FROM tickets WHERE status = 'resolved'").get();
  res.json({
    totalTickets: totalCount.count,
    openTickets: openCount.count,
    resolvedTickets: resolvedCount.count,
    olderThan12h: 0, 
    escalations: 0,
    detractors: 0
  });
});

// Admin Articles CRUD (RBAC Applied)
adminRoutes.get('/articles', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const articles = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all();
  res.json(articles);
});

adminRoutes.post('/articles', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { title, content, category, status } = req.body;
  const stmt = db.prepare('INSERT INTO articles (title, content, category, status) VALUES (?, ?, ?, ?)');
  const info = stmt.run(title, content, category, status || 'draft');
  
  // Audit Log (Priority 11)
  logAdminAction(db, req.user.email, 'CREATE_ARTICLE', { id: info.lastInsertRowid, title }, req.ip);
  
  const newArticle = db.prepare('SELECT * FROM articles WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(newArticle);
});

adminRoutes.put('/articles/:id', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { id } = req.params;
  const { title, content, category, status } = req.body;
  
  const stmt = db.prepare('UPDATE articles SET title = ?, content = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const info = stmt.run(title, content, category, status, id);
  
  if (info.changes === 0) return res.status(404).json({ error: 'Article not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'UPDATE_ARTICLE', { id, title }, req.ip);
  
  const updatedArticle = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  res.json(updatedArticle);
});

adminRoutes.delete('/articles/:id', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM articles WHERE id = ?');
  const info = stmt.run(id);
  
  if (info.changes === 0) return res.status(404).json({ error: 'Article not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'DELETE_ARTICLE', { id }, req.ip);
  
  res.json({ message: 'Article deleted successfully' });
});

// Admin Categories CRUD (RBAC Applied)
adminRoutes.post('/categories', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const normalizedTitle = title.trim();

  // Case-insensitive uniqueness check
  const existing = db.prepare('SELECT id FROM categories WHERE title = ? COLLATE NOCASE').get(normalizedTitle);
  if (existing) return res.status(409).json({ error: 'Category already exists' });

  // Get max order index
  const lastIndex = db.prepare('SELECT MAX(order_index) as max_idx FROM categories').get();
  const nextIndex = (lastIndex.max_idx || 0) + 1;

  const stmt = db.prepare('INSERT INTO categories (title, order_index) VALUES (?, ?)');
  const info = stmt.run(normalizedTitle, nextIndex);
  
  logAdminAction(db, req.user.email, 'CREATE_CATEGORY', { id: info.lastInsertRowid, title: normalizedTitle }, req.ip);
  const newCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(newCat);
});

adminRoutes.delete('/categories/:id', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { id } = req.params;
  const { reassignToTitle } = req.query; // e.g., ?reassignToTitle=General

  const categoryToDelete = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!categoryToDelete) return res.status(404).json({ error: 'Category not found' });

  // Check for linked articles using string match since articles.category is TEXT
  const linkedArticles = db.prepare('SELECT count(*) as count FROM articles WHERE category = ?').get(categoryToDelete.title);

  if (linkedArticles.count > 0) {
    if (!reassignToTitle) {
      return res.status(409).json({ error: 'This category has associated articles', count: linkedArticles.count });
    }
    // Reassign logic
    const updateStmt = db.prepare('UPDATE articles SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ?');
    updateStmt.run(reassignToTitle, categoryToDelete.title);
    logAdminAction(db, req.user.email, 'REASSIGN_ARTICLES', { from: categoryToDelete.title, to: reassignToTitle, count: linkedArticles.count }, req.ip);
  }

  const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
  stmt.run(id);
  
  logAdminAction(db, req.user.email, 'DELETE_CATEGORY', { id, title: categoryToDelete.title }, req.ip);
  res.json({ message: 'Category deleted successfully' });
});

// Admin Popular Topics CRUD (RBAC Applied)
adminRoutes.get('/popular-topics', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const topics = db.prepare('SELECT * FROM popular_topics ORDER BY order_index ASC').all();
  res.json(topics);
});

adminRoutes.post('/popular-topics', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { label, link, link_type } = req.body;
  
  const maxOrder = db.prepare('SELECT MAX(order_index) as max_order FROM popular_topics').get();
  const nextOrder = (maxOrder.max_order || 0) + 1;
  
  const stmt = db.prepare('INSERT INTO popular_topics (label, link, link_type, order_index, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)');
  const info = stmt.run(label, link, link_type, nextOrder);
  
  // Audit Log
  logAdminAction(db, req.user.email, 'CREATE_TOPIC', { id: info.lastInsertRowid, label }, req.ip);
  
  const newTopic = db.prepare('SELECT * FROM popular_topics WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(newTopic);
});

adminRoutes.put('/popular-topics/:id', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { id } = req.params;
  const { label, link, link_type } = req.body;
  
  const stmt = db.prepare('UPDATE popular_topics SET label = ?, link = ?, link_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const info = stmt.run(label, link, link_type, id);
  
  if (info.changes === 0) return res.status(404).json({ error: 'Popular topic not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'UPDATE_TOPIC', { id, label }, req.ip);
  
  const updatedTopic = db.prepare('SELECT * FROM popular_topics WHERE id = ?').get(id);
  res.json(updatedTopic);
});

adminRoutes.delete('/popular-topics/:id', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM popular_topics WHERE id = ?');
  const info = stmt.run(id);
  
  if (info.changes === 0) return res.status(404).json({ error: 'Popular topic not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'DELETE_TOPIC', { id }, req.ip);
  
  res.json({ message: 'Popular topic deleted successfully' });
});

adminRoutes.put('/popular-topics/reorder', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { topics } = req.body; // Array of { id, order_index }
  
  const updateStmt = db.prepare('UPDATE popular_topics SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  
  topics.forEach(({ id, order_index }) => {
    updateStmt.run(order_index, id);
  });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'REORDER_TOPICS', { count: topics.length }, req.ip);
  
  const updatedTopics = db.prepare('SELECT * FROM popular_topics ORDER BY order_index ASC').all();
  res.json(updatedTopics);
});

// --- HYBRID SUPPORT ADMIN APIS ---

// Get escalations
adminRoutes.get('/escalations', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const { status, limit = 50 } = req.query;
  
  let query = 'SELECT * FROM escalations';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const escalations = db.prepare(query).all(...params);
  
  // Parse context packages
  const escalationsWithDetails = escalations.map(esc => ({
    ...esc,
    context_package: JSON.parse(esc.context_package || '{}')
  }));
  
  res.json(escalationsWithDetails);
});

// Assign escalation to agent
adminRoutes.put('/escalations/:id/assign', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT]), (req, res) => {
  const { id } = req.params;
  const { agentId } = req.body;
  
  const escalation = db.prepare('SELECT * FROM escalations WHERE id = ?').get(id);
  if (!escalation) return res.status(404).json({ error: 'Escalation not found' });
  
  // Update escalation
  const stmt = db.prepare(`
    UPDATE escalations 
    SET assigned_agent_id = ?, status = 'assigned', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const info = stmt.run(agentId, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Escalation not found' });
  
  // Update conversation
  db.prepare(`
    UPDATE conversations 
    SET assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE escalation_id = ?
  `).run(agentId, escalation.escalation_id);
  
  // Update agent load
  db.prepare(`
    UPDATE support_agents 
    SET current_chats = current_chats + 1, status = 'busy', last_active = CURRENT_TIMESTAMP 
    WHERE agent_id = ?
  `).run(agentId);
  
  // Audit Log
  logAdminAction(db, req.user.email, 'ASSIGN_ESCALATION', { escalationId: id, agentId }, req.ip);
  
  res.json({ message: 'Escalation assigned successfully' });
});

// Resolve escalation
adminRoutes.put('/escalations/:id/resolve', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT]), (req, res) => {
  const { id } = req.params;
  const { resolutionSummary } = req.body;
  
  const escalation = db.prepare('SELECT * FROM escalations WHERE id = ?').get(id);
  if (!escalation) return res.status(404).json({ error: 'Escalation not found' });
  
  // Update escalation
  const stmt = db.prepare(`
    UPDATE escalations 
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolution_summary = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const info = stmt.run(resolutionSummary, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Escalation not found' });
  
  // Update conversation
  db.prepare(`
    UPDATE conversations 
    SET status = 'resolved', updated_at = CURRENT_TIMESTAMP 
    WHERE escalation_id = ?
  `).run(escalation.escalation_id);
  
  // Update agent load
  if (escalation.assigned_agent_id) {
    db.prepare(`
      UPDATE support_agents 
      SET current_chats = current_chats - 1, 
      status = CASE WHEN current_chats - 1 = 0 THEN 'available' ELSE 'busy' END,
      last_active = CURRENT_TIMESTAMP
      WHERE agent_id = ?
    `).run(escalation.assigned_agent_id);
  }
  
  // Audit Log
  logAdminAction(db, req.user.email, 'RESOLVE_ESCALATION', { escalationId: id }, req.ip);
  
  res.json({ message: 'Escalation resolved successfully' });
});

// Get support agents
adminRoutes.get('/agents', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const agents = db.prepare('SELECT * FROM support_agents ORDER BY csat_average DESC').all();
  
  const agentsWithDetails = agents.map(agent => ({
    ...agent,
    skills: JSON.parse(agent.skills || '[]')
  }));
  
  res.json(agentsWithDetails);
});

// Update agent status
adminRoutes.put('/agents/:agentId/status', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { agentId } = req.params;
  const { status } = req.body;
  
  const stmt = db.prepare(`
    UPDATE support_agents 
    SET status = ?, last_active = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
    WHERE agent_id = ?
  `);
  
  const info = stmt.run(status, agentId);
  if (info.changes === 0) return res.status(404).json({ error: 'Agent not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'UPDATE_AGENT_STATUS', { agentId, status }, req.ip);
  
  res.json({ message: 'Agent status updated successfully' });
});

// Get AI training data
adminRoutes.get('/training-data', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT]), (req, res) => {
  const { limit = 100, escalationOnly, needsReview } = req.query;
  
  let query = 'SELECT * FROM ai_training_data';
  const params = [];
  
  if (escalationOnly === 'true') {
    query += ' WHERE escalation_triggered = TRUE';
  }
  
  if (needsReview === 'true') {
    query += escalationOnly === 'true' ? ' AND (admin_correction IS NULL OR marked_as_ideal = FALSE)' : ' WHERE (admin_correction IS NULL OR marked_as_ideal = FALSE)';
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const trainingData = db.prepare(query).all(...params);
  res.json(trainingData);
});

// Update AI training data
adminRoutes.put('/training-data/:id', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { id } = req.params;
  const { adminCorrection, markedAsIdeal } = req.body;
  
  const stmt = db.prepare(`
    UPDATE ai_training_data 
    SET admin_correction = ?, marked_as_ideal = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const info = stmt.run(adminCorrection, markedAsIdeal, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Training data not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'UPDATE_TRAINING_DATA', { id, adminCorrection, markedAsIdeal }, req.ip);
  
  res.json({ message: 'Training data updated successfully' });
});

// Get conversation analytics
adminRoutes.get('/analytics/conversations', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const { period = '7d' } = req.query;
  
  let timeFilter = "created_at >= datetime('now', '-7 days')";
  if (period === '30d') timeFilter = "created_at >= datetime('now', '-30 days')";
  if (period === '1d') timeFilter = "created_at >= datetime('now', '-1 day')";
  
  const analytics = {
    totalConversations: db.prepare(`SELECT COUNT(*) as count FROM conversations WHERE ${timeFilter}`).get().count,
    escalatedConversations: db.prepare(`SELECT COUNT(*) as count FROM conversations WHERE ${timeFilter} AND status = 'escalated'`).get().count,
    resolvedConversations: db.prepare(`SELECT COUNT(*) as count FROM conversations WHERE ${timeFilter} AND status = 'resolved'`).get().count,
    averageResolutionTime: db.prepare(`SELECT AVG(resolution_time) as avg_time FROM conversations WHERE ${timeFilter} AND resolution_time IS NOT NULL`).get().avg_time,
    sentimentDistribution: db.prepare(`
      SELECT sentiment, COUNT(*) as count FROM conversations 
      WHERE ${timeFilter} 
      GROUP BY sentiment
    `).all(),
    intentDistribution: db.prepare(`
      SELECT intent_detected as intent, COUNT(*) as count FROM messages 
      WHERE ${timeFilter} AND sender_type = 'user' AND intent_detected IS NOT NULL 
      GROUP BY intent_detected
    `).all()
  };
  
  res.json(analytics);
});

// Get CSAT analytics
adminRoutes.get('/analytics/csat', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const { period = '7d' } = req.query;
  
  let timeFilter = "created_at >= datetime('now', '-7 days')";
  if (period === '30d') timeFilter = "created_at >= datetime('now', '-30 days')";
  if (period === '1d') timeFilter = "created_at >= datetime('now', '-1 day')";
  
  const analytics = {
    totalSurveys: db.prepare(`SELECT COUNT(*) as count FROM csat_surveys WHERE ${timeFilter}`).get().count,
    averageScore: db.prepare(`SELECT AVG(score) as avg_score FROM csat_surveys WHERE ${timeFilter}`).get().avg_score,
    scoreDistribution: db.prepare(`
      SELECT score, COUNT(*) as count FROM csat_surveys 
      WHERE ${timeFilter} 
      GROUP BY score
      ORDER BY score
    `).all(),
    followUpRequests: db.prepare(`SELECT COUNT(*) as count FROM csat_surveys WHERE ${timeFilter} AND follow_up_requested = TRUE`).get().count,
    recentFeedback: db.prepare(`
      SELECT score, feedback, created_at FROM csat_surveys 
      WHERE ${timeFilter} AND feedback IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all()
  };
  
  res.json(analytics);
});

// Get callbacks
adminRoutes.get('/callbacks', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT]), (req, res) => {
  const { status, limit = 50 } = req.query;
  
  let query = 'SELECT * FROM callbacks';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const callbacks = db.prepare(query).all(...params);
  res.json(callbacks);
});

// Update callback status
adminRoutes.put('/callbacks/:id/status', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT]), (req, res) => {
  const { id } = req.params;
  const { status, agentId, notes } = req.body;
  
  const stmt = db.prepare(`
    UPDATE callbacks 
    SET status = ?, agent_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const info = stmt.run(status, agentId, notes, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Callback not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'UPDATE_CALLBACK', { callbackId: id, status }, req.ip);
  
  res.json({ message: 'Callback updated successfully' });
});

// Get intent patterns
adminRoutes.get('/intent-patterns', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const patterns = db.prepare('SELECT * FROM intent_patterns ORDER BY priority DESC').all();
  
  const patternsWithDetails = patterns.map(pattern => ({
    ...pattern,
    patterns: JSON.parse(pattern.patterns),
    examples: JSON.parse(pattern.examples || '[]')
  }));
  
  res.json(patternsWithDetails);
});

// Update intent pattern
adminRoutes.put('/intent-patterns/:id', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { id } = req.params;
  const { intent, patterns, examples, priority, isActive } = req.body;
  
  const stmt = db.prepare(`
    UPDATE intent_patterns 
    SET intent = ?, patterns = ?, examples = ?, priority = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const info = stmt.run(intent, JSON.stringify(patterns), JSON.stringify(examples), priority, isActive, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Intent pattern not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'UPDATE_INTENT_PATTERN', { id, intent }, req.ip);
  
  res.json({ message: 'Intent pattern updated successfully' });
});

// Get escalation rules
adminRoutes.get('/escalation-rules', authorizeRole([ROLES.ADMIN, ROLES.SUPPORT, ROLES.VIEWER]), (req, res) => {
  const rules = db.prepare('SELECT * FROM escalation_rules ORDER BY priority DESC').all();
  
  const rulesWithDetails = rules.map(rule => ({
    ...rule,
    conditions: JSON.parse(rule.conditions),
    actions: JSON.parse(rule.actions)
  }));
  
  res.json(rulesWithDetails);
});

// Update escalation rule
adminRoutes.put('/escalation-rules/:id', authorizeRole([ROLES.ADMIN]), (req, res) => {
  const { id } = req.params;
  const { ruleName, conditions, actions, priority, isActive } = req.body;
  
  const stmt = db.prepare(`
    UPDATE escalation_rules 
    SET rule_name = ?, conditions = ?, actions = ?, priority = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const info = stmt.run(ruleName, JSON.stringify(conditions), JSON.stringify(actions), priority, isActive, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Escalation rule not found' });
  
  // Audit Log
  logAdminAction(db, req.user.email, 'UPDATE_ESCALATION_RULE', { id, ruleName }, req.ip);
  
  res.json({ message: 'Escalation rule updated successfully' });
});

// Mount admin routes
app.use('/api/admin', adminRoutes);

// --- HYBRID CHATBOT API ---
const openaiConfig = { apiKey: process.env.OPENAI_API_KEY };
let openai;
try { openai = new OpenAI(openaiConfig); } catch (e) { console.log('OpenAI key missing. Setup skipped temporarily.'); }

// Gemini AI Configuration
const geminiConfig = { apiKey: process.env.GEMINI_API_KEY };
let gemini;
try { gemini = new GoogleGenerativeAI(geminiConfig.apiKey); } catch (e) { console.log('Gemini key missing. Setup skipped temporarily.'); }

// Start or continue conversation
app.post('/api/chat/start', async (req, res) => {
  try {
    const { message, userEmail, userName, userPhone, conversationId } = req.body;
    
    // Get or create user
    const user = conversationManager.getOrCreateUser(userEmail, userName, userPhone);
    
    let conversation;
    if (conversationId) {
      conversation = conversationManager.getConversation(conversationId);
      if (!conversation) {
        conversation = conversationManager.createConversation(user.user_id, message);
      }
    } else {
      conversation = conversationManager.createConversation(user.user_id, message);
    }
    
    // Add user message
    const userMessage = conversationManager.addMessage(
      conversation.conversation_id,
      'user',
      message,
      user.user_id
    );
    
    // Generate AI response
    let aiResponse = await generateAIResponse(message, conversation.conversation_id);
    
    // Temporarily disable escalation check entirely
    // const escalationCheck = conversationManager.checkEscalationNeed(
    //   conversation.conversation_id,
    //   message
    // );
    
    let escalationResult = null;
    let finalResponse = aiResponse;
    
    // Temporarily disable escalation to test basic functionality
    // if (escalationCheck.shouldEscalate) {
    //   escalationResult = conversationManager.createEscalation(
    //     conversation.conversation_id,
    //     escalationCheck.reason,
    //     escalationCheck.priority || 'normal',
    //     'automatic'
    //   );
      
    //   const agentName = escalationResult.assignedAgent ? escalationResult.assignedAgent.name : null;
    //   finalResponse = `I understand this requires human assistance. I'm connecting you to a support specialist now. ${agentName ? `You'll be assisted by ${agentName}.` : 'An agent will be with you shortly.'}`;
    // }
    
    // Add AI response
    const aiMessage = conversationManager.addMessage(
      conversation.conversation_id,
      'ai',
      finalResponse,
      'ai_system'
    );
    
    // Store training data
    conversationManager.storeAITrainingData(
      conversation.conversation_id,
      message,
      finalResponse,
      null,
      escalationResult ? 1 : 0
    );
    
    res.json({
      conversationId: conversation.conversation_id,
      userId: user.user_id,
      reply: finalResponse,
      escalation: escalationResult,
      sentiment: userMessage.sentiment_detected,
      intent: userMessage.intent_detected,
      mode: conversation.mode
    });
    
  } catch (error) {
    console.error('Chat start error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// Continue existing conversation
app.post('/api/chat/continue', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    const conversation = conversationManager.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Add user message
    const userMessage = conversationManager.addMessage(
      conversationId,
      'user',
      message,
      conversation.user_id
    );
    
    let response;
    
    // If conversation is escalated, forward to human agent
    if (conversation.status === 'escalated') {
      response = "Your message has been forwarded to the support agent. They'll respond shortly.";
      
      // Add system message
      conversationManager.addMessage(
        conversationId,
        'ai',
        response,
        'ai_system',
        'system_notification'
      );
    } else {
      // Generate AI response
      response = await generateAIResponse(message, conversationId);
      
      // Add AI response
      conversationManager.addMessage(
        conversationId,
        'ai',
        response,
        'ai_system'
      );
      
      // Store training data
      conversationManager.storeAITrainingData(
        conversationId,
        message,
        response,
        null,
        false
      );
      
      // Check for escalation
      const escalationCheck = conversationManager.checkEscalationNeed(
        conversationId,
        message
      );
      
      // Temporarily disable escalation in continue endpoint as well
      // if (escalationCheck.shouldEscalate) {
      //   const escalationData = conversationManager.createEscalation(
      //     conversationId,
      //     escalationCheck.reason,
      //     escalationCheck.priority || 'normal',
      //     'automatic'
      //   );
        
      //   response = `I understand this requires human assistance. I'm connecting you to a support specialist now. ${escalationData.assignedAgent ? `You'll be assisted by ${escalationData.assignedAgent.name}.` : 'An agent will be with you shortly.'}`;
        
      //   // Update with escalation info
      //   conversationManager.addMessage(
      //     conversationId,
      //     'ai',
      //     response,
      //     'ai_system',
      //     'system_notification'
      //   );
      // }
    }
    
    res.json({
      reply: response,
      sentiment: userMessage.sentiment_detected,
      intent: userMessage.intent_detected,
      mode: conversation.mode,
      status: conversation.status
    });
    
  } catch (error) {
    console.error('Chat continue error:', error);
    res.status(500).json({ error: 'Failed to continue conversation' });
  }
});

// Request escalation
app.post('/api/chat/escalate', async (req, res) => {
  try {
    const { conversationId, reason } = req.body;
    
    const conversation = conversationManager.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Temporarily disable manual escalation endpoint
    // const escalationData = conversationManager.createEscalation(
    //   conversationId,
    //   reason || 'User requested escalation',
    //   'normal',
    //   'user_request'
    // );
    
    res.json({
      message: 'Escalation temporarily disabled for testing'
    });
    
  } catch (error) {
    console.error('Escalation error:', error);
    res.status(500).json({ error: 'Failed to escalate conversation' });
  }
});

// Request callback
app.post('/api/chat/callback', async (req, res) => {
  try {
    const { conversationId, phoneNumber, preferredTime, notes } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const callback = conversationManager.createCallback(
      conversationId,
      phoneNumber,
      preferredTime,
      notes
    );
    
    res.json({
      callbackId: callback.callback_id,
      message: `Thank you! We'll call you at ${phoneNumber}${preferredTime ? ` around ${preferredTime}` : 'as soon as possible'}.`
    });
    
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Failed to schedule callback' });
  }
});

// Submit CSAT
app.post('/api/chat/csat', async (req, res) => {
  try {
    const { conversationId, score, feedback, followUpRequested } = req.body;
    
    if (!conversationId || score === undefined) {
      return res.status(400).json({ error: 'Conversation ID and score are required' });
    }
    
    const survey = conversationManager.submitCSAT(
      conversationId,
      score,
      feedback,
      followUpRequested
    );
    
    // End conversation
    conversationManager.endConversation(conversationId, 'resolved');
    
    res.json({
      message: score >= 4 
        ? 'Thank you for your feedback! We\'re glad we could help.'
        : 'Thank you for your feedback. We\'ll use this to improve our service.',
      followUp: followUpRequested 
        ? 'We\'ll contact you soon to follow up on your experience.'
        : null
    });
    
  } catch (error) {
    console.error('CSAT error:', error);
    res.status(500).json({ error: 'Failed to submit CSAT' });
  }
});

// Get conversation history
app.get('/api/chat/history/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const conversations = conversationManager.getUserConversations(userId, 10);
    
    const conversationsWithSummary = conversations.map(conv => ({
      ...conv,
      messageCount: conv.messages ? conv.messages.length : 0,
      summary: conversationManager.intelligence.generateSummary(conv.conversation_id)
    }));
    
    res.json(conversationsWithSummary);
    
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

// Get conversation details
app.get('/api/chat/conversation/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = conversationManager.getConversation(conversationId, true);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
    
  } catch (error) {
    console.error('Conversation details error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
});

// AI response generation helper
async function generateAIResponse(message, conversationId) {
  try {
    // Check for Gemini API key first
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      // Get conversation context
      const conversation = conversationManager.getConversation(conversationId, true);
      const recentMessages = conversation.messages.slice(-5); // Last 5 messages for context
      
      // Embed current Live DB context into the chatbot's system prompt!
      const liveArticles = db.prepare("SELECT title, content, category FROM articles WHERE status = 'published'").all();
      const systemPrompt = `You are a helpful and polite support assistant for Scaler Academy.
Answer user questions based ONLY on the following official FAQ articles:

${liveArticles.map(a => `Title: ${a.title}\nCategory: ${a.category}\n${a.content}`).join('\n\n')}

If the answer to their precise question is not natively contained in these articles, kindly inform the user that they should raise a ticket or contact escalations@scaler.com. Always write your response in markdown. Limit responses to a few paragraphs.

Recent conversation context:
${recentMessages.map(m => `${m.sender_type}: ${m.content}`).join('\n')}`;
      
      const prompt = `${systemPrompt}\n\nCurrent user message: ${message}`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    }
    
    // Fallback to OpenAI if Gemini is not available
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_api_key_here') {
      console.log('Returning simulated response (No API key found for Gemini or OpenAI).');
      return "Hello! I am a simulated Scaler AI assistant (your Gemini/OpenAI API key is currently missing). \n\nI can see from the database that we offer support regarding Course Curriculum, EMI Payments, Mentorship sessions, and Engineering. \n\nIf you drop a real API Key into the `.env` file, I will instantly become a real AI assistant! How can I help you today?";
    }

    // Use OpenAI as fallback
    const conversation = conversationManager.getConversation(conversationId, true);
    const recentMessages = conversation.messages.slice(-5);
    
    const liveArticles = db.prepare("SELECT title, content, category FROM articles WHERE status = 'published'").all();
    const systemPrompt = `You are a helpful and polite support assistant for Scaler Academy.
Answer user questions based ONLY on the following official FAQ articles:

${liveArticles.map(a => `Title: ${a.title}\nCategory: ${a.category}\n${a.content}`).join('\n\n')}

If the answer to their precise question is not natively contained in these articles, kindly inform the user that they should raise a ticket or contact escalations@scaler.com. Always write your response in markdown. Limit responses to a few paragraphs.

Recent conversation context:
${recentMessages.map(m => `${m.sender_type}: ${m.content}`).join('\n')}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('AI API Error:', error);
    return "I'm having trouble connecting to my AI services right now. Please try again in a moment or contact support if the issue persists.";
  }
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  // Admin routes - serve React app
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
  
  // Catch all other routes - serve React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// The error handler must be before any other error middleware and after all controllers
// Sentry v8+ Express integration:
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.listen(port, '0.0.0.0', () => {
  logger.info(`SERVER_READY`, { port, mode: process.env.NODE_ENV || 'development' });
});
