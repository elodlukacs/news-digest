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

function getDateOnly(isoString) {
  let date;
  if (isoString.includes(' ')) {
    date = new Date(isoString.replace(' ', 'T') + 'Z');
  } else if (isoString.includes('T')) {
    date = new Date(isoString);
  } else {
    date = new Date(isoString + 'Z');
  }
  date.setHours(date.getHours() + 3);
  return date.toISOString().slice(0, 10);
}

router.get('/', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 3, 30);
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
    WHERE created_at > datetime('now', '-' || ? || ' days')
    ORDER BY created_at DESC
    LIMIT 500
  `).all(days);

  const formatted = rows.map(r => ({
    ...r,
    created_at: toRomaniaTime(r.created_at)
  }));

  const dailySummary = {};
  for (const r of formatted) {
    const day = r.created_at.slice(0, 10);
    const key = `${day}|${r.model}|${r.provider}`;
    if (!dailySummary[key]) {
      dailySummary[key] = { day, model: r.model, provider: r.provider, prompt: 0, completion: 0, total: 0, calls: 0 };
    }
    dailySummary[key].prompt += r.prompt_tokens;
    dailySummary[key].completion += r.completion_tokens;
    dailySummary[key].total += r.total_tokens;
    dailySummary[key].calls += 1;
  }

  const summaryLines = Object.values(dailySummary);

  const result = [];
  let currentDay = null;
  for (const log of formatted) {
    const day = log.created_at.slice(0, 10);
    if (day !== currentDay) {
      const daySummaries = summaryLines.filter(s => s.day === day);
      for (const s of daySummaries) {
        result.push({ isSummary: true, ...s });
      }
      currentDay = day;
    }
    result.push(log);
  }

  res.json(result);
});

module.exports = router;