const express = require('express');
const router = express.Router();

const db = require('../db');
const { providerQuotas } = require('../lib/llm');

router.get('/llm', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = db.prepare('SELECT * FROM llm_usage WHERE created_at >= ? ORDER BY created_at DESC').all(since);

  const total_calls = rows.length;
  const total_prompt_tokens = rows.reduce((s, r) => s + (r.prompt_tokens || 0), 0);
  const total_completion_tokens = rows.reduce((s, r) => s + (r.completion_tokens || 0), 0);
  const total_tokens = rows.reduce((s, r) => s + (r.total_tokens || 0), 0);
  const total_latency = rows.reduce((s, r) => s + (r.latency_ms || 0), 0);
  const avg_latency = total_calls > 0 ? Math.round(total_latency / total_calls) : 0;

  const byProvider = {};
  const byPurpose = {};
  const daily = {};

  for (const r of rows) {
    if (!byProvider[r.provider]) byProvider[r.provider] = { calls: 0, tokens: 0, total_latency: 0 };
    byProvider[r.provider].calls++;
    byProvider[r.provider].tokens += r.total_tokens || 0;
    byProvider[r.provider].total_latency += r.latency_ms || 0;

    if (!byPurpose[r.purpose]) byPurpose[r.purpose] = { calls: 0, tokens: 0, total_latency: 0 };
    byPurpose[r.purpose].calls++;
    byPurpose[r.purpose].tokens += r.total_tokens || 0;
    byPurpose[r.purpose].total_latency += r.latency_ms || 0;

    const day = r.created_at.split('T')[0];
    if (!daily[day]) daily[day] = { date: day, tokens: 0, calls: 0 };
    daily[day].tokens += r.total_tokens || 0;
    daily[day].calls++;
  }

  // Compute avg latency per provider/purpose
  for (const p of Object.values(byProvider)) {
    p.avg_latency = p.calls > 0 ? Math.round(p.total_latency / p.calls) : 0;
    delete p.total_latency;
  }
  for (const p of Object.values(byPurpose)) {
    p.avg_latency = p.calls > 0 ? Math.round(p.total_latency / p.calls) : 0;
    delete p.total_latency;
  }

  res.json({
    total_calls,
    total_prompt_tokens,
    total_completion_tokens,
    total_tokens,
    avg_latency,
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
