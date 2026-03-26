require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const RSSParser = require('rss-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['media:group', 'media:group'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'content:encoded'],
    ],
  },
});

app.use(cors());
app.use(express.json());

// ========== Helpers ==========

function extractImage(item) {
  let image = '';

  // 1. enclosure (common in RSS 2.0)
  if (item.enclosure?.url) {
    const encType = item.enclosure?.type || '';
    if (encType.startsWith('image/') || !encType) image = item.enclosure.url;
  }

  // 2. media:content (array from customFields)
  if (!image && item['media:content']) {
    const mcArr = Array.isArray(item['media:content']) ? item['media:content'] : [item['media:content']];
    for (const mc of mcArr) {
      const url = mc?.$?.url || mc?.url || mc?.$ && mc.$.url || '';
      if (url) { image = url; break; }
    }
  }

  // 3. media:thumbnail
  if (!image && item['media:thumbnail']) {
    const mtArr = Array.isArray(item['media:thumbnail']) ? item['media:thumbnail'] : [item['media:thumbnail']];
    for (const mt of mtArr) {
      const url = mt?.$?.url || mt?.url || '';
      if (url) { image = url; break; }
    }
  }

  // 4. media:group → media:content
  if (!image && item['media:group']) {
    const group = item['media:group'];
    const mc = group?.['media:content'] || group?.['media:thumbnail'];
    if (mc) {
      const arr = Array.isArray(mc) ? mc : [mc];
      for (const m of arr) {
        const url = m?.$?.url || m?.url || '';
        if (url) { image = url; break; }
      }
    }
  }

  // 5. itunes:image
  if (!image && item['itunes:image']) {
    const itunes = Array.isArray(item['itunes:image']) ? item['itunes:image'][0] : item['itunes:image'];
    image = itunes?.href || itunes?.$?.href || '';
  }

  // 6. content:encoded HTML
  if (!image && item['content:encoded']) {
    const imgMatch = String(item['content:encoded']).match(/<img[^>]+src=["']([^"'>]+)["']/);
    if (imgMatch) image = imgMatch[1];
  }

  // 7. content HTML (rss-parser puts it here)
  if (!image && item.content) {
    const imgMatch = String(item.content).match(/<img[^>]+src=["']([^"'>]+)["']/);
    if (imgMatch) image = imgMatch[1];
  }

  // 8. description HTML fallback
  if (!image && item.description) {
    const imgMatch = String(item.description).match(/<img[^>]+src=["']([^"'>]+)["']/);
    if (imgMatch) image = imgMatch[1];
  }

  return image;
}

// ========== Database Setup ==========

const db = new Database(path.join(__dirname, 'newsreader.db'));
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
`);

// Indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sh_cat_date ON summary_history(category_id, date_key);
  CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(category_id);
  CREATE INDEX IF NOT EXISTS idx_llm_date ON llm_usage(created_at);
`);

// Migrations
try { db.exec(`ALTER TABLE categories ADD COLUMN custom_prompt TEXT DEFAULT ''`); } catch (e) {}
try { db.exec(`ALTER TABLE categories ADD COLUMN language TEXT DEFAULT 'English'`); } catch (e) {}

// Default settings
db.prepare("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('theme', 'classic')").run();

// Seed some example categories if empty
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

// ========== LLM Helper ==========

