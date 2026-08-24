const { normalizeUrl } = require('./attribution');

/**
 * Feed URL normalization + health tracking.
 *
 * `feeds.url_key` is the normalized form used for dedupe on insert and for the
 * Explore page's `subscribed` flag, which previously used exact string equality
 * and so treated `http://x/feed` and `https://www.x/feed/` as different feeds.
 */
const AUTO_PAUSE_AFTER = Number(process.env.FEED_AUTO_PAUSE_AFTER) || 10;

const feedKey = (url) => normalizeUrl(url);

/** Backfill url_key for rows created before the column existed. */
function backfillUrlKeys(db) {
  const rows = db.prepare('SELECT id, url FROM feeds WHERE url_key IS NULL').all();
  if (rows.length === 0) return 0;
  const update = db.prepare('UPDATE feeds SET url_key = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of rows) update.run(feedKey(row.url), row.id);
  })();
  console.log(`[feeds] backfilled url_key for ${rows.length} feed(s)`);
  return rows.length;
}

function recordSuccess(db, feedId) {
  db.prepare(
    'UPDATE feeds SET last_ok_at = ?, last_error = NULL, consecutive_failures = 0 WHERE id = ?'
  ).run(new Date().toISOString(), feedId);
}

function recordFailure(db, feedId, message) {
  db.prepare(
    'UPDATE feeds SET last_error = ?, consecutive_failures = COALESCE(consecutive_failures, 0) + 1 WHERE id = ?'
  ).run(String(message || 'Unknown error').slice(0, 300), feedId);
}

/** Health summary for the UI: `unhealthy` drives the warning dot in FeedManager. */
function feedHealth(feed) {
  const failures = feed.consecutive_failures || 0;
  return {
    lastOkAt: feed.last_ok_at || null,
    lastError: feed.last_error || null,
    consecutiveFailures: failures,
    unhealthy: failures >= 3,
    suggestPause: failures >= AUTO_PAUSE_AFTER,
  };
}

module.exports = { feedKey, backfillUrlKeys, recordSuccess, recordFailure, feedHealth, AUTO_PAUSE_AFTER };
