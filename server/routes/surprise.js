// Routes for the "Break / Surprise" homepage feature.
//
// GET /              → pure DB query. Returns a recent article with its
//                      pre-generated brief (falling back to cleaned raw text
//                      if the worker hasn't covered it yet). No LLM call.
// POST /prewarm      → delegates to the background worker.
// POST /elaborate    → returns cached expanded summary, or generates one
//                      on-demand if not pre-computed.
// POST /chat         → freeform chat about the article (LLM on request).
// GET  /chat/:id     → prior chat history for an article.

const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { buildMessages } = require('../lib/promptManager');
const { cleanArticleText } = require('../lib/cleanText');
const { generateMissingBriefs } = require('../lib/surpriseWorker');

const router = express.Router();

const BRIEF_MIN_LENGTH = 60;
const EXPANDED_MIN_LENGTH = 200;
const CLEAN_MIN_LENGTH = 180;

function articleKey(id) {
  return `surprise:${id}`;
}

// Pick a recent article. Prefer ones with a pre-generated brief so the user
// gets the curated summary; fall back to any recent substantial article
// (we'll serve cleaned raw text as the brief in that case).
function pickArticle({ excludeId } = {}) {
  const excludeClause = excludeId ? 'AND a.id != ?' : '';
  const params = excludeId ? [excludeId] : [];

  // Primary: recent + has a brief already.
  const primary = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.pub_date > datetime('now', '-72 hours')
      AND a.surprise_brief IS NOT NULL
      AND LENGTH(a.surprise_brief) >= ?
      ${excludeClause}
    ORDER BY RANDOM()
    LIMIT 1
  `).all(BRIEF_MIN_LENGTH, ...params);

  if (primary.length) return primary[0];

  // Fallback: any recent article with enough raw content; we'll clean on the fly.
  const fallback = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.pub_date > datetime('now', '-72 hours')
      AND LENGTH(COALESCE(a.body_text, a.description, '')) > 400
      ${excludeClause}
    ORDER BY RANDOM()
    LIMIT 10
  `).all(...params);

  for (const row of fallback) {
    const cleaned = cleanArticleText(row.body_text || row.description || '');
    if (cleaned.length >= CLEAN_MIN_LENGTH) {
      return { ...row, _cleaned: cleaned };
    }
  }

  // Last-resort: older window.
  const old = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.pub_date > datetime('now', '-7 days')
      ${excludeClause}
    ORDER BY RANDOM()
    LIMIT 10
  `).all(...params);

  for (const row of old) {
    const cleaned = cleanArticleText(row.body_text || row.description || '');
    if (cleaned.length >= CLEAN_MIN_LENGTH) {
      return { ...row, _cleaned: cleaned };
    }
  }

  return null;
}

router.get('/', (req, res) => {
  const rawExclude = Number(req.query.exclude);
  const excludeId = Number.isFinite(rawExclude) && rawExclude > 0 ? rawExclude : undefined;

  const article = pickArticle({ excludeId });
  if (!article) {
    return res.status(404).json({ error: 'No articles found. Generate some summaries first.' });
  }

  const cleaned = article._cleaned || cleanArticleText(article.body_text || article.description || '');
  const brief = (article.surprise_brief && article.surprise_brief.trim().length >= BRIEF_MIN_LENGTH)
    ? article.surprise_brief.trim()
    : cleaned;

  // eslint-disable-next-line no-unused-vars
  const { _cleaned, body_text, surprise_brief, surprise_expanded, ...rest } = article;
  res.json({
    ...rest,
    description: brief,
    raw_content: cleaned,
    has_expanded: !!(surprise_expanded && String(surprise_expanded).trim().length >= EXPANDED_MIN_LENGTH),
  });

  // Nudge the worker in the background so the pool stays warm.
  setImmediate(() => {
    generateMissingBriefs({ limit: 8, includeElaborate: true, elaborateLimit: 2 })
      .catch((err) => console.warn('[surprise] nudge sweep failed:', err.message));
  });
});

// Explicit prewarm endpoint — the client hits this on Break route mount.
router.post('/prewarm', (req, res) => {
  setImmediate(() => {
    generateMissingBriefs({ limit: 10, includeElaborate: true, elaborateLimit: 3 })
      .catch((err) => console.warn('[surprise] prewarm failed:', err.message));
  });
  res.json({ ok: true });
});

router.post('/elaborate', async (req, res) => {
  const { article_id, title, content, source, provider: selectedProvider } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

  // Return cached elaboration if present.
  if (article_id) {
    const row = db.prepare('SELECT surprise_expanded FROM articles WHERE id = ?').get(Number(article_id));
    if (row?.surprise_expanded && String(row.surprise_expanded).trim().length >= EXPANDED_MIN_LENGTH) {
      return res.json({ content: row.surprise_expanded, article_id, cached: true });
    }
  }

  try {
    const messages = buildMessages('surprise-elaborate', {
      title,
      source: source || 'Unknown source',
      content,
    });
    const result = await callLLM(messages, {
      db,
      purpose: 'surprise-elaborate',
      providerId: 'llama8b',
      max_tokens: 2000,
      temperature: 0.5,
    });
    const expanded = String(result?.content || '').trim();
    if (article_id && expanded.length > 100) {
      db.prepare('UPDATE articles SET surprise_expanded = ? WHERE id = ?').run(expanded, Number(article_id));
    }
    res.json({ content: expanded, provider: result.provider, model: result.model, article_id: article_id ?? null });
  } catch (err) {
    console.error('Surprise elaborate error:', err);
    res.status(500).json({ error: err.message || 'Failed to elaborate' });
  }
});

router.get('/chat/:articleId', (req, res) => {
  const articleId = Number(req.params.articleId);
  if (!Number.isFinite(articleId)) return res.status(400).json({ error: 'Invalid article id' });
  const rows = db.prepare(`
    SELECT id, role, content, created_at
    FROM chat_messages
    WHERE summary_id = 0 AND article_title = ?
    ORDER BY created_at ASC
  `).all(articleKey(articleId));
  res.json(rows);
});

router.post('/chat', async (req, res) => {
  const { article_id, title, content, message, provider: selectedProvider } = req.body || {};
  if (!article_id || !title || !message) {
    return res.status(400).json({ error: 'article_id, title, and message required' });
  }

  try {
    const key = articleKey(article_id);
    const history = db.prepare(`
      SELECT role, content FROM chat_messages
      WHERE summary_id = 0 AND article_title = ?
      ORDER BY created_at DESC LIMIT 10
    `).all(key).reverse();

    const now = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at, article_title) VALUES (?,?,?,?,?)')
      .run(0, 'user', message, now, key);

    const context = `Article: ${title}\n\n${content || ''}`;
    const promptMessages = buildMessages('surprise-chat', { article: context });
    const messages = [
      ...promptMessages,
      ...history,
      { role: 'user', content: message },
    ];

    const result = await callLLM(messages, {
      db,
      purpose: 'surprise-chat',
      providerId: 'llama8b',
      max_tokens: 1024,
      temperature: 0.5,
    });

    const replyTime = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at, article_title) VALUES (?,?,?,?,?)')
      .run(0, 'assistant', result.content, replyTime, key);

    res.json({ role: 'assistant', content: result.content, created_at: replyTime });
  } catch (err) {
    console.error('Surprise chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
});

module.exports = router;