const AI_PROVIDERS = [
  { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
];

// In-memory store for latest rate limit info per provider
const providerQuotas = {};

async function callLLM(messages, { purpose = 'unknown', categoryId = null, temperature = 0.3 } = {}) {
  const providers = AI_PROVIDERS.filter(p => p.key());
  if (providers.length === 0) throw new Error('No AI API keys configured. Set GROQ_API_KEY in .env');

  let lastError = null;
  for (const provider of providers) {
    try {
      const start = Date.now();
      console.log(`[LLM] Trying ${provider.name} (${provider.model}) for ${purpose}...`);
      
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key()}` },
        body: JSON.stringify({ model: provider.model, messages, temperature }),
      });

      // Capture rate limit headers from ALL responses (even failed ones)
      const parseHeader = (name) => {
        const v = response.headers.get(name);
        return v !== null && v !== undefined ? parseInt(v, 10) : null;
      };
      // Log all rate-limit headers for debugging
      const rlHeaders = {};
      response.headers.forEach((value, key) => {
        if (key.toLowerCase().includes('ratelimit') || key.toLowerCase().includes('rate-limit')) {
          rlHeaders[key] = value;
        }
      });
      if (Object.keys(rlHeaders).length > 0) {
        console.log(`[LLM] ${provider.name} rate-limit headers:`, rlHeaders);
      }
      const quota = {
        provider: provider.name,
        model: provider.model,
        limit_tokens: parseHeader('x-ratelimit-limit-tokens'),
        remaining_tokens: parseHeader('x-ratelimit-remaining-tokens'),
        limit_requests: parseHeader('x-ratelimit-limit-requests'),
        remaining_requests: parseHeader('x-ratelimit-remaining-requests'),
        reset_tokens: response.headers.get('x-ratelimit-reset-tokens') || null,
        reset_requests: response.headers.get('x-ratelimit-reset-requests') || null,
        updated_at: new Date().toISOString(),
      };
      // Store if we got any rate limit data at all
      if (quota.limit_tokens !== null || quota.limit_requests !== null ||
          quota.remaining_tokens !== null || quota.remaining_requests !== null) {
        providerQuotas[provider.name] = quota;
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`[LLM] ${provider.name} failed (${response.status})`);
        lastError = `${provider.name} API returned ${response.status}: ${errBody}`;
        continue;
      }
      const data = await response.json();
      const latency = Date.now() - start;
      const usage = data.usage || {};

      // Track usage in DB
      db.prepare('INSERT INTO llm_usage (provider, model, prompt_tokens, completion_tokens, total_tokens, purpose, category_id, latency_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
        provider.name, provider.model, usage.prompt_tokens || 0, usage.completion_tokens || 0, usage.total_tokens || 0,
        purpose, categoryId, latency, new Date().toISOString()
      );

      console.log(`[LLM] Success: ${provider.name} (${latency}ms, ${usage.total_tokens || '?'} tokens)`);
      return { content: data.choices?.[0]?.message?.content || '', provider: `${provider.name} · ${provider.model}`, usage };
    } catch (err) {
      console.warn(`[LLM] ${provider.name} error:`, err.message);
      lastError = `${provider.name}: ${err.message}`;
    }
  }
  throw new Error(lastError || 'All AI providers failed');
}

// ========== Category Routes ==========

// Get all categories with feed counts
app.get('/api/categories', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(f.id) as feed_count
    FROM categories c
    LEFT JOIN feeds f ON f.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order
  `).all();
  res.json(categories);
});

// Get category details (including prompt)
app.get('/api/categories/:id', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json(category);
});

// Add a category
app.post('/api/categories', (req, res) => {
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get();
    const result = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)').run(name, icon || 'newspaper', (maxOrder.m || 0) + 1);
    res.json({ id: result.lastInsertRowid, name, icon: icon || 'newspaper' });
  } catch (e) {
    res.status(400).json({ error: 'Category already exists' });
  }
});

// Update category custom prompt
app.put('/api/categories/:id/prompt', (req, res) => {
  const { prompt } = req.body;
  db.prepare('UPDATE categories SET custom_prompt = ? WHERE id = ?').run(prompt || '', req.params.id);
  res.json({ ok: true });
});

// Update category language
app.put('/api/categories/:id/language', (req, res) => {
  const { language } = req.body;
  db.prepare('UPDATE categories SET language = ? WHERE id = ?').run(language || 'English', req.params.id);
  res.json({ ok: true });
});

