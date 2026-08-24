const express = require('express');
const db = require('../db');

const router = express.Router();

// 'custom_css' was writable but has no reader anywhere in the client. Storing
// unsanitised CSS that nothing consumes is a style-injection sink waiting for
// the day someone renders it; add it back together with a sanitiser.
const ALLOWED_KEYS = new Set(['theme', 'language', 'llm_model', 'briefing_time']);
const MAX_VALUE_LENGTH = 4096;

router.get('/', (req, res) => {
  const settings = {};
  db.prepare('SELECT * FROM user_settings').all().forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/:key', (req, res) => {
  if (!ALLOWED_KEYS.has(req.params.key)) return res.status(400).json({ error: 'Unknown setting key' });
  const { value } = req.body || {};
  const stored = String(value ?? '');
  if (stored.length > MAX_VALUE_LENGTH) {
    return res.status(400).json({ error: 'Setting value too long' });
  }
  db.prepare('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)').run(req.params.key, stored);
  res.json({ ok: true });
});

module.exports = router;
