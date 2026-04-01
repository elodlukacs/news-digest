const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/trending', (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows = db.prepare('SELECT tags_data FROM summary_history WHERE date_key >= ? AND tags_data IS NOT NULL').all(since);
    const counts = {};
    for (const row of rows) {
      try {
        const tags = JSON.parse(row.tags_data);
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            counts[tag] = (counts[tag] || 0) + 1;
          }
        }
      } catch { /* skip malformed */ }
    }
    const result = Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    res.json(result);
  } catch {
    res.json([]);
  }
});

module.exports = router;