// Delete a category
app.delete('/api/categories/:id', (req, res) => {
  db.prepare('DELETE FROM summaries WHERE category_id = ?').run(req.params.id);
  db.prepare('DELETE FROM feeds WHERE category_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ========== Feed Routes ==========

// Get feeds for a category
app.get('/api/categories/:id/feeds', (req, res) => {
  const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(req.params.id);
  res.json(feeds);
});

// Add a feed to a category
app.post('/api/categories/:id/feeds', (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });
  const result = db.prepare('INSERT INTO feeds (category_id, name, url) VALUES (?, ?, ?)').run(req.params.id, name, url);
  res.json({ id: result.lastInsertRowid, category_id: Number(req.params.id), name, url });
});

// Delete a feed
app.delete('/api/feeds/:id', (req, res) => {
  db.prepare('DELETE FROM feeds WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ========== Summary Routes ==========

// Get cached summary (with optional ?date=YYYY-MM-DD)
app.get('/api/categories/:id/summary', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const { date } = req.query;

  if (date) {
    // Look in summary_history for specific date
    const hist = db.prepare('SELECT * FROM summary_history WHERE category_id = ? AND date_key = ? ORDER BY generated_at DESC LIMIT 1').get(req.params.id, date);
    if (hist) {
      return res.json({
        id: hist.id,
        category: category.name,
        summary: hist.summary,
        article_count: hist.article_count,
        feed_count: hist.feed_count,
        generated_at: hist.generated_at,
        provider: hist.provider,
        sentiment_data: hist.sentiment_data ? JSON.parse(hist.sentiment_data) : null,
        tags_data: hist.tags_data ? JSON.parse(hist.tags_data) : null,
      });
    }
    return res.json({ category: category.name, summary: null });
  }

  // No date — try summary_history first (latest), then fall back to summaries table
  const latest = db.prepare('SELECT * FROM summary_history WHERE category_id = ? ORDER BY generated_at DESC LIMIT 1').get(req.params.id);
  if (latest) {
    return res.json({
      id: latest.id,
      category: category.name,
      summary: latest.summary,
      article_count: latest.article_count,
      feed_count: latest.feed_count,
      generated_at: latest.generated_at,
      provider: latest.provider,
      sentiment_data: latest.sentiment_data ? JSON.parse(latest.sentiment_data) : null,
      tags_data: latest.tags_data ? JSON.parse(latest.tags_data) : null,
    });
  }

  const cached = db.prepare('SELECT * FROM summaries WHERE category_id = ?').get(req.params.id);
  if (cached) {
    return res.json({
      category: category.name,
      summary: cached.summary,
      article_count: cached.article_count,
      feed_count: cached.feed_count,
      generated_at: cached.generated_at,
    });
  }

  // No cached summary
  res.json({ category: category.name, summary: null });
});

// Get summary history for a category
app.get('/api/categories/:id/history', (req, res) => {
  const rows = db.prepare('SELECT id, date_key, generated_at FROM summary_history WHERE category_id = ? ORDER BY date_key DESC LIMIT 30').all(req.params.id);
  res.json(rows);
});

// ========== Refresh: Fetch & Summarize ==========

app.post('/api/categories/:id/refresh', async (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(req.params.id);
    if (feeds.length === 0) return res.status(400).json({ error: 'No feeds in this category' });

    // Fetch all RSS feeds in parallel
    const feedResults = await Promise.allSettled(
      feeds.map(async (feed) => {
        try {
          const parsed = await parser.parseURL(feed.url);
          return parsed.items.slice(0, 15).map((item) => ({
            title: item.title || '',
            description: (item.contentSnippet || item.content || '').slice(0, 500),
            link: item.link || '',
            pubDate: item.pubDate || '',
            source: feed.name,
          }));
        } catch (err) {
          console.warn(`Failed to fetch feed "${feed.name}" (${feed.url}):`, err.message);
          return [];
        }
      })
    );

    // Merge all articles
    const allArticles = feedResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 50);

    if (allArticles.length === 0) {
      return res.status(400).json({ error: 'Could not fetch any articles from the feeds' });
    }

    // Cache articles in DB
    const now = new Date().toISOString();
    // Clean old articles (keep last 200 per category)
    const existingCount = db.prepare('SELECT COUNT(*) as c FROM articles WHERE category_id = ?').get(req.params.id).c;
    if (existingCount > 200) {
      db.prepare('DELETE FROM articles WHERE category_id = ? AND id NOT IN (SELECT id FROM articles WHERE category_id = ? ORDER BY fetched_at DESC LIMIT 200)').run(req.params.id, req.params.id);
    }
    const insertArticle = db.prepare('INSERT INTO articles (category_id, feed_name, title, description, link, pub_date, fetched_at) VALUES (?,?,?,?,?,?,?)');
    const insertArticles = db.transaction((arts) => {
      for (const a of arts) {
        insertArticle.run(req.params.id, a.source, a.title, a.description, a.link, a.pubDate, now);
      }
    });
    insertArticles(allArticles);

    // Build prompt
    const articleText = allArticles
      .map((a, i) => `[${i + 1}] ${a.title} (${a.source})\n${a.description}\nLink: ${a.link}`)
      .join('\n\n');

    const customPrompt = category.custom_prompt?.trim();
    const lang = category.language || 'English';
    const prompt = `You are a concise news analyst. Summarize the most important news from the "${category.name}" category below.
IMPORTANT: Write your entire response in ${lang}.

Rules:
- Provide 6-10 sections, each starting with a **bold title** that links to the most relevant article URL using markdown link syntax: [**Title**](url)
- Each section: 2-4 short paragraphs. Be direct and factual, no filler
- Separate each section with a --- (horizontal rule)
- Group related articles into one section
- Never repeat information across sections
- No "Sources", "Links", or "References" section
- No intro or outro text — start directly with the first section
- No "impact" or "significance" commentary between sections
${customPrompt ? `\nAdditional instructions from the user:\n${customPrompt}\n` : ''}
Articles:
${articleText}`;

    const messages = [
      { role: 'system', content: 'You are a professional news analyst. Provide thorough, well-structured summaries with depth and context.' },
      { role: 'user', content: prompt },
    ];

    // Call LLM for summary
    const result = await callLLM(messages, { purpose: 'summary', categoryId: Number(req.params.id) });
    const summary = result.content || 'No summary generated.';
    const generated_at = new Date().toISOString();
    const dateKey = generated_at.split('T')[0];

    // Upsert into summaries table for backward compat
    db.prepare(`
      INSERT INTO summaries (category_id, summary, article_count, feed_count, generated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(category_id) DO UPDATE SET
        summary = excluded.summary,
        article_count = excluded.article_count,
        feed_count = excluded.feed_count,
        generated_at = excluded.generated_at
    `).run(req.params.id, summary, allArticles.length, feeds.length, generated_at);

    // Insert into summary_history
    const histResult = db.prepare('INSERT INTO summary_history (category_id, summary, article_count, feed_count, provider, sentiment_data, tags_data, date_key, generated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
      req.params.id, summary, allArticles.length, feeds.length, result.provider, null, null, dateKey, generated_at
    );
    const historyId = histResult.lastInsertRowid;

    // Enrichment step — extract bold titles and analyze sentiment/tags
    let sentimentData = null;
    let tagsData = null;
    try {
      const boldTitleRegex = /\*\*([^*]+)\*\*/g;
      const titles = [];
      let m;
      while ((m = boldTitleRegex.exec(summary)) !== null) {
        titles.push(m[1]);
      }

      if (titles.length > 0) {
        const numberedTitles = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
        const enrichResult = await callLLM([
          { role: 'system', content: 'You are a news analysis assistant.' },
          { role: 'user', content: `Analyze these news section titles. For each, provide sentiment and 2-3 topic tags.

Sections:
${numberedTitles}

Respond ONLY with valid JSON, no markdown or explanation:
{"sections":[{"sentiment":"positive","tags":["tag1","tag2"]}]}

Sentiment values: positive, negative, neutral, mixed` },
        ], { purpose: 'enrichment', categoryId: Number(req.params.id) });

        // Parse enrichment JSON
        const jsonStr = enrichResult.content.trim();
        const parsed = JSON.parse(jsonStr);

        if (parsed?.sections) {
          sentimentData = parsed.sections.map((s, i) => ({
            title: titles[i] || '',
            sentiment: s.sentiment || 'neutral',
            tags: s.tags || [],
          }));

          // Build flat unique tags array
          const tagSet = new Set();
          for (const s of sentimentData) {
            for (const tag of s.tags) {
              tagSet.add(tag);
            }
          }
          tagsData = [...tagSet];

          // Update summary_history row with enrichment data
          db.prepare('UPDATE summary_history SET sentiment_data = ?, tags_data = ? WHERE id = ?').run(
            JSON.stringify(sentimentData), JSON.stringify(tagsData), historyId
          );
        }
      }
    } catch (enrichErr) {
      console.warn('[Enrichment] Failed, continuing without enrichment:', enrichErr.message);
    }

    res.json({
      id: historyId,
      category: category.name,
      summary,
      article_count: allArticles.length,
      feed_count: feeds.length,
      generated_at,
      provider: result.provider,
      sentiment_data: sentimentData,
      tags_data: tagsData,
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate summary' });
  }
});

// ========== Settings ==========

app.get('/api/settings', (req, res) => {
  const settings = {};
  db.prepare('SELECT * FROM user_settings').all().forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

app.put('/api/settings/:key', (req, res) => {
  const { value } = req.body;
  db.prepare('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)').run(req.params.key, value || '');
  res.json({ ok: true });
});

// ========== Feed Discovery ==========

app.post('/api/discover-feed', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const discovered = [];
  try {
    // Try fetching as HTML and finding RSS links
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 NewsReader/1.0' } });
    const html = await resp.text();

    // Find link tags
    const linkRegex = /<link[^>]*type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const tag = match[0];
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      const titleMatch = tag.match(/title=["']([^"']+)["']/i);
      if (hrefMatch) {
        let feedUrl = hrefMatch[1];
        if (feedUrl.startsWith('/')) feedUrl = new URL(feedUrl, url).href;
        discovered.push({ title: titleMatch?.[1] || feedUrl, url: feedUrl });
      }
    }

    // Try common paths
    if (discovered.length === 0) {
      const base = new URL(url).origin;
      const tryPaths = ['/feed', '/rss', '/atom.xml', '/feed.xml', '/rss.xml', '/index.xml'];
      for (const p of tryPaths) {
        try {
          const testUrl = base + p;
          const parsed = await parser.parseURL(testUrl);
          if (parsed?.items?.length > 0) {
            discovered.push({ title: parsed.title || testUrl, url: testUrl });
            break;
          }
        } catch {}
      }
    }

    // Try the URL itself as RSS
    if (discovered.length === 0) {
      try {
        const parsed = await parser.parseURL(url);
        if (parsed?.items?.length > 0) {
          discovered.push({ title: parsed.title || url, url });
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Feed discovery error:', err.message);
  }

  res.json({ feeds: discovered });
});

// ========== Briefing ==========

app.post('/api/briefing/generate', async (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    if (categories.length === 0) return res.status(400).json({ error: 'No categories' });

    // Get first RSS feed from each category
    const getFirstFeed = db.prepare('SELECT * FROM feeds WHERE category_id = ? ORDER BY id ASC LIMIT 1');
    const feedsWithCategories = categories
      .map(cat => ({ ...getFirstFeed.get(cat.id), categoryName: cat.name, language: cat.language }))
      .filter(f => f && f.url);

    if (feedsWithCategories.length === 0) return res.status(400).json({ error: 'No feeds available' });

    // Fetch recent articles from each feed
    const feedResults = await Promise.allSettled(
      feedsWithCategories.map(async (feed) => {
        try {
          const parsed = await parser.parseURL(feed.url);
          return {
            category: feed.categoryName,
            source: feed.name,
            articles: parsed.items.slice(0, 5).map(item => ({
              title: item.title || '',
              description: (item.contentSnippet || item.content || '').slice(0, 500),
              link: item.link || '',
              pubDate: item.pubDate || ''
            }))
          };
        } catch (err) {
          console.warn(`Failed to fetch feed "${feed.name}" (${feed.url}):`, err.message);
          return { category: feed.categoryName, source: feed.name, articles: [] };
        }
      })
    );

    // Merge all articles from first feed of each category
    const allArticles = feedResults
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.articles)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 30);

    if (allArticles.length === 0) return res.status(400).json({ error: 'Could not fetch any articles from feeds' });

    const lang = categories[0]?.language || 'English';

    // Build article text for LLM
    const articleText = allArticles
      .map((a, i) => `[${i + 1}] ${a.title} (${a.source})\n${a.description}\nLink: ${a.link}`)
      .join('\n\n');

    const result = await callLLM([
      { role: 'system', content: 'You are an editor-in-chief writing a brief morning news briefing.' },
      { role: 'user', content: `Create a very concise morning briefing from the following news articles. Write in ${lang}.

Rules:
- Create a bullet-point list with **bold titles** for each story
- Each bullet point: 1-2 sentences maximum
- Include the source name in parentheses after each bullet
- Highlight the most important 3-5 stories first, then other notable stories
- Be extremely concise — this is a brief aggregation, not a detailed summary
- No intro text like "Good morning" — start directly with the first story
- No horizontal rules or section headers needed

Articles:
${articleText}` },
    ], { purpose: 'briefing' });

    const generated_at = new Date().toISOString();
    const dateKey = generated_at.split('T')[0];

    // Store as category_id = 0 (special briefing marker)
    db.prepare('INSERT INTO summary_history (category_id, summary, article_count, feed_count, provider, date_key, generated_at) VALUES (?,?,?,?,?,?,?)').run(
      0, result.content, allArticles.length, feedsWithCategories.length, result.provider, dateKey, generated_at
    );

    res.json({ summary: result.content, generated_at, provider: result.provider, feed_count: feedsWithCategories.length, article_count: allArticles.length });
  } catch (err) {
    console.error('Briefing error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate briefing' });
  }
});

app.get('/api/briefing/latest', (req, res) => {
  const latest = db.prepare('SELECT * FROM summary_history WHERE category_id = 0 ORDER BY generated_at DESC LIMIT 1').get();
  if (!latest) return res.json({ summary: null });
  res.json({ summary: latest.summary, generated_at: latest.generated_at, provider: latest.provider, feed_count: latest.feed_count });
});

// ========== Chat ==========

app.post('/api/chat', async (req, res) => {
  const { summary_id, message } = req.body;
  if (!summary_id || !message) return res.status(400).json({ error: 'summary_id and message required' });

  try {
    // Get summary context
    const summary = db.prepare('SELECT * FROM summary_history WHERE id = ?').get(summary_id);
    if (!summary) return res.status(404).json({ error: 'Summary not found' });

    // Get recent chat history (last 10 messages)
    const history = db.prepare('SELECT role, content FROM chat_messages WHERE summary_id = ? ORDER BY created_at DESC LIMIT 10').all(summary_id).reverse();

    // Save user message
    const now = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at) VALUES (?,?,?,?)').run(summary_id, 'user', message, now);

    // Build messages for LLM
    const messages = [
      { role: 'system', content: `You are a helpful news analyst. Answer questions about the following news summary. Be concise and factual.\n\nNews Summary:\n${summary.summary}` },
      ...history,
      { role: 'user', content: message },
    ];

    const result = await callLLM(messages, { purpose: 'chat', categoryId: summary.category_id });

    // Save assistant response
    const replyTime = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at) VALUES (?,?,?,?)').run(summary_id, 'assistant', result.content, replyTime);

    res.json({ role: 'assistant', content: result.content, created_at: replyTime });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
});

app.get('/api/chat/:summaryId', (req, res) => {
  const messages = db.prepare('SELECT * FROM chat_messages WHERE summary_id = ? ORDER BY created_at ASC').all(req.params.summaryId);
  res.json(messages);
});

// ========== LLM Stats ==========

app.get('/api/stats/llm', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = db.prepare('SELECT * FROM llm_usage WHERE created_at >= ? ORDER BY created_at DESC').all(since);

  const total_calls = rows.length;
  const total_tokens = rows.reduce((s, r) => s + (r.total_tokens || 0), 0);

  const byProvider = {};
  const byPurpose = {};
  const daily = {};

  for (const r of rows) {
    // By provider
    if (!byProvider[r.provider]) byProvider[r.provider] = { calls: 0, tokens: 0 };
    byProvider[r.provider].calls++;
    byProvider[r.provider].tokens += r.total_tokens || 0;

    // By purpose
    if (!byPurpose[r.purpose]) byPurpose[r.purpose] = { calls: 0, tokens: 0 };
    byPurpose[r.purpose].calls++;
    byPurpose[r.purpose].tokens += r.total_tokens || 0;

    // Daily
    const day = r.created_at.split('T')[0];
    if (!daily[day]) daily[day] = { date: day, tokens: 0, calls: 0 };
    daily[day].tokens += r.total_tokens || 0;
    daily[day].calls++;
  }

  res.json({
    total_calls,
    total_tokens,
    by_provider: byProvider,
    by_purpose: byPurpose,
    daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    quotas: Object.values(providerQuotas),
  });
});

