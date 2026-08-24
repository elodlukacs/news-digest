const express = require('express');
const router = express.Router();

const db = require('../db');

const DISPLAY_TIMEZONE = process.env.DISPLAY_TIMEZONE || 'Europe/Bucharest';

// `date.setHours(h + 3)` assumed Romania is permanently on EEST, so between late
// October and late March every timestamp — and the day-grouping key below — was
// an hour out, splitting one local day into two buckets.
function parseStoredDate(isoString) {
  if (isoString.includes(' ')) return new Date(isoString.replace(' ', 'T') + 'Z');
  if (isoString.includes('T')) return new Date(isoString);
  return new Date(isoString + 'Z');
}

// 'sv-SE' formats as YYYY-MM-DD HH:mm:ss, which is what the UI expects.
function toLocalTime(isoString) {
  return parseStoredDate(isoString)
    .toLocaleString('sv-SE', { timeZone: DISPLAY_TIMEZONE });
}

function getDateOnly(isoString) {
  return toLocalTime(isoString).slice(0, 10);
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
    created_at: toLocalTime(r.created_at)
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