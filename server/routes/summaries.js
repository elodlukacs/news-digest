const express = require('express');
const db = require('../db');
const { parser } = require('../lib/rss');
const { callLLM: rawCallLLM } = require('../lib/llm');
const validateId = require('../middleware/validateId');
const { extractKeywords } = require('../lib/bias-radar/topicCluster');
const { buildMessages } = require('../lib/promptManager');

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
            description: (item.contentSnippet || item.content || '').slice(0, 3000),
            contentEncoded: (item['content:encoded'] || '').slice(0, 5000),
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

    const { provider: selectedProvider, keyword } = req.body || {};
    const keywordTrim = keyword?.trim() || '';

    let allArticles = feedResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 30);

    if (keywordTrim) {
      const kw = keywordTrim.toLowerCase();
      allArticles = allArticles.filter(
        (a) => a.title.toLowerCase().includes(kw) || a.description.toLowerCase().includes(kw)
      );
      if (allArticles.length === 0) {
        return res.status(400).json({ error: `No articles found matching "${keywordTrim}"` });
      }
    }

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
        const fullContent = a.contentEncoded || a.content || a.description || '';
        insertArticle.run(req.params.id, a.source, a.title, a.description || '', a.link, a.pubDate, now, deriveTopicId(a.title), fullContent);
      }
    });
    insertArticles(allArticles);

    const articleText = allArticles
      .map((a, i) => `[${i + 1}] ${a.title} (${a.source})\n${a.description}\nLink: ${a.link}`)
      .join('\n\n');

    const customPrompt = category.custom_prompt?.trim();
    const lang = category.language || 'English';
    const keywordSection = keywordTrim ? `\nFocus only on news related to: "${keywordTrim}"\n` : '';
    const customPromptSection = (customPrompt ? `\nAdditional instructions:\n${customPrompt}\n` : '') + keywordSection;

    const messages = buildMessages('category-summary', {
      category: category.name,
      lang,
      customPrompt: customPromptSection,
      articles: articleText,
    });
    const result = await callLLM(messages, { purpose: 'summary', categoryId: Number(req.params.id), providerId: selectedProvider || null, db });
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

    const sentimentData = parsedArticles.map(a => {
      const original = allArticles.find(orig =>
        orig.link === a.url || orig.title.toLowerCase() === (a.title || '').toLowerCase()
      );
      return {
        title: a.title,
        sentiment: ['positive', 'negative', 'neutral', 'mixed'].includes(a.sentiment) ? a.sentiment : 'neutral',
        tags: Array.isArray(a.tags) ? a.tags : [],
        original_content: original ? original.description : '',
        source: original ? original.source : '',
        pub_date: original ? original.pubDate : '',
      };
    });

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
          const parsed = await parser.parseURL(feed.url);
          return parsed.items.slice(0, 10).map((item) => ({
            title: item.title || '',
            description: (item.contentSnippet || item.content || '').slice(0, 3000),
            link: item.link || '',
            pubDate: item.pubDate || '',
            source: feed.name,
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
