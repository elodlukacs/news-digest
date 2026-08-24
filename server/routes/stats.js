const express = require('express');
const router = express.Router();

const db = require('../db');
const { providerQuotas } = require('../lib/llm');

router.get('/llm', (req, res) => {
  const days = Math.min(Math.max(1, parseInt(req.query.days, 10) || 30), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Aggregate in SQLite rather than loading every row and running five reduce
  // passes plus three grouping loops in JS. `llm_usage` grows unbounded, so the
  // old version got slower every day.
  const totals = db.prepare(`
    SELECT COUNT(*) AS total_calls,
           COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens,
           COALESCE(SUM(completion_tokens), 0) AS total_completion_tokens,
           COALESCE(SUM(total_tokens), 0) AS total_tokens,
           COALESCE(AVG(latency_ms), 0) AS avg_latency
    FROM llm_usage WHERE created_at >= ?
  `).get(since);

  const groupBy = (column) => db.prepare(`
    SELECT ${column} AS key,
           COUNT(*) AS calls,
           COALESCE(SUM(total_tokens), 0) AS tokens,
           COALESCE(AVG(latency_ms), 0) AS avg_latency
    FROM llm_usage WHERE created_at >= ? GROUP BY ${column}
  `).all(since);

  const toMap = (rows) => Object.fromEntries(rows.map(r => [r.key, {
    calls: r.calls,
    tokens: r.tokens,
    avg_latency: Math.round(r.avg_latency),
  }]));

  const daily = db.prepare(`
    SELECT substr(created_at, 1, 10) AS date,
           COUNT(*) AS calls,
           COALESCE(SUM(total_tokens), 0) AS tokens
    FROM llm_usage WHERE created_at >= ?
    GROUP BY date ORDER BY date
  `).all(since);

  res.json({
    total_calls: totals.total_calls,
    total_prompt_tokens: totals.total_prompt_tokens,
    total_completion_tokens: totals.total_completion_tokens,
    total_tokens: totals.total_tokens,
    avg_latency: Math.round(totals.avg_latency),
    by_provider: toMap(groupBy('provider')),
    by_purpose: toMap(groupBy('purpose')),
    daily,
    quotas: Object.values(providerQuotas),
  });
});

// GET /trending used to live here as a byte-identical copy of
// routes/tags.js. The client only calls /api/tags/trending.

module.exports = router;
