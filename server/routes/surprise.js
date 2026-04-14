const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { buildMessages } = require('../lib/promptManager');
const { cleanArticleText } = require('../lib/cleanText');

const router = express.Router();

const MIN_CLEAN_LENGTH = 320;
const FALLBACK_MIN_LENGTH = 180;

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
      return { ...row, description: cleaned };
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
      return { ...row, description: cleaned };
    }
  }

  return null;
}

router.get('/', (req, res) => {
  const rawExclude = Number(req.query.exclude);
  const excludeId = Number.isFinite(rawExclude) && rawExclude > 0 ? rawExclude : undefined;
  const article = pickArticle({ excludeId });
  if (!article) return res.status(404).json({ error: 'No articles found. Generate some summaries first.' });
  res.json(article);
});

router.post('/elaborate', async (req, res) => {
  const { article_id, title, content, source, provider: selectedProvider } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

  try {
    const messages = buildMessages('surprise-elaborate', {
      title,
      source: source || 'Unknown source',
      content,
    });
    const result = await callLLM(messages, {
      purpose: 'surprise-elaborate',
      providerId: selectedProvider || null,
      max_tokens: 1500,
      temperature: 0.5,
    });
    res.json({ content: result.content, provider: result.provider, model: result.model, article_id: article_id ?? null });
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
