const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'newsreader.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT 'newspaper',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    article_count INTEGER NOT NULL,
    feed_count INTEGER NOT NULL,
    generated_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS summary_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    summary TEXT NOT NULL,
    article_count INTEGER NOT NULL,
    feed_count INTEGER NOT NULL,
    provider TEXT,
    sentiment_data TEXT,
    tags_data TEXT,
    date_key TEXT NOT NULL,
    generated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    feed_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    link TEXT NOT NULL,
    pub_date TEXT,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS llm_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    purpose TEXT NOT NULL,
    category_id INTEGER,
    latency_ms INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    date_posted TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    country TEXT DEFAULT '',
    work_type TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_filtered_jobs (
    job_id TEXT PRIMARY KEY,
    remote TEXT DEFAULT 'possible',
    filtered_at TEXT NOT NULL
  );

  -- Cognitive Resilience: "Mental Antibody" Dashboard
  CREATE TABLE IF NOT EXISTS cognitive_users (
    id TEXT PRIMARY KEY,
    rethinking_score INTEGER DEFAULT 0,
    primary_values TEXT DEFAULT '[]',
    inoculation_level INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS forensic_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    raw_text TEXT NOT NULL,
    fallacy_data TEXT NOT NULL DEFAULT '[]',
    bias_score REAL DEFAULT 0,
    emotional_intensity INTEGER DEFAULT 0,
    funnel_stage TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rethinking_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    topic TEXT NOT NULL,
    initial_confidence INTEGER DEFAULT 50,
    final_confidence INTEGER DEFAULT 50,
    shifting_evidence TEXT DEFAULT '',
    mode TEXT DEFAULT 'scientist',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inoculation_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    level TEXT NOT NULL DEFAULT 'trolling',
    score INTEGER DEFAULT 0,
    choices TEXT DEFAULT '[]',
    completed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bridge_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    sources TEXT NOT NULL DEFAULT '[]',
    siloing_score REAL DEFAULT 0,
    shared_values TEXT DEFAULT '[]',
    questions TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS study_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    headline TEXT NOT NULL,
    analysis_data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try { db.exec(`ALTER TABLE categories ADD COLUMN custom_prompt TEXT DEFAULT ''`); } catch (e) {}
try { db.exec(`ALTER TABLE categories ADD COLUMN language TEXT DEFAULT 'English'`); } catch (e) {}
try { db.exec(`ALTER TABLE articles ADD COLUMN topic_id TEXT DEFAULT ''`); } catch (e) {}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sh_cat_date ON summary_history(category_id, date_key);
  CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(category_id);
  CREATE INDEX IF NOT EXISTS idx_llm_date ON llm_usage(created_at);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
  CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(date_posted);
  CREATE INDEX IF NOT EXISTS idx_jobs_work_type ON jobs(work_type);
  CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles(topic_id);
  CREATE INDEX IF NOT EXISTS idx_articles_source_topic ON articles(feed_name, topic_id, pub_date);
  CREATE INDEX IF NOT EXISTS idx_forensic_user ON forensic_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_forensic_date ON forensic_history(created_at);
  CREATE INDEX IF NOT EXISTS idx_rethinking_user ON rethinking_journal(user_id);
  CREATE INDEX IF NOT EXISTS idx_inoculation_user ON inoculation_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_bridge_user ON bridge_audits(user_id);
  CREATE INDEX IF NOT EXISTS idx_study_user ON study_analyses(user_id);
  CREATE INDEX IF NOT EXISTS idx_study_date ON study_analyses(created_at);
`);
try { db.exec(`ALTER TABLE articles ADD COLUMN body_text TEXT DEFAULT ''`); } catch (e) {}

db.prepare("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('theme', 'classic')").run();

const count = db.prepare('SELECT COUNT(*) as c FROM categories').get();
if (count.c === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)');
  const insertFeed = db.prepare('INSERT INTO feeds (category_id, name, url) VALUES (?, ?, ?)');

  const seed = db.transaction(() => {
    insertCat.run('Technology', 'cpu', 0);
    insertCat.run('World News', 'globe', 1);
    insertCat.run('Science', 'flask-conical', 2);
    insertCat.run('Business', 'trending-up', 3);

    insertFeed.run(1, 'TechCrunch', 'https://techcrunch.com/feed/');
    insertFeed.run(1, 'Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index');
    insertFeed.run(2, 'Reuters World', 'https://feeds.reuters.com/Reuters/worldNews');
    insertFeed.run(2, 'BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml');
    insertFeed.run(3, 'Nature', 'https://www.nature.com/nature.rss');
    insertFeed.run(4, 'Bloomberg', 'https://feeds.bloomberg.com/markets/news.rss');
  });
  seed();
}

module.exports = db;
