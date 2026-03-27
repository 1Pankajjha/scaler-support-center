require('dotenv').config();
const { OpenAI } = require('openai');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { 
  verifyGoogleToken, 
  isAuthorizedAdmin, 
  generateSessionToken, 
  authenticateAdmin,
  sessionConfig 
} = require('./auth');

const app = express();
const port = process.env.PORT || 5001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5176',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session(sessionConfig));

// Initialize SQLite DB (in-memory or file)
const isVercel = process.env.VERCEL === '1';
const dbPath = isVercel ? '/tmp/scaler.db' : 'scaler.db';
const db = new Database(dbPath, { verbose: console.log });

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

// --- HEALTH CHECK API ---
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// --- PUBLIC ARTICLES (FAQs) API ---
// Only show published articles to public
app.get('/api/articles', (req, res) => {
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

// Google OAuth verification endpoint
app.post('/api/auth/google', async (req, res) => {
  console.log('🚀 Google auth endpoint hit');
  console.log('📥 Request body:', req.body);
  
  try {
    const { token } = req.body;
    
    if (!token) {
      console.log('❌ No token provided in request');
      return res.status(400).json({ error: 'No token provided' });
    }
    
    console.log('✅ Token received, length:', token.length);
    console.log('🔍 First 50 chars of token:', token.substring(0, 50) + '...');
    
    // Verify Google ID token
    console.log('🔐 Verifying Google token...');
    const payload = await verifyGoogleToken(token);
    console.log('✅ Token verified successfully');
    console.log('👤 User email:', payload.email);
    console.log('👤 User name:', payload.name);
    
    // Check if user is authorized
    console.log('🔍 Checking user authorization...');
    if (!isAuthorizedAdmin(payload.email)) {
      console.log('❌ User not authorized:', payload.email);
      
      // Log unauthorized attempt
      db.prepare('INSERT INTO admin_logs (email, action, ip_address) VALUES (?, ?, ?)')
        .run(payload.email, 'UNAUTHORIZED_ACCESS_ATTEMPT', req.ip);
      
      return res.status(403).json({ 
        error: 'Access denied. Please use an authorized account.' 
      });
    }
    
    console.log('✅ User authorized, creating session...');
    
    // Generate session token
    const sessionToken = generateSessionToken(payload);
    console.log('✅ Session token generated');
    
    // Set HTTP-only cookie
    console.log('🍪 Setting session cookie...');
    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Log successful login
    db.prepare('INSERT INTO admin_logs (email, action, ip_address) VALUES (?, ?, ?)')
      .run(payload.email, 'LOGIN_SUCCESS', req.ip);
    
    console.log('✅ Login successful for:', payload.email);
    
    res.json({
      success: true,
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      }
    });
    
  } catch (error) {
    console.error('❌ Google auth error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(401).json({ error: 'Authentication failed: ' + error.message });
  }
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

// --- PROTECTED ADMIN ROUTES ---

// Protect all admin routes
const adminRoutes = express.Router();
adminRoutes.use(authenticateAdmin);

// Admin insights
adminRoutes.get('/insights', (req, res) => {
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

// Admin Articles CRUD (all articles including drafts)
adminRoutes.get('/articles', (req, res) => {
  const articles = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all();
  res.json(articles);
});

adminRoutes.post('/articles', (req, res) => {
  const { title, content, category, status } = req.body;
  const stmt = db.prepare('INSERT INTO articles (title, content, category, status) VALUES (?, ?, ?, ?)');
  const info = stmt.run(title, content, category, status || 'draft');
  const newArticle = db.prepare('SELECT * FROM articles WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(newArticle);
});

adminRoutes.put('/articles/:id', (req, res) => {
  const { id } = req.params;
  const { title, content, category, status } = req.body;
  
  const stmt = db.prepare('UPDATE articles SET title = ?, content = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const info = stmt.run(title, content, category, status, id);
  
  if (info.changes === 0) return res.status(404).json({ error: 'Article not found' });
  const updatedArticle = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  res.json(updatedArticle);
});

adminRoutes.delete('/articles/:id', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM articles WHERE id = ?');
  const info = stmt.run(id);
  
  if (info.changes === 0) return res.status(404).json({ error: 'Article not found' });
  res.json({ message: 'Article deleted successfully' });
});

// Admin Popular Topics CRUD
adminRoutes.get('/popular-topics', (req, res) => {
  const topics = db.prepare('SELECT * FROM popular_topics ORDER BY order_index ASC').all();
  res.json(topics);
});

adminRoutes.post('/popular-topics', (req, res) => {
  const { label, link, link_type } = req.body;
  
  const maxOrder = db.prepare('SELECT MAX(order_index) as max_order FROM popular_topics').get();
  const nextOrder = (maxOrder.max_order || 0) + 1;
  
  const stmt = db.prepare('INSERT INTO popular_topics (label, link, link_type, order_index, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)');
  const info = stmt.run(label, link, link_type, nextOrder);
  
  const newTopic = db.prepare('SELECT * FROM popular_topics WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(newTopic);
});

adminRoutes.put('/popular-topics/:id', (req, res) => {
  const { id } = req.params;
  const { label, link, link_type } = req.body;
  
  const stmt = db.prepare('UPDATE popular_topics SET label = ?, link = ?, link_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const info = stmt.run(label, link, link_type, id);
  
  if (info.changes === 0) return res.status(404).json({ error: 'Popular topic not found' });
  const updatedTopic = db.prepare('SELECT * FROM popular_topics WHERE id = ?').get(id);
  res.json(updatedTopic);
});

adminRoutes.delete('/popular-topics/:id', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM popular_topics WHERE id = ?');
  const info = stmt.run(id);
  
  if (info.changes === 0) return res.status(404).json({ error: 'Popular topic not found' });
  res.json({ message: 'Popular topic deleted successfully' });
});

adminRoutes.put('/popular-topics/reorder', (req, res) => {
  const { topics } = req.body; // Array of { id, order_index }
  
  const updateStmt = db.prepare('UPDATE popular_topics SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  
  topics.forEach(({ id, order_index }) => {
    updateStmt.run(order_index, id);
  });
  
  const updatedTopics = db.prepare('SELECT * FROM popular_topics ORDER BY order_index ASC').all();
  res.json(updatedTopics);
});

// --- AUTHENTICATION ROUTES ---

// Google OAuth verification endpoint
app.post('/api/auth/google', async (req, res) => {
  console.log('🚀 Google auth endpoint hit');
  try {
    const { token } = req.body;
    const payload = await verifyGoogleToken(token);
    
    // Log successful login
    console.log('✅ Login successful:', payload.email);
    
    // Check if authorized admin
    if (!isAuthorizedAdmin(payload.email)) {
      return res.status(403).json({ error: 'Unauthorized - Admin access required' });
    }
    
    // Generate session token
    const sessionToken = generateSessionToken(payload);
    
    res.json({
      token: sessionToken,
      user: payload
    });
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Mount admin routes
app.use('/api/admin', adminRoutes);

// --- CHATBOT API ---
const openaiConfig = { apiKey: process.env.OPENAI_API_KEY };
let openai;
try { openai = new OpenAI(openaiConfig); } catch (e) { console.log('OpenAI key missing. Setup skipped temporarily.'); }

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_api_key_here') {
      console.log('Returning simulated GPT response (No API key found).');
      const mockReply = "Hello! I am a simulated Scaler AI assistant (your OpenAI API key is currently missing). \n\nI can see from the database that we offer support regarding Course Curriculum, EMI Payments, Mentorship sessions, and Engineering. \n\nIf you drop a real API Key into the `.env` file, I will instantly become a real GPT! How can I help you today?";
      return setTimeout(() => res.json({ reply: mockReply }), 1500);
    }

    // Embed current Live DB context into the chatbot's system prompt!
    const liveArticles = db.prepare("SELECT title, content, category FROM articles WHERE status = 'published'").all();
    const systemPrompt = `You are a helpful and polite support assistant for Scaler Academy.\nAnswer user questions based ONLY on the following official FAQ articles:\n\n${liveArticles.map(a => `Title: ${a.title}\nCategory: ${a.category}\n${a.content}`).join('\n\n')}\n\nIf the answer to their precise question is not natively contained in these articles, kindly inform the user that they should raise a ticket or contact escalations@scaler.com. Always write your response in markdown. Limit responses to a few paragraphs.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: 'Failed to generate contextual GPT response. Check API key permissions or Quota.' });
  }
});

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

// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
