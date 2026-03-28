const express = require('express');
const { searchAllSources } = require('../../lib/bias-radar/newsSearch');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const title = req.query.articleId;
    const source = req.query.source;
<<<<<<< HEAD
    const language = req.query.language || 'English';
    
    console.log('[Related] Request:', { title, source, language });
=======
    
    console.log('[Related] Request:', { title, source });
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
    
    if (!title) {
      return res.status(400).json({ error: 'Missing articleId' });
    }

<<<<<<< HEAD
    const related = await searchAllSources(title, source || null, language);
=======
    const related = await searchAllSources(title, source || null);
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
    
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