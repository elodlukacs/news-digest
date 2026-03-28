const express = require('express');
const db = require('../../db');
const { findRelatedArticles } = require('../../lib/bias-radar/topicCluster');
const { getBiasRating } = require('../../lib/bias-radar/biasRatings');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const articleId = req.query.articleId;
    if (!articleId) {
      return res.status(400).json({ error: 'Missing articleId' });
    }

    const allArticles = getAllArticles();

    // Match by URL (articleId is the article link) or numeric ID
    const numericId = parseInt(articleId, 10);
    const targetId = !isNaN(numericId)
      ? numericId
      : allArticles.find(a => a.url === articleId)?.id;

    if (!targetId) {
      return res.json({ articles: [] });
    }

    const related = findRelatedArticles(allArticles, targetId, {
      windowHours: 72,
      maxResults: 3,
      minOverlap: 2,
    });

    return res.json({ articles: related });
  } catch (err) {
    console.error('[BiasRadar] Related error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

function getAllArticles() {
  const articles = db.prepare(`
    SELECT id, title, link as url, feed_name, description, pub_date as publishedAt
    FROM articles
    WHERE pub_date IS NOT NULL
    ORDER BY pub_date DESC
    LIMIT 500
  `).all();

  return articles.map(article => ({
    ...article,
    source: article.feed_name,
    biasRating: getBiasRating(article.url) || 'center',
    excerpt: article.description ? article.description.slice(0, 400) : '',
  }));
}

module.exports = router;
