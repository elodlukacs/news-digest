const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { buildMessages } = require('../lib/promptManager');
const { getArticleSource, getArticleBriefing, formatRelated } = require('../lib/articleSource');

const router = express.Router();

const SOURCE_NOTES = {
  page: 'full original article',
  feed: 'full text from the feed',
  excerpt: 'feed excerpt only — the original page could not be read',
};

// The section's own text from the summary markdown — the fallback source when
// neither the feed nor the page gives us anything better.
function summarySection(summary, articleTitle) {
  const parts = summary.summary.split(/\n---\n/);
  const match = parts.find(p => p.includes(articleTitle));
  return match ? match.trim() : '';
}

/**
 * Resolve everything the article chat is grounded in: the original article
 * text and a background briefing. The URL is only used when it appears in this
 * summary's own markdown, so the endpoint can't be pointed at arbitrary pages.
 * A failed briefing degrades to chatting without one rather than failing.
 */
async function loadArticleMaterial(summary, { title, url, fallback }) {
  const trustedUrl = typeof url === 'string' && url && summary.summary.includes(`](${url})`) ? url : null;
  const source = await getArticleSource({
    url: trustedUrl,
    title,
    fallback: fallback || summarySection(summary, title),
  });

  const category = db.prepare('SELECT language FROM categories WHERE id = ?').get(summary.category_id);
  let briefing = null;
  try {
    briefing = await getArticleBriefing({
      key: source.key,
      title,
      articleText: source.text,
      excludeSource: source.feedName,
      language: category?.language || 'English',
    });
  } catch (err) {
    console.error('[chat] background briefing failed:', err.message);
  }
  return { source, briefing };
}

const findSummary = (id) => db.prepare('SELECT * FROM summary_history WHERE id = ?').get(id);

// Warm the article source + briefing when the chat opens, so the first question
// doesn't pay for the page fetch and the extra LLM call.
router.post('/context', async (req, res, next) => {
  const { summary_id, article_title, article_url, article_content } = req.body || {};
  if (!summary_id || !article_title) return res.status(400).json({ error: 'summary_id and article_title required' });

  try {
    const summary = findSummary(summary_id);
    if (!summary) return res.status(404).json({ error: 'Summary not found' });

    const { source, briefing } = await loadArticleMaterial(summary, {
      title: article_title,
      url: article_url,
      fallback: article_content,
    });
    res.json({ source: source.origin, briefing: Boolean(briefing), related: briefing?.related.length ?? 0 });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const { summary_id, message, provider: selectedProvider, article_title, article_url, article_content } = req.body || {};
  if (!summary_id || !message) return res.status(400).json({ error: 'summary_id and message required' });

  try {
    const summary = findSummary(summary_id);
    if (!summary) return res.status(404).json({ error: 'Summary not found' });

    // Load history scoped to article if article_title is provided
    const history = article_title
      ? db.prepare('SELECT role, content FROM chat_messages WHERE summary_id = ? AND article_title = ? ORDER BY created_at DESC LIMIT 10').all(summary_id, article_title).reverse()
      : db.prepare('SELECT role, content FROM chat_messages WHERE summary_id = ? AND article_title IS NULL ORDER BY created_at DESC LIMIT 10').all(summary_id).reverse();

    let promptMessages;
    if (article_title) {
      const { source, briefing } = await loadArticleMaterial(summary, {
        title: article_title,
        url: article_url,
        fallback: article_content,
      });
      promptMessages = buildMessages('article-chat', {
        title: article_title,
        source_note: SOURCE_NOTES[source.origin],
        article: source.text || '(not available)',
        related: formatRelated(briefing?.related ?? []),
        briefing: briefing?.briefing || '(not available)',
      });
    } else {
      promptMessages = buildMessages('chat', { summary: summary.summary });
    }

    // Written only once the material has loaded, so a failure there doesn't
    // leave an unanswered question in the history.
    const now = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at, article_title) VALUES (?,?,?,?,?)').run(summary_id, 'user', message, now, article_title || null);

    const messages = [
      ...promptMessages,
      ...history,
      { role: 'user', content: message },
    ];

    const result = await callLLM(messages, { purpose: 'chat', categoryId: summary.category_id, providerId: selectedProvider || null, db });

    const replyTime = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at, article_title) VALUES (?,?,?,?,?)').run(summary_id, 'assistant', result.content, replyTime, article_title || null);

    res.json({ role: 'assistant', content: result.content, created_at: replyTime });
  } catch (err) {
    // The terminal handler logs the detail and returns a generic 500 — the
    // message used to be sent verbatim, leaking upstream provider errors.
    next(err);
  }
});

// Load chat history, optionally filtered by article_title query param
router.get('/:summaryId', (req, res) => {
  const { article_title } = req.query;
  const messages = article_title
    ? db.prepare('SELECT * FROM chat_messages WHERE summary_id = ? AND article_title = ? ORDER BY created_at ASC').all(req.params.summaryId, article_title)
    : db.prepare('SELECT * FROM chat_messages WHERE summary_id = ? AND article_title IS NULL ORDER BY created_at ASC').all(req.params.summaryId);
  res.json(messages);
});

module.exports = router;
