/**
 * Choose which feed items a category summary covers.
 *
 * The summary used to take each feed's first 10 items, keep the newest 30
 * overall and only then apply the filter keyword. A breaking story that sat
 * lower in a feed never reached the model, and a keyword search only looked
 * through those 30 — so "flydubai" found 2 articles on the day of the attack.
 *
 * Now every item is collected, windowed by age and deduped; the keyword is
 * matched across the whole pool; and when more remain than the summary can
 * take, a headline-only LLM pass ranks them by importance. If that pass fails
 * or is slow, the pool is ranked by cross-outlet coverage and recency instead,
 * so a refresh never fails because of triage.
 */
const { buildMessages } = require('./promptManager');
const { parseJSON } = require('./parseJSON');
const { normalizeUrl } = require('./attribution');
const { extractKeywords } = require('./bias-radar/topicCluster');

const HOUR_MS = 3600000;
// Without a keyword, older items only crowd out today's news.
const FRESH_WINDOW_MS = 48 * HOUR_MS;
// A keyword search is looking for every article on one story, so reach back further.
const KEYWORD_WINDOW_MS = 7 * 24 * HOUR_MS;
// Good news is a small share of any feed, so look back a little further for it.
const GOOD_NEWS_WINDOW_MS = 72 * HOUR_MS;
// Most a Good News triage keeps. Fewer is normal: it keeps only real good news.
const GOOD_NEWS_POOL = 20;
// A headline alone often hides whether the news is good ("Drug trial ends early"),
// so Good News triage also sees the start of each description.
const GOOD_NEWS_EXCERPT = 160;
// The prompt scores impact and evidence 0-3 and keeps only 2+ on both; this
// enforces it in case the model lists an item it scored lower.
const GOOD_NEWS_MIN_SCORE = 2;
// Slow categories (weekly blogs, science) may have nothing inside the window;
// below this many fresh items they get their newest items regardless of age.
const MIN_FRESH_POOL = 8;
// What the summary prompt receives. Unchanged from the old 30-article cap.
const SUMMARY_POOL = 30;
// Headline lines sent to triage: ≤40 tokens each keeps the call under ~5k
// tokens, which matters because it shares a per-minute quota with the summary.
const MAX_TRIAGE_CANDIDATES = 120;
const MAX_TRIAGE_TITLE = 120;
// Triage is an optimisation; past this the heuristic ranking is good enough.
// Without a cap the full provider chain (90 s × retries × providers) could
// hold the refresh lock for minutes.
const TRIAGE_TIMEOUT_MS = 25000;
// Two titles sharing this many keywords are treated as the same story.
const SAME_STORY_OVERLAP = 2;
// Feeds with timezone bugs date items in the future; treat those as undated.
const FUTURE_TOLERANCE_MS = HOUR_MS;

