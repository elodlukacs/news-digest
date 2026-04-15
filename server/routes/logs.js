const express = require('express');
const router = express.Router();

const db = require('../db');

function toRomaniaTime(isoString) {
  let date;
  if (isoString.includes(' ')) {
    date = new Date(isoString.replace(' ', 'T') + 'Z');
  } else if (isoString.includes('T')) {
    date = new Date(isoString);
  } else {
    date = new Date(isoString + 'Z');
  }
  date.setHours(date.getHours() + 3);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

router.get('/', (req, res) => {
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
    ORDER BY created_at DESC
    LIMIT 500
  `).all();

  const formatted = rows.map(r => ({
    ...r,
    created_at: toRomaniaTime(r.created_at)
  }));

  res.json(formatted);
});

module.exports = router;