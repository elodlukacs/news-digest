const express = require('express');
const db = require('../db');
const { parseFeedUrl, extractImage } = require('../lib/rss');
const { callLLM: rawCallLLM } = require('../lib/llm');
const validateId = require('../middleware/validateId');
const { refreshCategorySummary, enrichSentimentData, RefreshError } = require('../jobs/refreshSummary');
const { runExclusive } = require('../lib/inFlight');

const router = express.Router();

const callLLM = (messages, opts) => rawCallLLM(messages, { ...opts, db });

router.get('/:id/summary', validateId, (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const { date, summary_id } = req.query;

  if (summary_id) {
    const hist = db.prepare('SELECT * FROM summary_history WHERE id = ? AND category_id = ?').get(summary_id, req.params.id);
    if (hist) {
      const parsedSentiment = hist.sentiment_data ? JSON.parse(hist.sentiment_data) : null;
      return res.json({
        id: hist.id,
        category: category.name,
        summary: hist.summary,
        article_count: hist.article_count,
        feed_count: hist.feed_count,
        generated_at: hist.generated_at,
        provider: hist.provider,
        sentiment_data: enrichSentimentData(parsedSentiment),
        tags_data: hist.tags_data ? JSON.parse(hist.tags_data) : null,
      });
    }
    return res.json({ category: category.name, summary: null });
  }

  if (date) {
    const hist = db.prepare('SELECT * FROM summary_history WHERE category_id = ? AND date_key = ? ORDER BY generated_at DESC LIMIT 1').get(req.params.id, date);
    if (hist) {
      const parsedSentiment = hist.sentiment_data ? JSON.parse(hist.sentiment_data) : null;
      return res.json({
        id: hist.id,
        category: category.name,
        summary: hist.summary,
        article_count: hist.article_count,
        feed_count: hist.feed_count,
        generated_at: hist.generated_at,
        provider: hist.provider,
        sentiment_data: enrichSentimentData(parsedSentiment),
        tags_data: hist.tags_data ? JSON.parse(hist.tags_data) : null,
      });
    }
    return res.json({ category: category.name, summary: null });
  }

  const latest = db.prepare('SELECT * FROM summary_history WHERE category_id = ? ORDER BY generated_at DESC LIMIT 1').get(req.params.id);
  if (latest) {
    const parsedSentiment = latest.sentiment_data ? JSON.parse(latest.sentiment_data) : null;
    return res.json({
      id: latest.id,
      category: category.name,
      summary: latest.summary,
      article_count: latest.article_count,
      feed_count: latest.feed_count,
      generated_at: latest.generated_at,
      provider: latest.provider,
      sentiment_data: enrichSentimentData(parsedSentiment),
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

  res.json({ category: category.name, summary: null });
});

router.get('/:id/history', validateId, (req, res) => {
  const rows = db.prepare('SELECT id, date_key, generated_at FROM summary_history WHERE category_id = ? ORDER BY date_key DESC LIMIT 30').all(req.params.id);
  res.json(rows);
});

router.post('/:id/refresh', validateId, async (req, res) => {
  try {
    const { provider, keyword } = req.body || {};
    const categoryId = Number(req.params.id);
    // Double-clicking Refresh would otherwise run two full feed-fetch + LLM
    // cycles and write two history rows; the second caller joins the first run.
    const result = await runExclusive(
      `refresh:${categoryId}:${keyword || ''}`,
      () => refreshCategorySummary(db, callLLM, categoryId, { provider, keyword })
    );
    res.json(result);
  } catch (err) {
    if (err instanceof RefreshError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('Summary error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate summary' });
  }
});

// ─── Lens endpoint: fun/focused summarization using a selected prompt ───
router.post('/:id/lens', validateId, async (req, res) => {
  try {
    const { lensSlug, provider } = req.body || {};
    if (!lensSlug?.trim()) {
      return res.status(400).json({ error: 'lensSlug required' });
    }
    if (lensSlug.trim().length > 100) {
      return res.status(400).json({ error: 'Invalid lensSlug' });
    }

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(req.params.id);
    if (feeds.length === 0) return res.status(400).json({ error: 'No feeds in this category' });

    // Fetch the lens prompt
    const lensPrompt = db.prepare('SELECT * FROM prompts WHERE slug = ?').get(lensSlug.trim());
    if (!lensPrompt) return res.status(400).json({ error: 'Unknown lens' });

    // Fetch articles from feeds (same as refresh)
    const feedResults = await Promise.allSettled(
      feeds.map(async (feed) => {
        try {
          const parsed = await parseFeedUrl(feed.url);
          return parsed.items.slice(0, 10).map((item) => ({
            title: item.title || '',
            description: (item.contentSnippet || item.content || '').slice(0, 3000),
            link: item.link || '',
            pubDate: item.pubDate || '',
            source: feed.name,
            image: extractImage(item),
          }));
        } catch (err) {
          console.warn(`Lens: failed to fetch feed "${feed.name}":`, err.message);
          return [];
        }
      })
    );

    const allArticles = feedResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 15);

    if (allArticles.length === 0) {
      return res.status(400).json({ error: 'Could not fetch any articles from the feeds' });
    }

    const articleText = allArticles
      .map((a, i) => `[${i + 1}] ${a.title} (${a.source})\n${a.description}\nLink: ${a.link}`)
      .join('\n\n');

    // Build messages using the lens prompt's system + user prompt
    const renderedUser = (lensPrompt.user_prompt || '')
      .replace(/\{\{category\}\}/g, category.name || '')
      .replace(/\{\{articles\}\}/g, articleText);

    const messages = [];
    if (lensPrompt.system_message) {
      messages.push({ role: 'system', content: lensPrompt.system_message });
    }
    messages.push({ role: 'user', content: renderedUser });

    const result = await callLLM(messages, {
      purpose: 'lens',
      categoryId: Number(req.params.id),
      providerId: provider || null,
      temperature: 0.7,
      db,
    });

    res.json({
      lens: lensSlug,
      lensName: lensPrompt.name,
      content: result.content,
      provider: result.provider,
      generated_at: new Date().toISOString(),
      article_count: allArticles.length,
    });
  } catch (err) {
    console.error('Lens error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate lens summary' });
  }
});

module.exports = router;
