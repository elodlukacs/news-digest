const express = require('express');
const { searchAllSources } = require('../../lib/bias-radar/newsSearch');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const title = req.query.articleId;
    const source = req.query.source;
    
    console.log('[Related] Request:', { title, source });
    
    if (!title) {
      return res.status(400).json({ error: 'Missing articleId' });
    }

    const related = await searchAllSources(title, source || null);
    
    console.log('[Related] Returning:', related.length, 'articles');

    const articles = related.map(a => ({
      id: a.url,
      title: a.title,
      url: a.url,
      source: a.source,
      biasRating: a.biasRating,
      publishedAt: a.publishedAt,
      excerpt: a.excerpt,
    }));

    return res.json({ articles });
  } catch (err) {
    console.error('[BiasRadar] Related error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;