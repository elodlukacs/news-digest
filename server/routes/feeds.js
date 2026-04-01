const express = require('express');
const db = require('../db');
const validateId = require('../middleware/validateId');

const router = express.Router();

router.get('/:id/feeds', validateId, (req, res) => {
  const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(req.params.id);
  res.json(feeds);
});

router.post('/:id/feeds', validateId, (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Feed URL must use http or https' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  const result = db.prepare('INSERT INTO feeds (category_id, name, url) VALUES (?, ?, ?)').run(req.params.id, name, url);
  res.json({ id: result.lastInsertRowid, category_id: Number(req.params.id), name, url });
});

module.exports = router;
