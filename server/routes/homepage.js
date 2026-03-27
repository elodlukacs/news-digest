const express = require('express');
const { parser, extractImage } = require('../lib/rss');
const db = require('../db');

const router = express.Router();

let homepageCache = { data: null, fetchedAt: 0 };

async function fetchHomepageBriefs() {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  if (categories.length === 0) return [];

  const getFirstFeed = db.prepare('SELECT * FROM feeds WHERE category_id = ? ORDER BY id ASC LIMIT 1');

  const results = await Promise.allSettled(
    categories.map(async (cat) => {
      const feed = getFirstFeed.get(cat.id);
      if (!feed) return null;

      try {
        const parsed = await parser.parseURL(feed.url);
        const articles = parsed.items.slice(0, 10).map((item) => {
          const snippet = (item.contentSnippet || item.content || '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 400);

          return {
            title: item.title || '',
            excerpt: snippet,
            link: item.link || '',
            image: extractImage(item),
            pubDate: item.pubDate || '',
            source: feed.name,
          };
        }).filter(a => a.image);

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          articles,
        };
      } catch (err) {
        console.warn(`Homepage: failed to fetch "${feed.name}" (${feed.url}):`, err.message);
        return { categoryId: cat.id, categoryName: cat.name, articles: [] };
      }
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value)
    .filter((b) => b.articles.length > 0);
}

router.get('/', async (req, res) => {
  if (homepageCache.data && Date.now() - homepageCache.fetchedAt < 5 * 60_000) {
    return res.json(homepageCache.data);
  }
  try {
    const briefs = await fetchHomepageBriefs();
    homepageCache = { data: briefs, fetchedAt: Date.now() };
    res.json(briefs);
  } catch (err) {
    console.error('Homepage error:', err);
    res.status(500).json({ error: 'Failed to fetch homepage data' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    homepageCache = { data: null, fetchedAt: 0 };
    const briefs = await fetchHomepageBriefs();
    homepageCache = { data: briefs, fetchedAt: Date.now() };
    res.json(briefs);
  } catch (err) {
    console.error('Homepage refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh homepage' });
  }
});

module.exports = router;
