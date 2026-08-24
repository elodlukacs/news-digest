const express = require('express');
const db = require('../db');
const validateId = require('../middleware/validateId');
const { assertPublicUrl } = require('../lib/safeFetch');
const { feedKey, feedHealth } = require('../lib/feedHealth');

const router = express.Router();

router.get('/:id/feeds', validateId, (req, res) => {
  const feeds = db.prepare('SELECT * FROM feeds WHERE category_id = ?').all(req.params.id);
  // Health travels with the feed so the UI can show a dead source instead of
  // silently serving a shrinking digest.
  res.json(feeds.map(f => ({
    id: f.id,
    category_id: f.category_id,
    name: f.name,
    url: f.url,
    health: feedHealth(f),
  })));
});

router.post('/:id/feeds', validateId, async (req, res, next) => {
  const { name, url } = req.body || {};
  if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });
  // Validating the protocol alone was not enough: a stored feed URL is fetched
  // server-side on every refresh, so an internal host here becomes a persistent
  // SSRF whose response body ends up inside a summary.
  try {
    await assertPublicUrl(url);
  } catch (err) {
    return next(err);
  }

  // Dedupe on the normalized URL, so an http/https or tracking-param variant of
  // a feed already in this category doesn't create a second copy.
  const key = feedKey(url);
  const existing = db.prepare(
    'SELECT id, name, url FROM feeds WHERE category_id = ? AND url_key = ?'
  ).get(req.params.id, key);

  if (existing) {
    return res.status(409).json({
      error: `This feed is already in the section as "${existing.name}"`,
      code: 'duplicate_feed',
      feed: { id: existing.id, name: existing.name, url: existing.url },
    });
  }

  const result = db.prepare(
    'INSERT INTO feeds (category_id, name, url, url_key) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, name, url, key);

  res.json({ id: result.lastInsertRowid, category_id: Number(req.params.id), name, url });
});

module.exports = router;
