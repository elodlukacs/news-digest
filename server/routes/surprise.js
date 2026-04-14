const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { buildMessages } = require('../lib/promptManager');
const { cleanArticleText } = require('../lib/cleanText');

const router = express.Router();

const MIN_CLEAN_LENGTH = 320;
const FALLBACK_MIN_LENGTH = 180;
const LLM_INPUT_TRIM = 1800; // chars — enough for a 2-4 sentence brief
const PREWARM_COUNT = 3;

function articleKey(id) {
  return `surprise:${id}`;
}

function pickArticle({ excludeId } = {}) {
  const excludeClause = excludeId ? 'AND a.id != ?' : '';
  const params = excludeId ? [excludeId] : [];

  // Primary: recent + substantial raw length. Fetch a batch and pick the
  // first whose cleaned text meets the quality bar.
  const primary = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.pub_date > datetime('now', '-72 hours')
      AND LENGTH(COALESCE(a.body_text, a.description, '')) > 400
      ${excludeClause}
    ORDER BY RANDOM()
    LIMIT 15
  `).all(...params);

  for (const row of primary) {
    const cleaned = cleanArticleText(row.body_text || row.description || '');
    if (cleaned.length >= MIN_CLEAN_LENGTH) {
      return { ...row, _cleaned: cleaned };
    }
  }

  // Fallback: 7-day window with a lower quality bar
  const fallback = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.pub_date > datetime('now', '-7 days')
      ${excludeClause}
    ORDER BY RANDOM()
    LIMIT 15
  `).all(...params);

  for (const row of fallback) {
    const cleaned = cleanArticleText(row.body_text || row.description || '');
    if (cleaned.length >= FALLBACK_MIN_LENGTH) {
      return { ...row, _cleaned: cleaned };
    }
  }

  return null;
}

async function ensureBrief(article, cleaned) {
  const cached = article.surprise_brief;
  if (cached && typeof cached === 'string' && cached.trim().length >= 60) {
    return cached.trim();
  }
  if (!cleaned) return '';
  try {
    // Trim input — we only need enough context for a 2-4 sentence summary.
    const trimmed = cleaned.length > LLM_INPUT_TRIM ? cleaned.slice(0, LLM_INPUT_TRIM) : cleaned;
    const messages = buildMessages('surprise-brief', {
      title: article.title || '',
      source: article.feed_name || 'Unknown source',
      content: trimmed,
    });
    const result = await callLLM(messages, {
      purpose: 'surprise-brief',
      max_tokens: 240,
      temperature: 0.3,
    });
    const brief = String(result?.content || '').trim();
    if (brief.length >= 60) {
      db.prepare('UPDATE articles SET surprise_brief = ? WHERE id = ?').run(brief, article.id);
      return brief;
    }
    return cleaned;
  } catch (err) {
    console.warn('Surprise brief generation failed:', err.message);
    return cleaned;
  }
}

// Fire-and-forget pre-warming: generate briefs for other recent
// candidates so subsequent /surprise calls hit the DB cache.
async function prewarmBriefs(excludeIds = []) {
  try {
    const placeholders = excludeIds.length ? excludeIds.map(() => '?').join(',') : null;
    const sql = `
      SELECT a.*, c.name as category_name
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.pub_date > datetime('now', '-72 hours')
        AND (a.surprise_brief IS NULL OR LENGTH(a.surprise_brief) < 60)
        AND LENGTH(COALESCE(a.body_text, a.description, '')) > 400
        ${placeholders ? `AND a.id NOT IN (${placeholders})` : ''}
      ORDER BY RANDOM()
      LIMIT ?
    `;
    const params = placeholders ? [...excludeIds, PREWARM_COUNT] : [PREWARM_COUNT];
    const rows = db.prepare(sql).all(...params);
    for (const row of rows) {
      const cleaned = cleanArticleText(row.body_text || row.description || '');
      if (cleaned.length < MIN_CLEAN_LENGTH) continue;
      try { await ensureBrief(row, cleaned); } catch (e) { console.warn('Prewarm item failed:', e.message); }
    }
  } catch (err) {
    console.warn('Prewarm failed:', err.message);
  }
}

router.get('/', async (req, res) => {
  const rawExclude = Number(req.query.exclude);
  const excludeId = Number.isFinite(rawExclude) && rawExclude > 0 ? rawExclude : undefined;
  const article = pickArticle({ excludeId });
  if (!article) return res.status(404).json({ error: 'No articles found. Generate some summaries first.' });

  const cleaned = article._cleaned || cleanArticleText(article.body_text || article.description || '');
  const brief = await ensureBrief(article, cleaned);

  // eslint-disable-next-line no-unused-vars
  const { _cleaned, body_text, surprise_brief, surprise_expanded, ...rest } = article;
  res.json({
    ...rest,
    description: brief || cleaned,
    raw_content: cleaned,
    has_expanded: !!(surprise_expanded && String(surprise_expanded).trim().length > 100),
  });

  // Kick off pre-warming so the next article click is instant.
  setImmediate(() => { prewarmBriefs([article.id]); });
});

// Explicit pre-warm endpoint the client can hit on load as a best effort.
router.post('/prewarm', (req, res) => {
  setImmediate(() => { prewarmBriefs([]); });
  res.json({ ok: true, scheduled: PREWARM_COUNT });
});

router.post('/elaborate', async (req, res) => {
  const { article_id, title, content, source, provider: selectedProvider } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

  // Return cached elaboration if present
  if (article_id) {
    const row = db.prepare('SELECT surprise_expanded FROM articles WHERE id = ?').get(Number(article_id));
    if (row?.surprise_expanded && String(row.surprise_expanded).trim().length > 100) {
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
      purpose: 'surprise-elaborate',
      providerId: selectedProvider || null,
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
      purpose: 'surprise-chat',
      providerId: selectedProvider || null,
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
