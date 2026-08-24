/**
 * Minimal in-process rate limiter (fixed window per IP).
 *
 * Deliberately dependency-free — this is a single-process server, so a shared
 * store buys nothing. The point is a ceiling on how fast anyone who can reach
 * the host can burn the LLM keys.
 */
function rateLimit({ windowMs = 60_000, max = 120, name = 'global' } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  // Keep the map from growing without bound on a long-lived process.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
  }, windowMs);
  sweep.unref?.();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      console.warn(`[rateLimit] ${name} limit hit by ${ip} (${entry.count}/${max})`);
      return res.status(429).json({
        error: `Too many requests — retry in ${retryAfter}s`,
        code: 'rate_limited',
      });
    }
    next();
  };
}

module.exports = rateLimit;
