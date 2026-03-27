const express = require('express');
const { parser } = require('../lib/rss');
const { callLLM: rawCallLLM } = require('../lib/llm');
const db = require('../db');

const callLLM = (messages, opts) => rawCallLLM(messages, { ...opts, db });
const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    if (categories.length === 0) return res.status(400).json({ error: 'No categories' });

    const getFirstFeed = db.prepare('SELECT * FROM feeds WHERE category_id = ? ORDER BY id ASC LIMIT 1');
    const feedsWithCategories = categories
      .map(cat => ({ ...getFirstFeed.get(cat.id), categoryName: cat.name, language: cat.language }))
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
              pubDate: item.pubDate || ''
            }))
          };
        } catch (err) {
          console.warn(`Failed to fetch feed "${feed.name}" (${feed.url}):`, err.message);
          return { category: feed.categoryName, source: feed.name, articles: [] };
        }
      })
    );

    const allArticles = feedResults
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.articles)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 30);

    if (allArticles.length === 0) return res.status(400).json({ error: 'Could not fetch any articles from feeds' });

    const lang = categories[0]?.language || 'English';

    const articleText = allArticles
      .map((a, i) => `[${i + 1}] ${a.title} (${a.source})\n${a.description}\nLink: ${a.link}`)
      .join('\n\n');

    const result = await callLLM([
      { role: 'system', content: 'You are an editor-in-chief writing a brief morning news briefing.' },
      { role: 'user', content: `Create a very concise morning briefing from the following news articles. Write in ${lang}.

Rules:
- Create a bullet-point list with **bold titles** for each story
- Each bullet point: 1-2 sentences maximum
- Include the source name in parentheses after each bullet
- Highlight the most important 3-5 stories first, then other notable stories
- Be extremely concise — this is a brief aggregation, not a detailed summary
- No intro text like "Good morning" — start directly with the first story
- No horizontal rules or section headers needed

Articles:
${articleText}` },
    ], { purpose: 'briefing' });

    const generated_at = new Date().toISOString();
    const dateKey = generated_at.split('T')[0];

    db.prepare('INSERT INTO summary_history (category_id, summary, article_count, feed_count, provider, date_key, generated_at) VALUES (?,?,?,?,?,?,?)').run(
      0, result.content, allArticles.length, feedsWithCategories.length, result.provider, dateKey, generated_at
    );

    const briefingCutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    db.prepare('DELETE FROM summary_history WHERE category_id = 0 AND date_key < ?').run(briefingCutoff);

    res.json({ summary: result.content, generated_at, provider: result.provider, feed_count: feedsWithCategories.length, article_count: allArticles.length });
  } catch (err) {
    console.error('Briefing error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate briefing' });
  }
});

router.get('/latest', (req, res) => {
  const latest = db.prepare('SELECT * FROM summary_history WHERE category_id = 0 ORDER BY generated_at DESC LIMIT 1').get();
  if (!latest) return res.json({ summary: null });
  res.json({ summary: latest.summary, generated_at: latest.generated_at, provider: latest.provider, feed_count: latest.feed_count });
});

module.exports = router;
