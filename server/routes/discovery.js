const express = require('express');
const { parser } = require('../lib/rss');

const router = express.Router();

router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const discovered = [];
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 NewsReader/1.0' } });
    const html = await resp.text();

    const linkRegex = /<link[^>]*type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const tag = match[0];
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      const titleMatch = tag.match(/title=["']([^"']+)["']/i);
      if (hrefMatch) {
        let feedUrl = hrefMatch[1];
        if (feedUrl.startsWith('/')) feedUrl = new URL(feedUrl, url).href;
        discovered.push({ title: titleMatch?.[1] || feedUrl, url: feedUrl });
      }
    }

    if (discovered.length === 0) {
      const base = new URL(url).origin;
      const tryPaths = ['/feed', '/rss', '/atom.xml', '/feed.xml', '/rss.xml', '/index.xml'];
      for (const p of tryPaths) {
        try {
          const testUrl = base + p;
          const parsed = await parser.parseURL(testUrl);
          if (parsed?.items?.length > 0) {
            discovered.push({ title: parsed.title || testUrl, url: testUrl });
            break;
          }
        } catch {}
      }
    }

    if (discovered.length === 0) {
      try {
        const parsed = await parser.parseURL(url);
        if (parsed?.items?.length > 0) {
          discovered.push({ title: parsed.title || url, url });
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Feed discovery error:', err.message);
  }

  res.json({ feeds: discovered });
});

module.exports = router;
