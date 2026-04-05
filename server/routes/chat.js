const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { buildMessages } = require('../lib/promptManager');

const router = express.Router();

router.post('/', async (req, res) => {
  const { summary_id, message, provider: selectedProvider, article_title, article_content } = req.body;
  if (!summary_id || !message) return res.status(400).json({ error: 'summary_id and message required' });

  try {
    const summary = db.prepare('SELECT * FROM summary_history WHERE id = ?').get(summary_id);
    if (!summary) return res.status(404).json({ error: 'Summary not found' });

    // Load history scoped to article if article_title is provided
    const history = article_title
      ? db.prepare('SELECT role, content FROM chat_messages WHERE summary_id = ? AND article_title = ? ORDER BY created_at DESC LIMIT 10').all(summary_id, article_title).reverse()
      : db.prepare('SELECT role, content FROM chat_messages WHERE summary_id = ? AND article_title IS NULL ORDER BY created_at DESC LIMIT 10').all(summary_id).reverse();

    const now = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at, article_title) VALUES (?,?,?,?,?)').run(summary_id, 'user', message, now, article_title || null);

    // Build context: use article content if available, otherwise full summary
    let context = summary.summary;
    if (article_title && article_content) {
      context = `Article: ${article_title}\n\n${article_content}`;
    } else if (article_title) {
      context = `Article: ${article_title}\n\nFull summary:\n${summary.summary}`;
    }

    const promptMessages = buildMessages('chat', { summary: context });
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
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
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
