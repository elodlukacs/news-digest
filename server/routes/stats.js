const express = require('express');
const router = express.Router();

const db = require('../db');
const { providerQuotas } = require('../lib/llm');

router.get('/llm', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = db.prepare('SELECT * FROM llm_usage WHERE created_at >= ? ORDER BY created_at DESC').all(since);

  const total_calls = rows.length;
  const total_tokens = rows.reduce((s, r) => s + (r.total_tokens || 0), 0);

  const byProvider = {};
  const byPurpose = {};
  const daily = {};

  for (const r of rows) {
    if (!byProvider[r.provider]) byProvider[r.provider] = { calls: 0, tokens: 0 };
    byProvider[r.provider].calls++;
    byProvider[r.provider].tokens += r.total_tokens || 0;

    if (!byPurpose[r.purpose]) byPurpose[r.purpose] = { calls: 0, tokens: 0 };
    byPurpose[r.purpose].calls++;
    byPurpose[r.purpose].tokens += r.total_tokens || 0;

    const day = r.created_at.split('T')[0];
    if (!daily[day]) daily[day] = { date: day, tokens: 0, calls: 0 };
    daily[day].tokens += r.total_tokens || 0;
    daily[day].calls++;
  }

  res.json({
    total_calls,
    total_tokens,
    by_provider: byProvider,
    by_purpose: byPurpose,
    daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    quotas: Object.values(providerQuotas),
  });
});

router.get('/trending', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const rows = db.prepare('SELECT tags_data FROM summary_history WHERE date_key >= ? AND tags_data IS NOT NULL').all(since);

  const tagCounts = {};
  for (const row of rows) {
    try {
      const tags = JSON.parse(row.tags_data);
      for (const tag of tags) {
        const normalized = tag.toLowerCase().trim();
        tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
      }
    } catch {}
  }

  const trending = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  res.json(trending);
});

module.exports = router;