/** Lowercase, strip accents and HTML, collapse every non letter/digit run to one space. */
function normalizeText(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** True when the keyword has something to search for — "!!!" does not. */
function isSearchableKeyword(keyword) {
  return normalizeText(keyword) !== '';
}

/**
 * Word-start match on title + description, so "AI" does not match "said" and
 * "war" does not match "software". Long keywords also match with spaces
 * removed, so "Fly Dubai", "flydubai" and "FlyDubai" find each other. The full
 * article body is not searched: it carries "related stories" and nav links.
 */
function matchesKeyword(article, keyword) {
  const kw = normalizeText(keyword);
  if (!kw) return true;
  const text = normalizeText(`${article.title} ${article.description}`);
  if (` ${text}`.includes(` ${kw}`)) return true;
  const kwJoined = kw.replace(/ /g, '');
  return kwJoined.length >= 6 && text.replace(/ /g, '').includes(kwJoined);
}

function timeOf(article, now) {
  const t = new Date(article.pubDate).getTime();
  return Number.isFinite(t) && t > 0 && t <= now + FUTURE_TOLERANCE_MS ? t : 0;
}

/**
 * Same link (ignoring tracking params) or same headline from two feeds → keep
 * the first, but remember every outlet that carried it: syndicated wire copy
 * in several feeds is the strongest coverage signal there is.
 */
function dedupe(articles) {
  const byKey = new Map();
  const kept = [];
  for (const a of articles) {
    const keys = [normalizeUrl(a.link), normalizeText(a.title)].filter(Boolean);
    const existing = keys.map((k) => byKey.get(k)).find(Boolean);
    if (existing) {
      existing.sources.add(a.source);
      continue;
    }
    const item = { ...a, sources: new Set([a.source]) };
    keys.forEach((k) => byKey.set(k, item));
    kept.push(item);
  }
  return kept;
}

/**
 * English-only keyword set with a crude plural/tense strip ("attacked" →
 * "attack"). Non-Latin titles produce empty sets, which only means the
 * fallback ranking degrades to recency for those categories.
 */
function storyWords(title) {
  return new Set(extractKeywords(title).map((w) => w.replace(/(ing|ed|s)$/, '')).filter((w) => w.length > 2));
}

/** Number of distinct outlets carrying a story with an overlapping headline — the cheapest importance signal. */
function annotateCoverage(articles) {
  const words = articles.map((a) => storyWords(a.title));
  // Inverted index keeps this near-linear: only articles sharing a word are compared.
  const index = new Map();
  words.forEach((set, i) => {
    for (const w of set) {
      if (!index.has(w)) index.set(w, []);
      index.get(w).push(i);
    }
  });
  return articles.map((a, i) => {
    const shared = new Map();
    for (const w of words[i]) {
      for (const j of index.get(w)) if (j !== i) shared.set(j, (shared.get(j) || 0) + 1);
    }
    const sources = new Set(a.sources);
    for (const [j, count] of shared) {
      if (count >= SAME_STORY_OVERLAP) articles[j].sources.forEach((s) => sources.add(s));
    }
    return { ...a, coverage: sources.size };
  });
}

/** Fallback ranking: wide coverage first, then freshness. Undated items sink. */
function heuristicScore(article, now) {
  const t = timeOf(article, now);
  const ageHours = t ? Math.max(0, (now - t) / HOUR_MS) : 72;
  return article.coverage * 2 - ageHours / 12 + (ageHours < 6 ? 1 : 0);
}

function formatAge(article, now) {
  const t = timeOf(article, now);
  if (!t) return 'undated';
  const hours = Math.round((now - t) / HOUR_MS);
  return hours < 1 ? 'just now' : hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** Strip our own line separators so a headline cannot fake an outlet, age or coverage count. */
function headlineText(title) {
  return title.replace(/\s+/g, ' ').replace(/ [—·] /g, ' - ').slice(0, MAX_TRIAGE_TITLE);
}

/** Plain-text start of the description, for Good News triage lines. */
function excerptText(description) {
  const text = String(description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > GOOD_NEWS_EXCERPT ? `${text.slice(0, GOOD_NEWS_EXCERPT)}…` : text;
}

/**
 * Keep only genuinely good news, best first. Unlike the importance triage this
 * runs on any pool size and may return few or no ids: an empty answer means
 * there is no good news, never a reason to top up with other stories.
 */
async function triageGoodNews(callLLM, candidates, { category, provider, now }) {
  const headlines = candidates
    .map((a, i) => {
      const line = `[${i + 1}] ${headlineText(a.title)} — ${a.source} · ${formatAge(a, now)}`;
      const excerpt = excerptText(a.description);
      return excerpt ? `${line}\n    ${excerpt}` : line;
    })
    .join('\n');

  const messages = buildMessages('good-news-triage', {
    category: category.name,
    limit: String(GOOD_NEWS_POOL),
    headlines,
  });
  const result = await callLLM(messages, {
    purpose: 'good-news-triage',
    categoryId: category.id,
    providerId: provider || null,
    temperature: 0.1,
    // Each kept item carries a short restatement and scores (~50 tokens).
    max_tokens: 2500,
  });

  const parsed = parseJSON(result.content || '', null);
  const entries = Array.isArray(parsed) ? parsed : parsed?.selected;
  if (!Array.isArray(entries)) throw new Error('Good News triage response had no "selected" array');

  const belowBar = (score) => Number.isFinite(Number(score)) && Number(score) < GOOD_NEWS_MIN_SCORE;
  const picked = [];
  const used = new Set();
  for (const entry of entries) {
    const isObject = entry && typeof entry === 'object';
    if (isObject && (belowBar(entry.impact) || belowBar(entry.evidence))) continue;
    const idx = Number(isObject ? entry.id : entry) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length || used.has(idx)) continue;
    used.add(idx);
    picked.push(candidates[idx]);
    if (picked.length >= GOOD_NEWS_POOL) break;
  }
  return picked;
}

async function triageWithLLM(callLLM, candidates, { category, keyword, provider, now }) {
  const headlines = candidates
    .map((a, i) => `[${i + 1}] ${headlineText(a.title)} — ${a.source} · ${formatAge(a, now)} · ${a.coverage} outlet${a.coverage === 1 ? '' : 's'}`)
    .join('\n');
  const focus = keyword
    ? `\nThe reader is following one story: "${keyword}". Every headline below mentions it. Pick the ones covering the most important and distinct developments.\n`
    : '';

  const messages = buildMessages('category-triage', {
    category: category.name,
    focus,
    limit: String(SUMMARY_POOL),
    headlines,
  });
  const result = await callLLM(messages, {
    purpose: 'triage',
    categoryId: category.id,
    providerId: provider || null,
    temperature: 0.1,
    // The answer is ~30 ids; headroom covers models that spend tokens thinking.
    max_tokens: 1500,
  });

  const parsed = parseJSON(result.content || '', null);
  const ids = Array.isArray(parsed) ? parsed : parsed?.selected;
  if (!Array.isArray(ids)) throw new Error('Triage response had no "selected" array');

  const picked = [];
  const used = new Set();
  for (const raw of ids) {
    const idx = Number(raw) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length || used.has(idx)) continue;
    used.add(idx);
    picked.push(candidates[idx]);
    if (picked.length >= SUMMARY_POOL) break;
  }
  return picked;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * @returns {Promise<{ articles: object[], poolSize: number, method: 'all'|'llm'|'heuristic' }>}
 *   `articles` is ordered most-important first and capped at SUMMARY_POOL.
 *   With `goodNews`, `articles` holds only the good news triage found (possibly
 *   none); if triage fails it is the heuristic top of the pool, and the Good
 *   News summary prompt does the filtering on its own.
 */
async function selectArticles(callLLM, rawArticles, { category, keyword, provider, goodNews = false } = {}) {
  const now = Date.now();
  const windowMs = keyword ? KEYWORD_WINDOW_MS : goodNews ? GOOD_NEWS_WINDOW_MS : FRESH_WINDOW_MS;
  // Undated items are kept: some feeds omit pubDate, and dropping them would empty those feeds.
  const inWindow = (a) => !timeOf(a, now) || now - timeOf(a, now) <= windowMs;

  let pool;
  if (keyword) {
    pool = dedupe(rawArticles.filter((a) => inWindow(a) && matchesKeyword(a, keyword)));
  } else {
    pool = dedupe(rawArticles.filter(inWindow));
    if (pool.length < MIN_FRESH_POOL) {
      pool = dedupe(rawArticles)
        .sort((a, b) => timeOf(b, now) - timeOf(a, now))
        .slice(0, SUMMARY_POOL);
    }
  }

  pool = annotateCoverage(pool)
    .map((a) => ({ ...a, score: heuristicScore(a, now) }))
    .sort((a, b) => b.score - a.score);

  const poolSize = pool.length;
  if (goodNews) {
    const candidates = pool.slice(0, MAX_TRIAGE_CANDIDATES);
    try {
      const picked = await withTimeout(
        triageGoodNews(callLLM, candidates, { category, provider, now }),
        TRIAGE_TIMEOUT_MS
      );
      return { articles: picked, poolSize, method: 'llm' };
    } catch (err) {
      console.warn('[Triage] Good News filtering failed, leaving it to the summary prompt:', err.message);
      return { articles: pool.slice(0, SUMMARY_POOL), poolSize, method: 'heuristic' };
    }
  }

  if (poolSize <= SUMMARY_POOL) {
    return { articles: ownSourcesFirst(pool), poolSize, method: 'all' };
  }

  // The category's own feeds always make the cut. Search results (Google News)
  // are many outlets on one story, so on coverage alone they outrank and
  // crowd out the handful of matching feed items the user actually subscribed to.
  const hasSearch = pool.some((a) => a.fromSearch);
  const own = hasSearch ? pool.filter((a) => !a.fromSearch) : pool;
  // Enough feed matches on their own: search results would only displace them.
  const ranked = hasSearch && own.length >= SUMMARY_POOL ? own : pool;
  const reserved = hasSearch && own.length < SUMMARY_POOL ? own : [];

  const candidates = ranked.slice(0, MAX_TRIAGE_CANDIDATES);
  try {
    const picked = await withTimeout(
      triageWithLLM(callLLM, candidates, { category, keyword, provider, now }),
      TRIAGE_TIMEOUT_MS
    );
    // A model that returns a handful of ids would starve the summary; top up from the heuristic ranking.
    if (picked.length >= SUMMARY_POOL / 2) {
      return { articles: fillWithReserved(picked, reserved, ranked), poolSize, method: 'llm' };
    }
    console.warn(`[Triage] Only ${picked.length} usable ids returned — using heuristic ranking`);
  } catch (err) {
    console.warn('[Triage] LLM ranking failed, using heuristic ranking:', err.message);
  }
  return { articles: fillWithReserved([], reserved, ranked), poolSize, method: 'heuristic' };
}

/** Stable partition: feed items before search results, each keeping its ranking. */
function ownSourcesFirst(articles) {
  return [...articles.filter((a) => !a.fromSearch), ...articles.filter((a) => a.fromSearch)];
}

/**
 * Keep every reserved (own-feed) item, fill the remaining slots in `picked`
 * order, top up from `rest` (already heuristic-ranked), and keep the picked
 * order so the summary still leads with the most important story.
 */
function fillWithReserved(picked, reserved, rest) {
  const reservedSet = new Set(reserved);
  const extras = [];
  for (const a of [...picked, ...rest]) {
    if (reserved.length + extras.length >= SUMMARY_POOL) break;
    if (!reservedSet.has(a) && !extras.includes(a)) extras.push(a);
  }
  const keep = new Set([...reserved, ...extras]);
  const ordered = picked.filter((a) => keep.has(a));
  const placed = new Set(ordered);
  for (const a of [...reserved, ...extras]) if (!placed.has(a)) ordered.push(a);
  return reserved.length ? ownSourcesFirst(ordered) : ordered;
}

module.exports = { selectArticles, matchesKeyword, isSearchableKeyword, normalizeText, SUMMARY_POOL };
