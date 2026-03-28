const express = require('express');
const { escTg, splitTgMessage } = require('../lib/telegram');
const { parser } = require('../lib/rss');
const { callLLM: rawCallLLM } = require('../lib/llm');
const db = require('../db');

const callLLM = (messages, opts) => rawCallLLM(messages, { ...opts, db });
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

// ─── Digest: generate overall news summary from all categories and send to Telegram ───

router.post('/digest', async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return res.status(500).json({ error: 'Telegram not configured' });

  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    if (categories.length === 0) return res.status(400).json({ error: 'No categories' });

    const getFeeds = db.prepare('SELECT * FROM feeds WHERE category_id = ? ORDER BY id ASC');
    const feedsWithCategories = categories
      .flatMap(cat => {
        const feeds = getFeeds.all(cat.id);
        return feeds.map(f => ({ ...f, categoryName: cat.name, language: cat.language }));
      })
      .filter(f => f && f.url);

    if (feedsWithCategories.length === 0) return res.status(400).json({ error: 'No feeds available' });

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
              pubDate: item.pubDate || '',
              source: feed.name,
              category: feed.categoryName,
            }))
          };
        } catch (err) {
          console.warn(`Digest: failed to fetch feed "${feed.name}":`, err.message);
          return { category: feed.categoryName, source: feed.name, articles: [] };
        }
      })
    );

    const allArticles = feedResults
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.articles);

    if (allArticles.length === 0) return res.status(400).json({ error: 'Could not fetch any articles' });

    // Group by category for the prompt
    const byCategory = {};
    for (const a of allArticles) {
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push(a);
    }

    const articleText = Object.entries(byCategory)
      .map(([cat, articles]) => {
        const items = articles.slice(0, 8).map((a, i) => `  ${i + 1}. ${a.title} (${a.source})\n     ${a.description}`).join('\n');
        return `## ${cat}\n${items}`;
      })
      .join('\n\n');

    const lang = categories[0]?.language || 'English';

    const result = await callLLM([
      { role: 'system', content: 'You are an editor-in-chief writing a comprehensive daily news digest.' },
      { role: 'user', content: `Create a detailed daily news digest from the following articles, organized by topic. Write in ${lang}.

Rules:
- Organize by topic/category using **bold section headers**
- For each topic, write 2-4 sentences summarizing the key stories and developments
- Mention source names in parentheses where relevant
- Cover all topics provided — don't skip any category
- Be informative but concise — this is a digest, not full articles
- No greeting or sign-off — start directly with the first topic
- Use plain text with Telegram-compatible Markdown (*bold*, _italic_)

Articles by topic:
${articleText}` },
    ], { purpose: 'telegram-digest' });

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const header = `📰 *The Daily Digest*\n_${escTg(today)} — ${escTg(allArticles.length + ' articles from ' + feedsWithCategories.length + ' sources')}_`;
    const fullText = `${header}\n\n${result.content}`;
    const chunks = splitTgMessage(fullText, 4096);

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
        console.error('Telegram digest error:', data);
        return res.status(500).json({ error: data.description || 'Telegram API error' });
      }
    }

    res.json({ success: true, article_count: allArticles.length, category_count: categories.length });
  } catch (err) {
    console.error('Telegram digest error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate and send digest' });
  }
});

module.exports = router;
