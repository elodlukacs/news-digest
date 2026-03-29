const express = require('express');
const db = require('../../db');
const { getBiasRating } = require('../../lib/bias-radar/biasRatings');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const articles = db.prepare(`
      SELECT id, title, link as url, feed_name as source, description as excerpt, pub_date as publishedAt
      FROM articles
      WHERE pub_date IS NOT NULL AND title IS NOT NULL
      ORDER BY pub_date DESC
      LIMIT 100
    `).all();

    if (articles.length === 0) {
      return res.json({ 
        error: 'No articles available for daily quiz',
        article: null 
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
    const quizArticle = articles[seed % articles.length];

    return res.json({
      article: {
        id: quizArticle.id,
        headline: quizArticle.title,
        content: quizArticle.excerpt || '',
        source: quizArticle.source,
        url: quizArticle.url,
        biasRating: getBiasRating(quizArticle.url) || 'center',
        publishedAt: quizArticle.publishedAt,
      },
      date: today,
    });
  } catch (err) {
    console.error('[DailyQuiz] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;