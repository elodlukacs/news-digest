/**
 * De-duplicate concurrent runs of an expensive operation.
 *
 * Two clicks on Refresh used to run two full feed-fetch + LLM cycles that both
 * wrote `summaries`/`summary_history` — double the cost, duplicate history rows.
 * The scheduler that used to debounce this no longer exists.
 *
 * Callers awaiting the same key share one promise, so the second caller gets the
 * first caller's result instead of starting another run.
 */
const running = new Map(); // key -> Promise

function runExclusive(key, task) {
  const existing = running.get(key);
  if (existing) {
    console.log(`[inFlight] joining in-progress run: ${key}`);
    return existing;
  }
  const promise = (async () => task())().finally(() => running.delete(key));
  running.set(key, promise);
  return promise;
}

const isRunning = (key) => running.has(key);

/**
 * Middleware form, for handlers that write to `res` directly and so can't share
 * a promise: the second concurrent request gets 409 instead of duplicating the
 * work. The key is released when the response finishes.
 */
function lockHandler(key) {
  const held = new Set();
  return (req, res, next) => {
    if (held.has(key)) {
      return res.status(409).json({ error: 'This operation is already running', code: 'already_running' });
    }
    held.add(key);
    res.on('close', () => held.delete(key));
    next();
  };
}

module.exports = { runExclusive, isRunning, lockHandler };
