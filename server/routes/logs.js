const express = require('express');
const router = express.Router();

const db = require('../db');

function toRomaniaTime(isoString) {
  const date = new Date(isoString);
  date.setHours(date.getHours() + 3);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

router.get('/', (req, res) => {
  const days = parseInt(req.query.days) || 3;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = db.prepare(`
    SELECT 
      id,
      provider,
      model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      purpose,
      category_id,
      latency_ms,
      created_at
    FROM llm_usage 
    WHERE created_at >= ? 
    ORDER BY created_at DESC
  `).all(since);

  const formatted = rows.map(r => ({
    ...r,
    created_at: toRomaniaTime(r.created_at)
  }));

  res.json(formatted);
});

module.exports = router;