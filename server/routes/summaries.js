const express = require('express');
const db = require('../db');
const { parser } = require('../lib/rss');
const { callLLM: rawCallLLM } = require('../lib/llm');
const validateId = require('../middleware/validateId');
const { extractKeywords } = require('../lib/bias-radar/topicCluster');

const router = express.Router();

const callLLM = (messages, opts) => rawCallLLM(messages, { ...opts, db });

function deriveTopicId(title) {
  return extractKeywords(title).sort().slice(0, 5).join('-');
}

router.get('/:id/summary', validateId, (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const { date, summary_id } = req.query;

  if (summary_id) {
    const hist = db.prepare('SELECT * FROM summary_history WHERE id = ? AND category_id = ?').get(summary_id, req.params.id);
    if (hist) {
      return res.json({
        id: hist.id,
        category: category.name,
        summary: hist.summary,
        article_count: hist.article_count,
        feed_count: hist.feed_count,
        generated_at: hist.generated_at,
        provider: hist.provider,
        sentiment_data: hist.sentiment_data ? JSON.parse(hist.sentiment_data) : null,
        tags_data: hist.tags_data ? JSON.parse(hist.tags_data) : null,
      });
    }
    return res.json({ category: category.name, summary: null });
  }

  if (date) {
    const hist = db.prepare('SELECT * FROM summary_history WHERE category_id = ? AND date_key = ? ORDER BY generated_at DESC LIMIT 1').get(req.params.id, date);
    if (hist) {
      return res.json({
        id: hist.id,
        category: category.name,
        summary: hist.summary,
        article_count: hist.article_count,
        feed_count: hist.feed_count,
        generated_at: hist.generated_at,
        provider: hist.provider,
        sentiment_data: hist.sentiment_data ? JSON.parse(hist.sentiment_data) : null,
        tags_data: hist.tags_data ? JSON.parse(hist.tags_data) : null,
      });
    }
    return res.json({ category: category.name, summary: null });
  }

  const latest = db.prepare('SELECT * FROM summary_history WHERE category_id = ? ORDER BY generated_at DESC LIMIT 1').get(req.params.id);
  if (latest) {
    return res.json({
      id: latest.id,
      category: category.name,
      summary: latest.summary,
      article_count: latest.article_count,
      feed_count: latest.feed_count,
      generated_at: latest.generated_at,
      provider: latest.provider,
      sentiment_data: latest.sentiment_data ? JSON.parse(latest.sentiment_data) : null,
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
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(req.params.id);
    if (feeds.length === 0) return res.status(400).json({ error: 'No feeds in this category' });

    const feedResults = await Promise.allSettled(
      feeds.map(async (feed) => {
        try {
          const parsed = await parser.parseURL(feed.url);
          return parsed.items.slice(0, 10).map((item) => ({
            title: item.title || '',
            description: (item.contentSnippet || item.content || '').slice(0, 500),
            link: item.link || '',
            pubDate: item.pubDate || '',
            source: feed.name,
          }));
        } catch (err) {
          console.warn(`Failed to fetch feed "${feed.name}" (${feed.url}):`, err.message);
          return [];
        }
      })
    );

    const allArticles = feedResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 30);

    if (allArticles.length === 0) {
      return res.status(400).json({ error: 'Could not fetch any articles from the feeds' });
    }

    const now = new Date().toISOString();
    const existingCount = db.prepare('SELECT COUNT(*) as c FROM articles WHERE category_id = ?').get(req.params.id).c;
    if (existingCount > 200) {
      db.prepare('DELETE FROM articles WHERE category_id = ? AND id NOT IN (SELECT id FROM articles WHERE category_id = ? ORDER BY fetched_at DESC LIMIT 200)').run(req.params.id, req.params.id);
    }
    const insertArticle = db.prepare('INSERT INTO articles (category_id, feed_name, title, description, link, pub_date, fetched_at, topic_id, body_text) VALUES (?,?,?,?,?,?,?,?,?)');
    const insertArticles = db.transaction((arts) => {
      for (const a of arts) {
        insertArticle.run(req.params.id, a.source, a.title, a.description, a.link, a.pubDate, now, deriveTopicId(a.title), a.description);
      }
    });
    insertArticles(allArticles);

    const articleText = allArticles
      .map((a, i) => `[${i + 1}] ${a.title} (${a.source})\n${a.description}\nLink: ${a.link}`)
      .join('\n\n');

    const customPrompt = category.custom_prompt?.trim();
    const lang = category.language || 'English';
    const prompt = `You are a news analyst. Summarize the most important news from the "${category.name}" category.

IMPORTANT: Write your response in ${lang} ONLY.

Respond ONLY with valid JSON (no markdown fences, no extra text). The root object MUST have an "articles" key. Use this exact structure:
{"articles":[{"title":"Article Title","url":"https://example.com/article","summary":"2-3 sentences about this topic. Be direct and factual.","sentiment":"positive","tags":["tag1","tag2"]}]}

Rules:
- Include 6-8 articles (no more than 8)
- "title": the article's original title
- "url": the article's original URL
- "summary": 2-3 factual sentences in ${lang}
- "sentiment": one of "positive", "negative", "neutral", or "mixed" — classify the overall tone of the news (good news = positive, bad news = negative, both = mixed, purely informational = neutral)
- "tags": 2-3 short topic keywords in English (e.g. "climate", "AI", "economy")
- Never repeat information across articles
- No intro, no conclusion, no commentary
${customPrompt ? `\nAdditional instructions:\n${customPrompt}\n` : ''}
Articles to summarize:
${articleText}`;

    const messages = [
      { role: 'system', content: 'You are a professional news analyst. Provide thorough, well-structured summaries with depth and context. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ];

    const { provider: selectedProvider } = req.body || {};
    const result = await callLLM(messages, { purpose: 'summary', categoryId: Number(req.params.id), providerId: selectedProvider || null });
    const generated_at = new Date().toISOString();
    const dateKey = generated_at.split('T')[0];

    let rawContent = (result.content || '').trim();
    if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    function repairAndParseJSON(str) {
      try { return JSON.parse(str); } catch {}

      let fixed = str;
      fixed = fixed.replace(/,\s*([}\]])/g, '$1');

      try { return JSON.parse(fixed); } catch {}

      const lastCompleteObj = fixed.lastIndexOf('}');
      if (lastCompleteObj > 0) {
        let truncated = fixed.slice(0, lastCompleteObj + 1);
        truncated = truncated.replace(/,\s*$/, '');
        const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/\]/g) || []).length;
        const openBraces = (truncated.match(/\{/g) || []).length - (truncated.match(/\}/g) || []).length;
        truncated += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
        try { return JSON.parse(truncated); } catch {}
      }

      return null;
    }

    let parsedArticles;
    const parsed = repairAndParseJSON(rawContent);
    if (parsed) {
      if (Array.isArray(parsed)) {
        parsedArticles = parsed;
      } else if (parsed.articles) {
        parsedArticles = parsed.articles;
      } else if (parsed.groups && Array.isArray(parsed.groups)) {
        parsedArticles = parsed.groups.flatMap(g => g.articles || []);
      } else {
        parsedArticles = parsed.items || parsed.data || [];
      }
      if (parsedArticles.length === 0) {
        console.warn('[Summary] Parsed JSON has no articles. Keys:', Object.keys(parsed || {}));
        console.warn('[Summary] Raw content (first 1000 chars):', rawContent.slice(0, 1000));
      }
    } else {
      console.error('[Summary] Could not parse or repair LLM JSON response');
      console.error('[Summary] Raw content (first 1000 chars):', rawContent.slice(0, 1000));
      return res.status(500).json({ error: 'LLM returned invalid response format. Please try again.' });
    }

    const summary = parsedArticles.map(a =>
      `## [${a.title}](${a.url})\n${a.summary}`
    ).join('\n\n---\n\n');

    const sentimentData = parsedArticles.map(a => ({
      title: a.title,
      sentiment: ['positive', 'negative', 'neutral', 'mixed'].includes(a.sentiment) ? a.sentiment : 'neutral',
      tags: Array.isArray(a.tags) ? a.tags : [],
    }));

    const tagSet = new Set();
    for (const s of sentimentData) {
      for (const tag of s.tags) tagSet.add(tag);
    }
    const tagsData = [...tagSet];

    db.prepare(`
      INSERT INTO summaries (category_id, summary, article_count, feed_count, generated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(category_id) DO UPDATE SET
        summary = excluded.summary,
        article_count = excluded.article_count,
        feed_count = excluded.feed_count,
        generated_at = excluded.generated_at
    `).run(req.params.id, summary, allArticles.length, feeds.length, generated_at);

    const histResult = db.prepare('INSERT INTO summary_history (category_id, summary, article_count, feed_count, provider, sentiment_data, tags_data, date_key, generated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
      req.params.id, summary, allArticles.length, feeds.length, result.provider, JSON.stringify(sentimentData), JSON.stringify(tagsData), dateKey, generated_at
    );
    const historyId = histResult.lastInsertRowid;

    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const oldIds = db.prepare('SELECT id FROM summary_history WHERE category_id = ? AND date_key < ?').all(req.params.id, cutoff).map(r => r.id);
    if (oldIds.length > 0) {
      db.prepare(`DELETE FROM chat_messages WHERE summary_id IN (${oldIds.map(() => '?').join(',')})`).run(...oldIds);
      db.prepare('DELETE FROM summary_history WHERE category_id = ? AND date_key < ?').run(req.params.id, cutoff);
    }

    res.json({
      id: historyId,
      category: category.name,
      summary,
      article_count: allArticles.length,
      feed_count: feeds.length,
      generated_at,
      provider: result.provider,
      sentiment_data: sentimentData,
      tags_data: tagsData,
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate summary' });
  }
});

module.exports = router;
