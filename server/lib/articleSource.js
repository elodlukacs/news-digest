/**
 * Source material for per-article chat.
 *
 * Chat used to see only the feed teaser (`contentSnippet`, often one sentence)
 * or the summary paragraph, so any question beyond the summary was answered
 * from the model's memory. This resolves the best available text for an
 * article — full feed body, else the extracted original page, else the teaser —
 * and builds a background briefing (worldwide context, arguments for/against)
 * from it plus other outlets' coverage. Both are cached per article.
 */
const crypto = require('crypto');
const { parseHTML } = require('linkedom');
const { Readability } = require('@mozilla/readability');

const db = require('../db');
const { safeFetch } = require('./safeFetch');
const { cleanArticleText } = require('./cleanText');
const { runExclusive } = require('./inFlight');
const { callLLM } = require('./llm');
const { buildMessages } = require('./promptManager');
const { searchAllSources } = require('./bias-radar/newsSearch');

// Keeps article + briefing + history inside the smaller fallback providers'
// context windows.
const MAX_ARTICLE_CHARS = 12000;
const BRIEFING_ARTICLE_CHARS = 8000;
// Feed text at least this long is the article itself, not a teaser — no need
// to fetch the page.
const FULL_FEED_MIN_CHARS = 1500;
// Readability output shorter than this is a cookie wall or paywall stub.
const PAGE_MIN_CHARS = 400;
const PAGE_MAX_BYTES = 3 * 1024 * 1024;
// A failed page read is cached so every chat turn doesn't re-fetch, but only
// briefly: the failure may have been transient.
const EXCERPT_RETRY_MS = 60 * 60 * 1000;
// GDELT is often slow or rate-limited; the briefing is still useful without
// other outlets' coverage, so don't let the lookup hold up the chat.
const RELATED_TIMEOUT_MS = 8000;

const stmts = {
  getSource: db.prepare('SELECT text, origin, created_at FROM article_sources WHERE source_key = ?'),
  putSource: db.prepare('INSERT OR REPLACE INTO article_sources (source_key, url, text, origin, created_at) VALUES (?,?,?,?,?)'),
  getFeedArticle: db.prepare('SELECT feed_name, description, body_text FROM articles WHERE link = ? ORDER BY fetched_at DESC LIMIT 1'),
  getContext: db.prepare('SELECT briefing, related_json FROM article_contexts WHERE source_key = ?'),
  putContext: db.prepare('INSERT OR REPLACE INTO article_contexts (source_key, title, briefing, related_json, created_at) VALUES (?,?,?,?,?)'),
};

const sourceKey = (url, title) =>
  crypto.createHash('sha256').update(url ? `url:${url}` : `title:${title}`).digest('hex');

const longest = (texts) => texts.reduce((best, t) => (t.length > best.length ? t : best), '');

async function extractFromPage(url) {
  const res = await safeFetch(url, {
    maxBytes: PAGE_MAX_BYTES,
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });
  if (!res.ok || !/html/i.test(res.headers.get('content-type') || '')) return '';
  const { document } = parseHTML(res.text);
  const parsed = new Readability(document).parse();
  return parsed?.content ? cleanArticleText(htmlToText(parsed.content)) : '';
}

// Readability's `textContent` drops block boundaries, gluing paragraphs and
// table cells together without a space; regex tag-stripping breaks on
// attributes that contain `>`. So walk the DOM and mark the boundaries.
const BLOCK_SELECTOR = 'p, div, li, h1, h2, h3, h4, h5, h6, br, tr, blockquote, figcaption, pre';

function htmlToText(html) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  for (const el of document.querySelectorAll(BLOCK_SELECTOR)) el.appendChild(document.createTextNode('\n'));
  for (const el of document.querySelectorAll('td, th')) el.appendChild(document.createTextNode(' '));
  return document.body.textContent || '';
}

/**
 * `url` must already be trusted (taken from our own summary), and is still
 * only ever fetched through safeFetch. `fallback` is the client's excerpt.
 * Returns { key, text, origin, feedName }.
 */
async function getArticleSource({ url, title, fallback = '' }) {
  const key = sourceKey(url, title);
  const feedRow = url ? stmts.getFeedArticle.get(url) : null;
  const feedName = feedRow?.feed_name || '';

  const cached = stmts.getSource.get(key);
  const cacheFresh = cached && (cached.origin !== 'excerpt' || Date.now() - Date.parse(cached.created_at) < EXCERPT_RETRY_MS);
  if (cacheFresh) return { key, text: cached.text, origin: cached.origin, feedName };

  return runExclusive(`article-source:${key}`, async () => {
    const feedText = longest([feedRow?.body_text, feedRow?.description, fallback].map(cleanArticleText));
    let text = feedText;
    let origin = feedText.length >= FULL_FEED_MIN_CHARS ? 'feed' : 'excerpt';

    if (origin === 'excerpt' && url) {
      try {
        const pageText = await extractFromPage(url);
        if (pageText.length >= PAGE_MIN_CHARS && pageText.length > feedText.length) {
          text = pageText;
          origin = 'page';
        }
      } catch (err) {
        console.warn(`[articleSource] could not read ${url}: ${err.message}`);
      }
    }

    text = text.slice(0, MAX_ARTICLE_CHARS);
    stmts.putSource.run(key, url || null, text, origin, new Date().toISOString());
    return { key, text, origin, feedName };
  });
}

/**
 * Background briefing for one article, generated once and cached.
 * Returns { briefing, related } where `related` is other outlets' coverage.
 */
async function getArticleBriefing({ key, title, articleText, excludeSource, language }) {
  const cached = stmts.getContext.get(key);
  if (cached) {
    let related = [];
    try { related = JSON.parse(cached.related_json); } catch { /* keep empty */ }
    return { briefing: cached.briefing, related };
  }

  return runExclusive(`article-briefing:${key}`, async () => {
    let related = [];
    try {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timed out')), RELATED_TIMEOUT_MS);
      });
      const found = await Promise.race([searchAllSources(title, excludeSource || null, language), timeout])
        .finally(() => clearTimeout(timer));
      related = found.map((a) => ({
        source: a.source,
        title: a.title,
        biasRating: a.biasRating,
        excerpt: (a.excerpt || '').slice(0, 300),
      }));
    } catch (err) {
      console.warn('[articleSource] related coverage lookup failed:', err.message);
    }

    const messages = buildMessages('article-context', {
      title,
      article: articleText.slice(0, BRIEFING_ARTICLE_CHARS) || '(not available)',
      related: formatRelated(related),
      language,
    });
    const result = await callLLM(messages, { purpose: 'article-context', temperature: 0.3, max_tokens: 1500, db });
    const briefing = (result.content || '').trim();
    if (!briefing) throw new Error('Empty background briefing');

    stmts.putContext.run(key, String(title).slice(0, 500), briefing, JSON.stringify(related), new Date().toISOString());
    return { briefing, related };
  });
}

function formatRelated(related) {
  if (!related.length) return '(no other coverage found)';
  return related
    .map((a) => `- ${a.source} [bias: ${a.biasRating || 'unknown'}]: ${a.title}${a.excerpt ? ` — ${a.excerpt}` : ''}`)
    .join('\n');
}

module.exports = { getArticleSource, getArticleBriefing, formatRelated };
