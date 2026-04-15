const express = require('express');
const router = express.Router();

const db = require('../db');

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

  res.json(rows);
});

module.exports = router;