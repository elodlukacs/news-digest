const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');

const router = express.Router();

router.post('/', async (req, res) => {
  const { summary_id, message, provider: selectedProvider } = req.body;
  if (!summary_id || !message) return res.status(400).json({ error: 'summary_id and message required' });

  try {
    const summary = db.prepare('SELECT * FROM summary_history WHERE id = ?').get(summary_id);
    if (!summary) return res.status(404).json({ error: 'Summary not found' });

    const history = db.prepare('SELECT role, content FROM chat_messages WHERE summary_id = ? ORDER BY created_at DESC LIMIT 10').all(summary_id).reverse();

    const now = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at) VALUES (?,?,?,?)').run(summary_id, 'user', message, now);

    const messages = [
      { role: 'system', content: `You are a helpful news analyst. Answer questions about the following news summary. Be concise and factual.\n\nNews Summary:\n${summary.summary}` },
      ...history,
      { role: 'user', content: message },
    ];

    const result = await callLLM(messages, { purpose: 'chat', categoryId: summary.category_id, providerId: selectedProvider || null, db });

    const replyTime = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (summary_id, role, content, created_at) VALUES (?,?,?,?)').run(summary_id, 'assistant', result.content, replyTime);

    res.json({ role: 'assistant', content: result.content, created_at: replyTime });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
});

router.get('/:summaryId', (req, res) => {
  const messages = db.prepare('SELECT * FROM chat_messages WHERE summary_id = ? ORDER BY created_at ASC').all(req.params.summaryId);
  res.json(messages);
});

module.exports = router;
