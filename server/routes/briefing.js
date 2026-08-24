const express = require('express');
const { parseFeedUrl } = require('../lib/rss');
const { callLLM: rawCallLLM } = require('../lib/llm');
const db = require('../db');
const { buildMessages } = require('../lib/promptManager');
const { lockHandler } = require('../lib/inFlight');
const { matchOutlet } = require('../lib/outletMatcher');

const callLLM = (messages, opts) => rawCallLLM(messages, { ...opts, db });
const router = express.Router();

// A category summary generated within this window is reused instead of
// re-fetching and re-summarising the same articles.
const FRESH_SUMMARY_MS = Number(process.env.BRIEFING_REUSE_WINDOW_MS) || 6 * 60 * 60 * 1000;
const MAX_ARTICLES = Number(process.env.BRIEFING_MAX_ARTICLES) || 30;
const PER_FEED_LIMIT = 5;

const WORDS_PER_MINUTE = 220;

/**
 * Newest category summary per category, if recent enough to reuse.
 *
 * The briefing used to re-fetch RSS and run a second full LLM pass over
 * articles that `refreshCategorySummary` had summarised minutes earlier. Using
 * the stored summary makes this a map-reduce instead of a second map: cheaper,
 * faster, and consistent with what the user just read.
 */
function getFreshSummaries(categories) {
  const stmt = db.prepare(`
    SELECT summary, sentiment_data, generated_at
    FROM summary_history
    WHERE category_id = ? AND generated_at >= ?
    ORDER BY generated_at DESC LIMIT 1
  `);
  const cutoff = new Date(Date.now() - FRESH_SUMMARY_MS).toISOString();

  const fresh = [];
  const stale = [];
  for (const cat of categories) {
    const row = stmt.get(cat.id, cutoff);
    if (row) fresh.push({ category: cat, row });
    else stale.push(cat);
  }
  return { fresh, stale };
}

/** Live fetch, used only for categories with no recent summary. */
async function fetchCategoryArticles(categories) {
  // Every feed in the category, not just the oldest-added one. The previous
  // `ORDER BY id ASC LIMIT 1` silently ignored every other feed, so a curated
  // six-feed category was represented by whichever feed happened to be first.
  const getFeeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?');

  const perCategory = await Promise.all(categories.map(async (cat) => {
    const feeds = getFeeds.all(cat.id);
    if (feeds.length === 0) return { category: cat, articles: [] };

    const results = await Promise.allSettled(feeds.map(async (feed) => {
      const parsed = await parseFeedUrl(feed.url);
      return parsed.items.slice(0, PER_FEED_LIMIT).map(item => ({
        title: item.title || '',
        description: (item.contentSnippet || item.content || '').slice(0, 500),
        link: item.link || '',
        pubDate: item.pubDate || '',
        source: feed.name,
        category: cat.name,
      }));
    }));

    for (const [i, r] of results.entries()) {
      if (r.status === 'rejected') {
        console.warn(`[briefing] feed "${feeds[i].name}" failed:`, r.reason?.message);
      }
    }

    return {
      category: cat,
      articles: results.filter(r => r.status === 'fulfilled').flatMap(r => r.value),
    };
  }));

  return perCategory;
}

router.post('/generate', lockHandler('briefing:generate'), async (req, res, next) => {
  const { provider: selectedProvider } = req.body || {};
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    if (categories.length === 0) return res.status(400).json({ error: 'No categories' });

    const { fresh, stale } = getFreshSummaries(categories);
    const liveResults = stale.length > 0 ? await fetchCategoryArticles(stale) : [];

    const sections = [];
    const sentimentEntries = [];
    let sourceCount = 0;

    for (const { category, row } of fresh) {
      sections.push(`### ${category.name} (already summarised)\n${row.summary}`);
      try {
        const parsedSentiment = row.sentiment_data ? JSON.parse(row.sentiment_data) : [];
        if (Array.isArray(parsedSentiment)) {
          sentimentEntries.push(...parsedSentiment);
          sourceCount += new Set(parsedSentiment.map(s => s.source).filter(Boolean)).size;
        }
      } catch { /* malformed sentiment_data — skip enrichment for this one */ }
    }

    let liveArticleCount = 0;
    for (const { category, articles } of liveResults) {
      if (articles.length === 0) continue;
      liveArticleCount += articles.length;
      sourceCount += new Set(articles.map(a => a.source)).size;
      const text = articles
        .slice(0, PER_FEED_LIMIT * 3)
        .map((a, i) => `[${i + 1}] ${a.title} (${a.source})\n${a.description}\nLink: ${a.link}`)
        .join('\n\n');
      sections.push(`### ${category.name} (raw headlines)\n${text}`);

      for (const a of articles) {
        const rating = matchOutlet(a.source);
        sentimentEntries.push({
          title: a.title,
          source: a.source,
          pub_date: a.pubDate,
          sentiment: 'neutral',
          tags: [],
          ...(rating && {
            bias: rating.bias,
            credibility: rating.credibility,
            factCheckGrade: rating.factCheckGrade,
          }),
        });
      }
    }

    if (sections.length === 0) {
      return res.status(400).json({ error: 'No summaries or articles available to build a briefing' });
    }

    const lang = categories[0]?.language || 'English';
    const result = await callLLM(
      buildMessages('morning-briefing', {
        lang,
        articles: sections.join('\n\n---\n\n'),
      }),
      { purpose: 'briefing', providerId: selectedProvider || null }
    );

    const generated_at = new Date().toISOString();
    const dateKey = generated_at.split('T')[0];
    const articleCount = sentimentEntries.length || liveArticleCount;
    const readingMinutes = Math.max(1, Math.round(result.content.split(/\s+/).length / WORDS_PER_MINUTE));

    // sentiment_data was previously left NULL, so briefing sections rendered
    // without source badges, bias bars or credibility, and contributed nothing
    // to trending tags.
    const tags = [...new Set(sentimentEntries.flatMap(e => e.tags || []))];

    db.prepare(`
      INSERT INTO summary_history
        (category_id, summary, article_count, feed_count, provider, sentiment_data, tags_data, date_key, generated_at)
      VALUES (0,?,?,?,?,?,?,?,?)
    `).run(
      result.content, articleCount, sourceCount, result.provider,
      JSON.stringify(sentimentEntries), JSON.stringify(tags), dateKey, generated_at
    );

    res.json({
      summary: result.content,
      generated_at,
      provider: result.provider,
      feed_count: sourceCount,
      article_count: articleCount,
      reading_minutes: readingMinutes,
      reused_categories: fresh.map(f => f.category.name),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/latest', (req, res) => {
  const latest = db.prepare('SELECT * FROM summary_history WHERE category_id = 0 ORDER BY generated_at DESC LIMIT 1').get();
  if (!latest) return res.json({ summary: null });
  res.json({
    summary: latest.summary,
    generated_at: latest.generated_at,
    provider: latest.provider,
    feed_count: latest.feed_count,
    article_count: latest.article_count,
    reading_minutes: Math.max(1, Math.round(String(latest.summary).split(/\s+/).length / WORDS_PER_MINUTE)),
  });
});

module.exports = router;
