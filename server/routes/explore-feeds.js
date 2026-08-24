const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { feedKey } = require('../lib/feedHealth');

const router = express.Router();

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'feeds-catalog.json');

let cachedCatalog = null;
function loadCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  cachedCatalog = JSON.parse(raw);
  return cachedCatalog;
}

router.get('/', (_req, res) => {
  try {
    const catalog = loadCatalog();
    // Compare normalized URLs. Exact string equality meant a catalog feed added
    // earlier via discovery — or stored as http rather than https, or with a
    // ?format= suffix — showed as unsubscribed, and re-adding duplicated it.
    const subscribed = new Set(
      db.prepare('SELECT url, url_key FROM feeds').all()
        .map((row) => row.url_key || feedKey(row.url))
    );
    const feeds = catalog.feeds.map((f) => ({
      ...f,
      subscribed: subscribed.has(feedKey(f.url)),
    }));
    res.json({ topics: catalog.topics, feeds });
  } catch (err) {
    console.error('Failed to load feeds catalog', err);
    res.status(500).json({ error: 'Failed to load catalog' });
  }
});

module.exports = router;
