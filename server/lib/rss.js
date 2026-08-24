const RSSParser = require('rss-parser');
const { safeFetch } = require('./safeFetch');

const FEED_TIMEOUT_MS = Number(process.env.RSS_TIMEOUT_MS) || 15000;
const FEED_MAX_BYTES = 5 * 1024 * 1024;

const parser = new RSSParser({
  timeout: FEED_TIMEOUT_MS,
  maxRedirects: 3,
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['media:group', 'media:group'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'content:encoded'],
    ],
  },
});

function extractImageFromHtml(html) {
  const imgMatch = String(html).match(/<img[^>]+src=["']([^"'>]+)["']/);
  return imgMatch ? imgMatch[1] : '';
}

function extractMediaUrl(obj) {
  if (!obj) return '';
  const arr = Array.isArray(obj) ? obj : [obj];
  for (const item of arr) {
    const url = item?.$?.url || item?.url || item?.href || item?.$?.href || '';
    if (url) return url;
  }
  return '';
}

function extractImage(item) {
  if (item.enclosure?.url) {
    const encType = item.enclosure?.type || '';
    if (encType.startsWith('image/') || !encType) {
      const url = item.enclosure.url;
      if (url && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(url)) return url;
    }
  }

  const mcUrl = extractMediaUrl(item['media:content']);
  if (mcUrl && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(mcUrl)) return mcUrl;

  const mtUrl = extractMediaUrl(item['media:thumbnail']);
  if (mtUrl && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(mtUrl)) return mtUrl;

  if (item['media:group']) {
    const group = item['media:group'];
    const groupUrl = extractMediaUrl(group?.['media:content'] || group?.['media:thumbnail']);
    if (groupUrl && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(groupUrl)) return groupUrl;
  }

  if (item['itunes:image']) {
    const itunes = Array.isArray(item['itunes:image']) ? item['itunes:image'][0] : item['itunes:image'];
    const itunesUrl = itunes?.href || itunes?.$?.href || '';
    if (itunesUrl && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(itunesUrl)) return itunesUrl;
  }

  const htmlImage = extractImageFromHtml(item['content:encoded']) || extractImageFromHtml(item.content) || extractImageFromHtml(item.description) || '';
  if (htmlImage && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(htmlImage)) return htmlImage;
  
  return '';
}

/**
 * Fetch and parse a feed URL.
 *
 * Always use this instead of `parser.parseURL` for any URL that came from a
 * client: parseURL does its own unguarded HTTP, so a stored feed pointing at
 * `http://192.168.1.10/admin` would be fetched server-side and its body fed
 * into a summary. safeFetch validates every redirect hop, caps the body and
 * enforces a timeout; stored rows are re-validated here because they may
 * predate the validation added at insert time.
 */
async function parseFeedUrl(url) {
  const { text, status, ok } = await safeFetch(url, {
    timeoutMs: FEED_TIMEOUT_MS,
    maxBytes: FEED_MAX_BYTES,
    headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
  });
  if (!ok) {
    const err = new Error(`Feed request failed with status ${status}`);
    err.statusCode = 502;
    err.expose = true;
    throw err;
  }
  return parser.parseString(text);
}

module.exports = { parser, parseFeedUrl, extractImageFromHtml, extractMediaUrl, extractImage };
