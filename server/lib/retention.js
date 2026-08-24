/**
 * Single source of truth for data retention.
 *
 * There used to be two competing policies: one in `routes/surprise.js` that ran
 * inside a GET handler (mutating the DB on a read, hourly, tracked by a
 * module-global lost on every restart) comparing `generated_at`, and one in
 * `jobs/refreshSummary.js` scoped to a single category comparing `date_key`.
 * They raced and disagreed about which column defined "old".
 *
 * Both also purged `chat_messages` via `summary_id IN (...)`, which never
 * matched the Break feature's rows — those are written with the sentinel
 * `summary_id = 0`, so that table grew without bound.
 */
const SUMMARY_RETENTION_DAYS = Number(process.env.SUMMARY_RETENTION_DAYS) || 3;
const BRIEFING_RETENTION_DAYS = Number(process.env.BRIEFING_RETENTION_DAYS) || 30;
const LLM_USAGE_RETENTION_DAYS = Number(process.env.LLM_USAGE_RETENTION_DAYS) || 90;

const DAY_MS = 86400000;
const isoDaysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString();

/**
 * Delete expired history and the chat messages hanging off it.
 * `generated_at` is the only column used to decide age.
 */
function purgeExpired(db) {
  const summaryCutoff = isoDaysAgo(SUMMARY_RETENTION_DAYS);
  const briefingCutoff = isoDaysAgo(BRIEFING_RETENTION_DAYS);
  const usageCutoff = isoDaysAgo(LLM_USAGE_RETENTION_DAYS);

  return db.transaction(() => {
    // Category summaries (category_id > 0) and briefings (category_id = 0) have
    // different lifetimes.
    const expired = db.prepare(`
      SELECT id FROM summary_history
      WHERE (category_id > 0 AND generated_at < @summaryCutoff)
         OR (category_id = 0 AND generated_at < @briefingCutoff)
    `).all({ summaryCutoff, briefingCutoff }).map(r => r.id);

    let chatDeleted = 0;
    if (expired.length > 0) {
      const placeholders = expired.map(() => '?').join(',');
      chatDeleted += db.prepare(`DELETE FROM chat_messages WHERE summary_id IN (${placeholders})`).run(...expired).changes;
      db.prepare(`DELETE FROM summary_history WHERE id IN (${placeholders})`).run(...expired);
    }

    // The Break feature's per-article chat uses summary_id = 0, so it is not
    // reachable from any summary_history row.
    chatDeleted += db.prepare(
      'DELETE FROM chat_messages WHERE summary_id = 0 AND created_at < ?'
    ).run(summaryCutoff).changes;

    const usageDeleted = db.prepare('DELETE FROM llm_usage WHERE created_at < ?').run(usageCutoff).changes;

    return { summaries: expired.length, chatMessages: chatDeleted, llmUsage: usageDeleted };
  })();
}

/**
 * Run once at startup and then on a timer. Retention is maintenance, not
 * something a read request should be doing.
 */
function startRetention(db, { intervalMs = 6 * 60 * 60 * 1000 } = {}) {
  const run = () => {
    try {
      const result = purgeExpired(db);
      if (result.summaries || result.chatMessages || result.llmUsage) {
        console.log(
          `[retention] purged ${result.summaries} summaries, ` +
          `${result.chatMessages} chat messages, ${result.llmUsage} usage rows`
        );
      }
    } catch (err) {
      console.error('[retention] purge failed:', err.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}

module.exports = { purgeExpired, startRetention, SUMMARY_RETENTION_DAYS };