// ========== Tags ==========

app.get('/api/tags/trending', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const rows = db.prepare('SELECT tags_data FROM summary_history WHERE date_key >= ? AND tags_data IS NOT NULL').all(since);

  const tagCounts = {};
  for (const row of rows) {
    try {
      const tags = JSON.parse(row.tags_data);
      for (const tag of tags) {
        const normalized = tag.toLowerCase().trim();
        tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
      }
    } catch {}
  }

  const trending = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  res.json(trending);
});

// ========== Widgets ==========

// Weather (Open-Meteo, free, no key)
app.get('/api/widgets/weather', async (req, res) => {
  try {
    // Default: Budapest. Override with ?lat=...&lon=...
    const lat = req.query.lat || 47.50;
    const lon = req.query.lon || 19.04;
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=4&timezone=auto`
    );
    const data = await resp.json();
    const current = data.current;

    const weatherCodes = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
      55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
      71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
      81: 'Heavy rain showers', 95: 'Thunderstorm',
    };

    // Build forecast for next 3 days (skip today = index 0)
    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      if (data.daily?.time?.[i]) {
        forecast.push({
          date: data.daily.time[i],
          code: data.daily.weather_code[i],
          condition: weatherCodes[data.daily.weather_code[i]] || 'Unknown',
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
        });
      }
    }

    res.json({
      temperature: Math.round(current.temperature_2m),
      code: current.weather_code,
      condition: weatherCodes[current.weather_code] || 'Unknown',
      wind: Math.round(current.wind_speed_10m),
      humidity: current.relative_humidity_2m,
      location: data.timezone?.split('/').pop()?.replace(/_/g, ' ') || 'Unknown',
      forecast,
    });
  } catch (err) {
    console.error('Weather error:', err);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

// EUR exchange rates (free, no key)
app.get('/api/widgets/rates', async (req, res) => {
  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/RON');
    const data = await resp.json();
    const pick = ['EUR', 'USD', 'GBP', 'HUF'];
    const rates = {};
    for (const c of pick) {
      if (data.rates[c]) rates[c] = data.rates[c];
    }
    res.json({
      base: 'RON',
      date: data.time_last_update_utc?.split(' ').slice(1, 4).join(' ') || '',
      rates,
    });
  } catch (err) {
    console.error('Rates error:', err);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// Top headlines (raw RSS titles, no AI)
app.get('/api/widgets/headlines', async (req, res) => {
  try {
    // Grab titles from all feeds across all categories
    const feeds = db.prepare('SELECT f.*, c.name as category_name FROM feeds f JOIN categories c ON c.id = f.category_id').all();

    // Use only telex feed for consistent images
    const telexFeed = feeds.find(f => f.name.toLowerCase() === 'telex');
    const targetFeeds = telexFeed ? [telexFeed] : feeds.slice(0, 1);

    const results = await Promise.allSettled(
      targetFeeds.map(async (feed) => {
        const parsed = await parser.parseURL(feed.url);
        return parsed.items.slice(0, 5).map((item) => ({
          title: item.title || '',
          link: item.link || '',
          source: feed.name,
          pubDate: item.pubDate || '',
          image: extractImage(item),
        }));
      })
    );

    const headlines = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 10);

    res.json(headlines);
  } catch (err) {
    console.error('Headlines error:', err);
    res.status(500).json({ error: 'Failed to fetch headlines' });
  }
});

// Crypto prices
let cryptoCache = { data: null, fetchedAt: 0 };
app.get('/api/widgets/crypto', async (req, res) => {
  // Cache for 2 minutes to avoid CoinGecko rate limits
  if (cryptoCache.data && Date.now() - cryptoCache.fetchedAt < 120_000) {
    return res.json(cryptoCache.data);
  }
  try {
    const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
    const data = await resp.json();
    if (!data.bitcoin?.usd) {
      // Rate limited or bad response — serve cache if available
      if (cryptoCache.data) return res.json(cryptoCache.data);
      return res.json([]);
    }
    const coins = [
      { id: 'bitcoin', symbol: 'BTC', price: data.bitcoin.usd, change_24h: data.bitcoin.usd_24h_change || 0 },
      { id: 'ethereum', symbol: 'ETH', price: data.ethereum?.usd || 0, change_24h: data.ethereum?.usd_24h_change || 0 },
      { id: 'solana', symbol: 'SOL', price: data.solana?.usd || 0, change_24h: data.solana?.usd_24h_change || 0 },
    ];
    cryptoCache = { data: coins, fetchedAt: Date.now() };
    res.json(coins);
  } catch (err) {
    console.error('Crypto error:', err);
    if (cryptoCache.data) return res.json(cryptoCache.data);
    res.status(500).json({ error: 'Failed to fetch crypto prices' });
  }
});

// Hacker News top stories
app.get('/api/widgets/hackernews', async (req, res) => {
  try {
    const idsResp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await idsResp.json();
    const top8 = ids.slice(0, 8);

    const stories = await Promise.all(
      top8.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const item = await r.json();
        return { id: item.id, title: item.title, url: item.url || `https://news.ycombinator.com/item?id=${item.id}`, score: item.score };
      })
    );

    res.json(stories);
  } catch (err) {
    console.error('HN error:', err);
    res.status(500).json({ error: 'Failed to fetch HN stories' });
  }
});

