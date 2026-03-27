const express = require('express');
const { escTg, splitTgMessage } = require('../lib/telegram');
const db = require('../db');

const router = express.Router();

router.post('/send', async (req, res) => {
  const { categoryId } = req.body;
  if (!categoryId && categoryId !== 0) return res.status(400).json({ error: 'categoryId required' });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return res.status(500).json({ error: 'Telegram not configured' });

  let cat, row;

  if (categoryId === 0) {
    row = db.prepare(
      "SELECT summary, article_count, feed_count, generated_at FROM summary_history WHERE category_id = 0 ORDER BY generated_at DESC LIMIT 1"
    ).get();
    if (!row) return res.status(404).json({ error: 'No briefing found' });
    cat = { name: 'Morning Briefing' };
  } else {
    cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(categoryId);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    row = db.prepare(
      "SELECT summary, article_count, feed_count, generated_at FROM summary_history WHERE category_id = ? ORDER BY generated_at DESC LIMIT 1"
    ).get(categoryId);
  }
  if (!row) return res.status(404).json({ error: 'No summary found for this category' });

  const header = `📰 *${escTg(cat.name)}*\n_${escTg(row.article_count + ' articles from ' + row.feed_count + ' sources')}_\n_${escTg(new Date(row.generated_at).toLocaleString())}_`;
  const body = row.summary;

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

module.exports = router;
