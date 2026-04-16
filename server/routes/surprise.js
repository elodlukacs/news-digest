// Routes for the "Take a Break" homepage feature.
//
// GET /              → pure DB read. Picks a random article from a recent
//                      summary_history row (already LLM-summarised). No LLM
//                      call on the request path.
// POST /elaborate    → on-demand LLM call. Generates a longer, more informative
//                      briefing from the original article body. Cached in
//                      articles.surprise_expanded when article_id is known.
// POST /chat         → freeform chat about the article (LLM on user action).
// GET  /chat/:id     → prior chat history for an article.

const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { buildMessages } = require('../lib/promptManager');

const router = express.Router();

const EXPANDED_MIN_LENGTH = 200;
const SUMMARY_LOOKBACK_DAYS = 7;
const RANDOM_POOL_SIZE = 40; // sample N recent summary rows, pick one

function articleKey(id) {
  return `surprise:${id}`;
}

// Parse the LLM-generated category summary markdown into individual article
// sections. Mirrors the client-side parseSummaryMarkdown in SummaryView.tsx.
function parseSummaryMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') return [];
  const sections = [];
  const parts = markdown.split(/\n---\n/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Greedy title match so titles containing nested brackets (e.g.
    // "Foo [Reuters World]") are captured correctly: `.+` grabs up to the
    // last `](...)` on the line.
    const firstLine = trimmed.split('\n')[0];
    const linkMatch = firstLine.match(/^##\s+\[(.+)\]\(([^)]+)\)\s*$/);
    const title = linkMatch
      ? linkMatch[1]
      : firstLine.replace(/^#+\s*/, '').replace(/\*\*/g, '');
    const url = linkMatch ? linkMatch[2] : '';

    let content = trimmed
      .replace(/^##\s+\[.+\]\([^)]+\)\s*\n?/, '')
      .replace(/^#+\s*/, '')
      .trim();

    content = content
      .replace(/出自\s*[^。]+。/g, '')
      .replace(/Source:\s*[^\n]+/gi, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (title && content) {
      sections.push({ title, url, content });
    }
  }

  return sections;
}

// Pick a random article from a recent summary_history row.
// Strategy: pull the latest N summary rows across all categories from the
// last SUMMARY_LOOKBACK_DAYS, shuffle, walk through them until we find one
// with at least one parseable section that isn't excluded.
function pickArticle({ excludeUrl } = {}) {
  const rows = db.prepare(`
    SELECT sh.id, sh.category_id, sh.summary, sh.sentiment_data, sh.generated_at,
           c.name as category_name
    FROM summary_history sh
    LEFT JOIN categories c ON c.id = sh.category_id
    WHERE sh.generated_at > datetime('now', ?)
      AND sh.category_id > 0
      AND sh.summary IS NOT NULL
    ORDER BY sh.generated_at DESC
    LIMIT ?
  `).all(`-${SUMMARY_LOOKBACK_DAYS} days`, RANDOM_POOL_SIZE);

  if (rows.length === 0) return null;

  // Fisher-Yates shuffle so we visit summary rows in random order.
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const findArticleByLink = db.prepare(
    'SELECT id, link, feed_name, pub_date, body_text, description, surprise_expanded FROM articles WHERE link = ? LIMIT 1'
  );
  const findArticleByTitle = db.prepare(
    'SELECT id, link, feed_name, pub_date, body_text, description, surprise_expanded FROM articles WHERE category_id = ? AND title = ? LIMIT 1'
  );

  for (const row of rows) {
    const sections = parseSummaryMarkdown(row.summary);
    if (sections.length === 0) continue;

    // Build a lookup of original_content by title from sentiment_data so we
    // can fall back when the article row is gone.
    let originalByTitle = new Map();
    if (row.sentiment_data) {
      try {
        const parsed = JSON.parse(row.sentiment_data);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (entry && entry.title && entry.original_content) {
              originalByTitle.set(String(entry.title).toLowerCase(), entry.original_content);
            }
          }
        }
      } catch {
        // ignore malformed sentiment_data
      }
    }

    // Random order over sections too.
    const order = sections.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    for (const idx of order) {
      const section = sections[idx];
      if (excludeUrl && section.url && section.url === excludeUrl) continue;

      // Try to find the original article row for source/pub_date/body_text.
      let articleRow = section.url ? findArticleByLink.get(section.url) : null;
      if (!articleRow) {
        articleRow = findArticleByTitle.get(row.category_id, section.title);
      }

      const originalContent =
        (articleRow && (articleRow.body_text || articleRow.description)) ||
        originalByTitle.get(section.title.toLowerCase()) ||
        '';

      return {
        // Stable identifier: prefer the articles row id; otherwise derive from
        // summary_history row + section index so the client can pass it back
        // as exclude on "Next".
        article_id: articleRow ? articleRow.id : null,
        title: section.title,
        brief: section.content,
        link: section.url || (articleRow ? articleRow.link : ''),
        source: articleRow ? articleRow.feed_name : '',
        pub_date: articleRow ? articleRow.pub_date : row.generated_at,
        category_name: row.category_name || '',
        raw_content: originalContent,
        has_expanded: !!(
          articleRow &&
          articleRow.surprise_expanded &&
          String(articleRow.surprise_expanded).trim().length >= EXPANDED_MIN_LENGTH
        ),
      };
    }
  }

  return null;
}

router.get('/', (req, res) => {
  const excludeUrl =
    typeof req.query.exclude_url === 'string' && req.query.exclude_url.trim()
      ? req.query.exclude_url.trim()
      : undefined;

  const article = pickArticle({ excludeUrl });
  if (!article) {
    return res
      .status(404)
      .json({ error: 'No summarised articles found. Refresh a category to populate the pool.' });
  }

  res.json(article);
});

router.post('/elaborate', async (req, res) => {
  const { article_id, title, content, source } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  // Return cached elaboration if present.
  if (article_id) {
    const row = db
      .prepare('SELECT surprise_expanded FROM articles WHERE id = ?')
      .get(Number(article_id));
    if (
      row?.surprise_expanded &&
      String(row.surprise_expanded).trim().length >= EXPANDED_MIN_LENGTH
    ) {
      return res.json({
        content: row.surprise_expanded,
        article_id,
        cached: true,
      });
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
      db.prepare('UPDATE articles SET surprise_expanded = ? WHERE id = ?').run(
        expanded,
        Number(article_id),
      );
    }
    res.json({
      content: expanded,
      provider: result.provider,
      model: result.model,
      article_id: article_id ?? null,
    });
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
  const { article_id, title, content, message } = req.body || {};
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
    db.prepare(
      'INSERT INTO chat_messages (summary_id, role, content, created_at, article_title) VALUES (?,?,?,?,?)',
    ).run(0, 'user', message, now, key);

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
    db.prepare(
      'INSERT INTO chat_messages (summary_id, role, content, created_at, article_title) VALUES (?,?,?,?,?)',
    ).run(0, 'assistant', result.content, replyTime, key);

    res.json({ role: 'assistant', content: result.content, created_at: replyTime });
  } catch (err) {
    console.error('Surprise chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
});

module.exports = router;