// On This Day (Wikipedia)
// Upcoming Movies & TV (TMDB)
let releasesCache = { data: null, fetchedAt: 0 };
app.get('/api/widgets/releases', async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.json([]);

  // Cache for 30 minutes
  if (releasesCache.data && Date.now() - releasesCache.fetchedAt < 30 * 60_000) {
    return res.json(releasesCache.data);
  }

  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);
    const from = today.toISOString().split('T')[0];
    const to = endDate.toISOString().split('T')[0];

    const [moviesResp, tvResp] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&primary_release_date.gte=${from}&primary_release_date.lte=${to}&sort_by=popularity.desc&page=1`),
      fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&first_air_date.gte=${from}&first_air_date.lte=${to}&sort_by=popularity.desc&page=1`),
    ]);

    const moviesData = await moviesResp.json();
    const tvData = await tvResp.json();

    const movies = (moviesData.results || []).slice(0, 20).map(m => ({
      id: m.id,
      title: m.title,
      date: m.release_date,
      type: 'movie',
      rating: m.vote_average || null,
      overview: m.overview?.slice(0, 120) || '',
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
    }));

    const shows = (tvData.results || []).slice(0, 20).map(t => ({
      id: t.id,
      title: t.name,
      date: t.first_air_date,
      type: 'tv',
      rating: t.vote_average || null,
      overview: t.overview?.slice(0, 120) || '',
      poster: t.poster_path ? `https://image.tmdb.org/t/p/w185${t.poster_path}` : null,
    }));

    // Merge and sort by date
    const releases = [...movies, ...shows].sort((a, b) => a.date.localeCompare(b.date));
    releasesCache = { data: releases, fetchedAt: Date.now() };
    res.json(releases);
  } catch (err) {
    console.error('TMDB error:', err);
    if (releasesCache.data) return res.json(releasesCache.data);
    res.status(500).json({ error: 'Failed to fetch releases' });
  }
});

