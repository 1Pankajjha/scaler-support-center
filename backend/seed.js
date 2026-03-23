const Database = require('better-sqlite3');
const db = new Database('scaler.db');

console.log('Resetting and seeding data...');

// To prevent conflicts with the previous table schema in dummy tests:
db.exec('DROP TABLE IF EXISTS articles;');

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
`);

const insertArticle = db.prepare('INSERT INTO articles (title, content, category, status) VALUES (?, ?, ?, ?)');

// Seed published articles
insertArticle.run('How do I request a 1-on-1 mentorship session?', 'You can request a session via your student dashboard under the Mentorship tab.', 'Mentorship', 'published');
insertArticle.run('What happens if I miss a live class?', 'Recordings are usually available within 24 hours in the Course Materials section.', 'Course & Curriculum', 'published');
insertArticle.run('How can I contact placements support?', 'Please email placements@scaler.com directly or raise a ticket here.', 'Placements', 'published');
insertArticle.run('Where can I download my completion certificate?', 'You can download it from the Certificates section once all curriculum metrics are met.', 'Certificates', 'published');
insertArticle.run('How do I handle EMI Payment issues?', 'Check your invoice statements inside your portal directly. We support all prominent banks.', 'Billing & Payments', 'published');
insertArticle.run('What happens if I forget my password?', 'You can trigger a reset link from the standard login page by clicking "Forgot Password".', 'Account & Login', 'published');

// Seed a draft article
insertArticle.run('Upcoming hackathon rules', 'The upcoming hackathon will be hosted next month. Detailed rules TBD.', 'Course & Curriculum', 'draft');

console.log('Seeding complete! Admin has pre-populated Articles table.');
