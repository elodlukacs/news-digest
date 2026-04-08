const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const article = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.pub_date > datetime('now', '-48 hours')
    AND LENGTH(a.description) < 1500
    ORDER BY RANDOM()
    LIMIT 1
  `).get();

  if (!article) {
    // Fallback: any recent article regardless of length
    const fallback = db.prepare(`
      SELECT a.*, c.name as category_name
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.pub_date > datetime('now', '-7 days')
      ORDER BY RANDOM()
      LIMIT 1
    `).get();

    if (!fallback) return res.status(404).json({ error: 'No articles found. Generate some summaries first.' });
    return res.json(fallback);
  }

  res.json(article);
});

module.exports = router;