// TMDB detail endpoint
app.get('/api/widgets/releases/:type/:id', async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB not configured' });

  const { type, id } = req.params;
  if (type !== 'movie' && type !== 'tv') return res.status(400).json({ error: 'Invalid type' });

  try {
    const resp = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&append_to_response=credits,videos`);
    const data = await resp.json();
    if (data.success === false) return res.status(404).json({ error: 'Not found' });

    const cast = (data.credits?.cast || []).slice(0, 8).map(c => c.name);
    const directors = (data.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name);
    const creators = (data.created_by || []).map(c => c.name);
    const trailer = (data.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const genres = (data.genres || []).map(g => g.name);

    res.json({
      id: data.id,
      title: data.title || data.name,
      tagline: data.tagline || null,
      overview: data.overview || '',
      date: data.release_date || data.first_air_date || '',
      type,
      rating: data.vote_average || null,
      votes: data.vote_count || 0,
      runtime: data.runtime || (data.episode_run_time?.[0]) || null,
      genres,
      cast,
      directors: type === 'movie' ? directors : creators,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w300${data.poster_path}` : null,
      backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}` : null,
      trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      seasons: data.number_of_seasons || null,
      episodes: data.number_of_episodes || null,
      status: data.status || null,
    });
  } catch (err) {
    console.error('TMDB detail error:', err);
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});

// ========== Homepage Briefs ==========

let homepageCache = { data: null, fetchedAt: 0 };

app.get('/api/homepage', async (req, res) => {
  // Cache for 5 minutes
  if (homepageCache.data && Date.now() - homepageCache.fetchedAt < 5 * 60_000) {
    return res.json(homepageCache.data);
  }

  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    if (categories.length === 0) return res.json([]);

    // Get first feed from each category
    const getFirstFeed = db.prepare('SELECT * FROM feeds WHERE category_id = ? ORDER BY id ASC LIMIT 1');

    const results = await Promise.allSettled(
      categories.map(async (cat) => {
        const feed = getFirstFeed.get(cat.id);
        if (!feed) return null;

        try {
          const parsed = await parser.parseURL(feed.url);
          // Get top 3 articles from first feed
          const articles = parsed.items.slice(0, 5).map((item) => {
            const snippet = (item.contentSnippet || item.content || '')
              .replace(/<[^>]*>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 400);

            return {
              title: item.title || '',
              excerpt: snippet,
              link: item.link || '',
              image: extractImage(item),
              pubDate: item.pubDate || '',
              source: feed.name,
            };
          });

          return {
            categoryId: cat.id,
            categoryName: cat.name,
            articles,
          };
        } catch (err) {
          console.warn(`Homepage: failed to fetch "${feed.name}" (${feed.url}):`, err.message);
          return { categoryId: cat.id, categoryName: cat.name, articles: [] };
        }
      })
    );

    const briefs = results
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value)
      .filter((b) => b.articles.length > 0);

    homepageCache = { data: briefs, fetchedAt: Date.now() };
    res.json(briefs);
  } catch (err) {
    console.error('Homepage error:', err);
    res.status(500).json({ error: 'Failed to fetch homepage data' });
  }
});

// Force-refresh homepage (busts cache)
app.post('/api/homepage/refresh', async (req, res) => {
  homepageCache = { data: null, fetchedAt: 0 };
  // Forward to GET handler
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    if (categories.length === 0) return res.json([]);

    const getFirstFeed = db.prepare('SELECT * FROM feeds WHERE category_id = ? ORDER BY id ASC LIMIT 1');

    const results = await Promise.allSettled(
      categories.map(async (cat) => {
        const feed = getFirstFeed.get(cat.id);
        if (!feed) return null;

        try {
          const parsed = await parser.parseURL(feed.url);
          const articles = parsed.items.slice(0, 5).map((item) => {
            const snippet = (item.contentSnippet || item.content || '')
              .replace(/<[^>]*>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 400);

            return {
              title: item.title || '',
              excerpt: snippet,
              link: item.link || '',
              image: extractImage(item),
              pubDate: item.pubDate || '',
              source: feed.name,
            };
          });

          return { categoryId: cat.id, categoryName: cat.name, articles };
        } catch (err) {
          console.warn(`Homepage refresh: failed "${feed.name}":`, err.message);
          return { categoryId: cat.id, categoryName: cat.name, articles: [] };
        }
      })
    );

    const briefs = results
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value)
      .filter((b) => b.articles.length > 0);

    homepageCache = { data: briefs, fetchedAt: Date.now() };
    res.json(briefs);
  } catch (err) {
    console.error('Homepage refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh homepage' });
  }
});

// ========== Telegram ==========

app.post('/api/telegram/send', async (req, res) => {
  const { categoryId } = req.body;
  if (!categoryId && categoryId !== 0) return res.status(400).json({ error: 'categoryId required' });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return res.status(500).json({ error: 'Telegram not configured' });

  let cat, row;

  if (categoryId === 0) {
    // Briefing (stored with category_id = 0)
    row = db.prepare(
      "SELECT summary, article_count, feed_count, generated_at FROM summary_history WHERE category_id = 0 ORDER BY generated_at DESC LIMIT 1"
    ).get();
    if (!row) return res.status(404).json({ error: 'No briefing found' });
    cat = { name: 'Morning Briefing' };
  } else {
    // Get category name
    cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(categoryId);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    // Get latest summary
    row = db.prepare(
      "SELECT summary, article_count, feed_count, generated_at FROM summary_history WHERE category_id = ? ORDER BY generated_at DESC LIMIT 1"
    ).get(categoryId);
  }
  if (!row) return res.status(404).json({ error: 'No summary found for this category' });

  // Format message for Telegram (MarkdownV2)
  const header = `📰 *${escTg(cat.name)}*\n_${escTg(row.article_count + ' articles from ' + row.feed_count + ' sources')}_\n_${escTg(new Date(row.generated_at).toLocaleString())}_`;
  const body = row.summary;

  // Telegram has a 4096 char limit per message, split if needed
  const fullText = `${header}\n\n${body}`;
  const chunks = splitTgMessage(fullText, 4096);

  try {
    for (const chunk of chunks) {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      const data = await resp.json();
      if (!data.ok) {
        console.error('Telegram error:', data);
        return res.status(500).json({ error: data.description || 'Telegram API error' });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Telegram send error:', err);
    res.status(500).json({ error: 'Failed to send to Telegram' });
  }
});

function escTg(str) {
  return String(str).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function splitTgMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

// ========== Start ==========

app.listen(PORT, () => {
  console.log(`News Reader API running on http://localhost:${PORT}`);
});
