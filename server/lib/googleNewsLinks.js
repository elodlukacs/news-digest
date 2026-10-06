/**
 * Turn Google News RSS links (news.google.com/rss/articles/<id>) into the
 * outlet's own article URL.
 *
 * Google no longer encodes the target in the id, so resolving takes two
 * requests: the article page yields a signature and timestamp, and Google's
 * batchexecute endpoint trades them for the URL. This is an undocumented
 * interface, so everything here is best-effort — on any failure the Google
 * link is kept, which still redirects to the article.
 *
 * Only news.google.com is ever contacted, with a URL built from an id that
 * passed a strict charset check; the resolved URL is returned for display and
 * never fetched.
 */
const { fetchWithTimeout } = require('./fetchWithTimeout');

const ID_RE = /^[A-Za-z0-9_-]{20,600}$/;
const REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_BUDGET_MS = 9000;
const DEFAULT_CONCURRENCY = 6;
const USER_AGENT = 'Mozilla/5.0 (compatible; NewsReader/1.0)';

/** The article id of a Google News RSS link, or null for any other URL. */
function googleNewsId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'news.google.com') return null;
    const match = parsed.pathname.match(/^\/(?:rss\/)?articles\/([^/]+)$/);
    return match && ID_RE.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}

function isPublicArticleUrl(url) {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.hostname.endsWith('google.com');
  } catch {
    return false;
  }
}

class RateLimited extends Error {}

async function decodeOne(id, timeoutMs) {
  const page = await fetchWithTimeout(
    `https://news.google.com/rss/articles/${id}`,
    { headers: { 'User-Agent': USER_AGENT } },
    timeoutMs,
  );
  if (page.status === 429) throw new RateLimited('Google News rate limit');
  if (!page.ok) return null;
  const html = await page.text();
  const sig = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = Number(html.match(/data-n-a-ts="(\d+)"/)?.[1]);
  if (!sig || !ts) return null;

  const payload = [[['Fbv4je', JSON.stringify([
    'garturlreq',
    [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    id, ts, sig,
  ]), null, 'generic']]];
  const res = await fetchWithTimeout('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': USER_AGENT },
    body: `f.req=${encodeURIComponent(JSON.stringify(payload))}`,
  }, timeoutMs);
  if (res.status === 429) throw new RateLimited('Google News rate limit');
  if (!res.ok) return null;
  const text = await res.text();
  const url = text.match(/garturlres\\",\\"(https?:[^\\"]+)/)?.[1];
  return url && isPublicArticleUrl(url) ? url : null;
}

/**
 * Resolve as many Google News links as fit in the time budget.
 * Returns Map<googleUrl, articleUrl> with only the links that resolved.
 * Resolved ids are cached in `gnews_links`, so a link is decoded once.
 */
async function resolveGoogleNewsLinks(db, urls, { budgetMs = DEFAULT_BUDGET_MS, concurrency = DEFAULT_CONCURRENCY } = {}) {
  const resolved = new Map();
  const pending = [];
  const getCached = db.prepare('SELECT url FROM gnews_links WHERE google_id = ?');
  for (const url of new Set(urls)) {
    const id = googleNewsId(url);
    if (!id) continue;
    const cached = getCached.get(id);
    if (cached) resolved.set(url, cached.url);
    else pending.push({ url, id });
  }
  if (!pending.length) return resolved;

  const deadline = Date.now() + budgetMs;
  const putCached = db.prepare('INSERT OR REPLACE INTO gnews_links (google_id, url, created_at) VALUES (?, ?, ?)');
  let stopped = false;
  let decoded = 0;

  const worker = async () => {
    while (!stopped && pending.length) {
      const remaining = deadline - Date.now();
      if (remaining < 1000) return;
      const { url, id } = pending.shift();
      try {
        const article = await decodeOne(id, Math.min(REQUEST_TIMEOUT_MS, remaining));
        if (article) {
          resolved.set(url, article);
          putCached.run(id, article, new Date().toISOString());
          decoded++;
        }
      } catch (err) {
        // One 429 means the rest would fail too; keep the Google links.
        if (err instanceof RateLimited) stopped = true;
        else if (err.name !== 'AbortError') console.warn('[GoogleNewsLinks] decode failed:', err.message);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  const left = pending.length;
  console.log(`[GoogleNewsLinks] ${decoded} decoded, ${resolved.size - decoded} cached${left ? `, ${left} left as Google links${stopped ? ' (rate limited)' : ''}` : ''}`);
  return resolved;
}

module.exports = { resolveGoogleNewsLinks, googleNewsId };
