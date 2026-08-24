const express = require('express');
const { parseFeedUrl } = require('../lib/rss');
const { safeFetch, assertPublicUrl, UnsafeUrlError } = require('../lib/safeFetch');

const router = express.Router();

const MAX_HTML_BYTES = 1024 * 1024;
const DISCOVERY_TIMEOUT_MS = 8000;
const MAX_CANDIDATES = 10;

// POST /api/discover-feed — find RSS/Atom feeds for a site URL.
//
// This endpoint fetches a URL the client chose, so every request goes through
// safeFetch: protocol allowlist, DNS resolution checked against private ranges,
// redirects re-validated per hop, hard timeout, capped body. Without that it is
// an SSRF probe for whatever network the server sits on.
router.post('/', async (req, res, next) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const target = await assertPublicUrl(url);
    const discovered = [];
    const seen = new Set();

    const add = (title, feedUrl) => {
      if (discovered.length >= MAX_CANDIDATES) return;
      if (seen.has(feedUrl)) return;
      seen.add(feedUrl);
      discovered.push({ title: title || feedUrl, url: feedUrl });
    };

    // 1. <link rel="alternate"> declarations in the page head.
    try {
      const { text: html } = await safeFetch(target.href, {
        timeoutMs: DISCOVERY_TIMEOUT_MS,
        maxBytes: MAX_HTML_BYTES,
      });

      const linkRegex = /<link[^>]*type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const tag = match[0];
        const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
        const titleMatch = tag.match(/title=["']([^"']+)["']/i);
        if (!hrefMatch) continue;
        try {
          // Resolve relative hrefs, then validate — a declared feed URL can
          // point anywhere, including back at the LAN.
          const resolved = await assertPublicUrl(new URL(hrefMatch[1], target).href);
          add(titleMatch?.[1], resolved.href);
        } catch { /* skip unusable candidate */ }
      }
    } catch (err) {
      if (err instanceof UnsafeUrlError) throw err;
      console.warn('[discovery] page fetch failed:', err.message);
    }

    // 2. Common feed paths on the same origin.
    if (discovered.length === 0) {
      for (const p of ['/feed', '/rss', '/atom.xml', '/feed.xml', '/rss.xml', '/index.xml']) {
        const testUrl = target.origin + p;
        try {
          const parsed = await parseFeedUrl(testUrl);
          if (parsed?.items?.length > 0) {
            add(parsed.title, testUrl);
            break;
          }
        } catch { /* path not a feed */ }
      }
    }

    // 3. The URL itself might already be a feed.
    if (discovered.length === 0) {
      try {
        const parsed = await parseFeedUrl(target.href);
        if (parsed?.items?.length > 0) add(parsed.title, target.href);
      } catch { /* not a feed */ }
    }

    res.json({ feeds: discovered });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
