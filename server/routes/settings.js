const express = require('express');
const db = require('../db');

const router = express.Router();

const ALLOWED_KEYS = new Set(['theme', 'language', 'llm_model', 'telegram_enabled', 'briefing_time', 'custom_css']);

router.get('/', (req, res) => {
  const settings = {};
  db.prepare('SELECT * FROM user_settings').all().forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/:key', (req, res) => {
  if (!ALLOWED_KEYS.has(req.params.key)) return res.status(400).json({ error: 'Unknown setting key' });
  const { value } = req.body;
  db.prepare('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)').run(req.params.key, value ?? '');
  res.json({ ok: true });
});

module.exports = router;
