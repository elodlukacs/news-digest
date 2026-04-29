const db = require('../db');
const { callLLM: rawCallLLM } = require('../lib/llm');
const { refreshCategorySummary } = require('./refreshSummary');

const callLLM = (messages, opts) => rawCallLLM(messages, { ...opts, db });

// Every category should have a summary no older than this. Any category whose
// latest `summary_history.generated_at` is older (or missing) gets refreshed.
const REFRESH_MAX_AGE_HOURS = 3;
const REFRESH_MAX_AGE_MS = REFRESH_MAX_AGE_HOURS * 60 * 60 * 1000;

// How often the scheduler wakes up to look for stale categories. Smaller than
// the max-age so a category whose freshness expires mid-cycle is picked up
// promptly.
const TICK_MS = 5 * 60 * 1000;

// First sweep happens shortly after startup so the server isn't blocked.
const STARTUP_DELAY_MS = 30 * 1000;

let running = false;

function findStaleCategories() {
  const cutoff = new Date(Date.now() - REFRESH_MAX_AGE_MS).toISOString();
  return db.prepare(`
    SELECT c.id
    FROM categories c
    LEFT JOIN (
      SELECT category_id, MAX(generated_at) AS last_refresh
      FROM summary_history
      GROUP BY category_id
    ) s ON s.category_id = c.id
    WHERE s.last_refresh IS NULL OR s.last_refresh < ?
    ORDER BY (s.last_refresh IS NULL) DESC, s.last_refresh ASC
  `).all(cutoff);
}

async function refreshStaleCategories() {
  if (running) return;
  running = true;
  try {
    const stale = findStaleCategories();
    if (stale.length === 0) return;

    console.log(`[Scheduler] Refreshing ${stale.length} stale categor${stale.length === 1 ? 'y' : 'ies'} (>${REFRESH_MAX_AGE_HOURS}h old)`);
    for (const { id } of stale) {
      try {
        await refreshCategorySummary(db, callLLM, id, {});
        console.log(`[Scheduler] Refreshed category ${id}`);
      } catch (err) {
        console.warn(`[Scheduler] Failed to refresh category ${id}: ${err.message}`);
      }
    }
  } finally {
    running = false;
  }
}

function start() {
  setTimeout(() => {
    refreshStaleCategories().catch((err) => console.error('[Scheduler] Sweep error:', err));
    setInterval(() => {
      refreshStaleCategories().catch((err) => console.error('[Scheduler] Sweep error:', err));
    }, TICK_MS);
  }, STARTUP_DELAY_MS);
}

module.exports = { start, refreshStaleCategories, REFRESH_MAX_AGE_HOURS };
