/**
 * Topic research for the homepage: the user types a topic, and this explains
 * it end to end — the background, what set it off, how it escalated and where
 * it stands now — in the shape of a good video explainer.
 *
 * Three steps:
 *   1. plan    — a cheap LLM pass turns the topic into news queries,
 *                background queries and Wikipedia titles. Falls back to the
 *                raw topic when it fails, so research never dies at planning.
 *   2. gather  — Google News (recent + no time limit, for the origins),
 *                GDELT, Wikipedia intros and matching items from the feeds of
 *                categories opted into research, in parallel, each with its
 *                own timeout.
 *   3. write   — one LLM pass over the numbered sources; the narrative cites
 *                them as [n].
 */
const { buildMessages } = require('./promptManager');
const { parseJSON } = require('./parseJSON');
const { normalizeUrl } = require('./attribution');
const { fetchWithTimeout } = require('./fetchWithTimeout');
const { isSearchableKeyword } = require('./articleTriage');
const { parseFeedUrl } = require('./rss');
const { recordSuccess, recordFailure } = require('./feedHealth');
const { resolveGoogleNewsLinks } = require('./googleNewsLinks');
const {
  searchGoogleNews,
  searchGDELT,
  extractKeywords,
  getLanguageConfig,
  NEWS_SEARCH_ENABLED,
} = require('./bias-radar/newsSearch');

const DAY_MS = 86400000;
// Planning only picks search terms; past this the raw topic is good enough.
const PLAN_TIMEOUT_MS = 20000;
// GDELT regularly takes 10 s+; it is a bonus source, not worth waiting for.
const GDELT_TIMEOUT_MS = 8000;
const WIKI_TIMEOUT_MS = 5000;
const WIKI_EXTRACT_CHARS = 1800;
const WIKI_USER_AGENT = 'NewsReader/1.0 (topic research; self-hosted)';
// Items older than this count as background rather than current coverage.
const RECENT_WINDOW_MS = 45 * DAY_MS;
const MAX_RECENT = 24;
const MAX_BACKGROUND = 10;
// Several items from one outlet on one story add little; keep the list varied.
const MAX_PER_SOURCE = 3;
// Feeds from opted-in categories are fetched live on every research run;
// this bounds the fan-out if many categories are opted in.
const MAX_RESEARCH_FEEDS = 60;
// Same per-feed guard as refreshSummary: a feed that dumps its archive.
const MAX_ITEMS_PER_FEED = 60;
// Extra Google News editions searched alongside the research language's own.
// The US edition alone skews to US outlets; UK and India add British,
// European, South Asian and Gulf coverage. Other languages add English (US)
// for international wire coverage.
const EXTRA_EDITIONS = {
  English: [{ hl: 'en-GB', gl: 'GB' }, { hl: 'en-IN', gl: 'IN' }],
};
const ENGLISH_INTERNATIONAL = [{ hl: 'en-US', gl: 'US' }];
const MAX_TOPIC_LENGTH = 200;
const EXCERPT_CHARS = 280;

class ResearchError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.expose = true;
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Validate and tidy what the user typed. Throws ResearchError (400). */
function cleanTopic(raw) {
  if (typeof raw !== 'string') throw new ResearchError('Topic must be text');
  const topic = raw.replace(/\s+/g, ' ').trim();
  if (topic.length < 2) throw new ResearchError('Topic is too short');
  if (topic.length > MAX_TOPIC_LENGTH) throw new ResearchError(`Topic must be under ${MAX_TOPIC_LENGTH} characters`);
  if (!isSearchableKeyword(topic)) throw new ResearchError('Topic must contain letters or numbers');
  return topic;
}

/** Cache key: case, accents and punctuation do not make a different topic. */
function topicKey(topic) {
  return topic
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const today = () => new Date().toISOString().slice(0, 10);

const cleanList = (value, max) =>
  (Array.isArray(value) ? value : [])
    .filter((v) => typeof v === 'string')
    .map((v) => v.replace(/["']/g, '').trim())
    .filter((v) => v && v.length <= 120)
    .slice(0, max);

async function planResearch(callLLM, db, topic, provider) {
  const fallback = { topic, newsQueries: [topic], backgroundQueries: [], wikipediaTitles: [topic] };
  try {
    const messages = buildMessages('topic-research-plan', { today: today(), topic });
    const result = await withTimeout(
      callLLM(messages, {
        db,
        purpose: 'topic-research-plan',
        // Keyword extraction does not need the big model; the chain is the fallback.
        providerId: provider || 'llama8b',
        temperature: 0.2,
        max_tokens: 600,
      }),
      PLAN_TIMEOUT_MS,
      'Research planning'
    );
    const plan = parseJSON(result.content, null);
    if (!plan || typeof plan !== 'object') return fallback;

    const newsQueries = cleanList(plan.newsQueries, 3);
    return {
      topic: typeof plan.topic === 'string' && plan.topic.trim() ? plan.topic.trim().slice(0, 120) : topic,
      // The user's own wording always gets searched too.
      newsQueries: [...new Set([topic, ...newsQueries])].slice(0, 4),
      backgroundQueries: cleanList(plan.backgroundQueries, 2),
      wikipediaTitles: cleanList(plan.wikipediaTitles, 3).length ? cleanList(plan.wikipediaTitles, 3) : [topic],
    };
  } catch (err) {
    console.warn('[Research] planning failed, using the raw topic:', err.message);
    return fallback;
  }
}

/**
 * Intro section of the best-matching English Wikipedia article. Fixed host and
 * an encoded query parameter — no client-supplied URL is ever fetched here.
 */
async function fetchWikipedia(title) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: title,
    gsrlimit: '1',
    prop: 'extracts|info',
    exintro: '1',
    explaintext: '1',
    inprop: 'url',
    redirects: '1',
  });
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': WIKI_USER_AGENT } }, WIKI_TIMEOUT_MS);
    if (!res.ok) return null;
    const data = await res.json();
    const page = Object.values(data?.query?.pages || {})[0];
    const extract = (page?.extract || '').trim();
    // Disambiguation and stub pages are not background.
    if (!page?.title || extract.length < 200 || /may refer to:?$/m.test(extract.slice(0, 300))) return null;
    return {
      title: page.title,
      url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      extract: extract.slice(0, WIKI_EXTRACT_CHARS),
    };
  } catch (err) {
    console.warn(`[Research] Wikipedia lookup for "${title}" failed:`, err.message);
    return null;
  }
}

/** Ids of the categories opted into research, sorted and comma-joined ('' when none). */
function researchScope(db) {
  return db.prepare('SELECT id FROM categories WHERE include_in_research = 1 ORDER BY id')
    .all()
    .map((r) => r.id)
    .join(',');
}

/**
 * Live items from the feeds of every category opted into research (the
 * "Include in research" setting), filtered to those matching a query.
 */
async function searchResearchFeeds(db, queries) {
  const termSets = queries
    .map((q) => extractKeywords(q).map((w) => w.toLowerCase()))
    .filter((terms) => terms.length > 0);
  if (!termSets.length) return [];

  const feeds = db.prepare(`
    SELECT f.id, f.name, f.url
    FROM feeds f
    JOIN categories c ON c.id = f.category_id
    WHERE c.include_in_research = 1
    ORDER BY f.id
    LIMIT ?
  `).all(MAX_RESEARCH_FEEDS);
  if (!feeds.length) return [];

  // Every keyword of at least one query, at a word start.
  const matches = (text) => {
    const haystack = ` ${String(text).toLowerCase()}`;
    return termSets.some((terms) => terms.every((t) => haystack.includes(` ${t}`)));
  };

  const perFeed = await Promise.all(feeds.map(async (feed) => {
    try {
      const parsed = await parseFeedUrl(feed.url);
      recordSuccess(db, feed.id);
      return parsed.items.slice(0, MAX_ITEMS_PER_FEED).flatMap((item) => {
        const excerpt = String(item.contentSnippet || item.content || '')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!item.title || !item.link || !matches(`${item.title} ${excerpt}`)) return [];
        return [{
          title: item.title,
          source: feed.name,
          url: item.link,
          publishedAt: item.pubDate || item.isoDate || '',
          excerpt,
          biasRating: null,
        }];
      });
    } catch (err) {
      console.warn(`[Research] feed "${feed.name}" failed:`, err.message);
      recordFailure(db, feed.id, err.message);
      return [];
    }
  }));
  return perFeed.flat();
}

const timeOf = (item) => {
  const t = Date.parse(item.publishedAt);
  return Number.isFinite(t) && t <= Date.now() + 3600000 ? t : 0;
};

/** Dedupe by URL and title, cap per outlet, split into recent and background. */
function selectCoverage(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const unique = [];
  for (const item of items) {
    if (!item.title || !item.url) continue;
    const urlKey = normalizeUrl(item.url);
    const titleKey = topicKey(item.title);
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    unique.push(item);
  }

  const now = Date.now();
  // Undated items count as recent: every source here is a live search or feed.
  const isRecent = (item) => !timeOf(item) || now - timeOf(item) <= RECENT_WINDOW_MS;
  const pick = (list, max) => {
    const perSource = new Map();
    const out = [];
    for (const item of list) {
      const key = String(item.source || '').toLowerCase();
      const count = perSource.get(key) || 0;
      if (count >= MAX_PER_SOURCE) continue;
      perSource.set(key, count + 1);
      out.push(item);
      if (out.length >= max) break;
    }
    return out;
  };

  const byNewest = (a, b) => timeOf(b) - timeOf(a);
  return {
    recent: pick(unique.filter(isRecent).sort(byNewest), MAX_RECENT),
    background: pick(unique.filter((i) => !isRecent(i)).sort(byNewest), MAX_BACKGROUND),
  };
}

/** The research language's own edition first, then the extra ones. */
function googleEditions(language) {
  return [getLanguageConfig(language), ...(EXTRA_EDITIONS[language] || ENGLISH_INTERNATIONAL)];
}

const settle = async (promise, label) => {
  try {
    return await promise;
  } catch (err) {
    console.warn(`[Research] ${label} failed:`, err.message);
    return [];
  }
};

async function gatherSources(db, plan, language) {
  const googleShape = (results) => results.map((r) => ({
    title: r.title,
    source: r.source,
    url: r.url,
    publishedAt: r.publishedAt,
    excerpt: r.excerpt || '',
    biasRating: r.biasRating && r.biasRating !== 'unknown' ? r.biasRating : null,
  }));

  // Every news query on the main edition; the two strongest also on the other
  // editions, so coverage is not just what the US edition ranks highest.
  const google = (q, opts, label) => (NEWS_SEARCH_ENABLED
    ? settle(searchGoogleNews(q, language, opts), `Google News ${label} "${q}"`)
    : Promise.resolve([]));
  const [primary, ...extraEditions] = googleEditions(language);
  const recentSearches = [
    ...plan.newsQueries.map((q) => google(q, { limit: 25, when: '30d', edition: primary }, primary.gl)),
    ...extraEditions.flatMap((edition) => plan.newsQueries.slice(0, 2).map((q) =>
      google(q, { limit: 15, when: '30d', edition }, edition.gl))),
  ];

  const [local, recentNews, olderNews, gdelt, wiki] = await Promise.all([
    settle(searchResearchFeeds(db, plan.newsQueries), 'research feeds'),
    Promise.all(recentSearches),
    Promise.all(plan.backgroundQueries.map((q) => google(q, { limit: 15, edition: primary }, 'background'))),
    settle(withTimeout(searchGDELT(plan.topic, language), GDELT_TIMEOUT_MS, 'GDELT'), 'GDELT'),
    Promise.all(plan.wikipediaTitles.map(fetchWikipedia)),
  ]);

  // Opted-in feeds first: on a duplicate the first copy wins, and those carry real
  // article URLs and full descriptions instead of Google redirect links.
  const { recent, background } = selectCoverage([
    ...local,
    ...googleShape(recentNews.flat()),
    ...googleShape(olderNews.flat()),
    // GDELT's "excerpt" is a social image URL, not text.
    ...gdelt.map((g) => ({ ...googleShape([g])[0], excerpt: '' })),
  ]);

  const seenWiki = new Set();
  const wikiPages = wiki.filter((w) => w && !seenWiki.has(w.title) && seenWiki.add(w.title));

  console.log(
    `[Research] "${plan.topic}": ${local.length} opted-in feed, ${recentNews.flat().length} recent + ` +
    `${olderNews.flat().length} background Google, ${gdelt.length} GDELT, ${wikiPages.length} Wikipedia → ` +
    `${recent.length} recent + ${background.length} background used`
  );

  // One numbered list: Wikipedia first (background), then news newest first.
  let n = 0;
  return [
    ...wikiPages.map((w) => ({
      n: ++n, kind: 'wiki', title: w.title, source: 'Wikipedia', url: w.url, publishedAt: '', excerpt: w.extract, biasRating: null,
    })),
    ...[...recent, ...background].map((item) => ({
      n: ++n, kind: 'news', ...item, excerpt: (item.excerpt || '').slice(0, EXCERPT_CHARS),
    })),
  ];
}

function formatDate(publishedAt) {
  const t = Date.parse(publishedAt);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : 'undated';
}

function formatSources(sources) {
  const background = sources
    .filter((s) => s.kind === 'wiki')
    .map((s) => `[${s.n}] Wikipedia — ${s.title}:\n${s.excerpt}`)
    .join('\n\n');
  const coverage = sources
    .filter((s) => s.kind === 'news')
    .map((s) => `[${s.n}] ${formatDate(s.publishedAt)} · ${s.source}: ${s.title}${s.excerpt ? ` — ${s.excerpt}` : ''}`)
    .join('\n');
  return {
    background: background || '(no Wikipedia background found — rely on well-established knowledge and say so)',
    coverage: coverage || '(no news coverage found)',
  };
}

/** Compact source list for the chat prompt. */
function formatSourcesForChat(sources) {
  return sources
    .map((s) => `[${s.n}] ${s.kind === 'wiki' ? 'Wikipedia' : `${formatDate(s.publishedAt)} · ${s.source}`}: ${s.title}${s.excerpt ? ` — ${s.excerpt.slice(0, 400)}` : ''}`)
    .join('\n');
}

/** Drop citations to sources that do not exist; a model sometimes counts past the list. */
function cleanCitations(text, maxN) {
  return text
    // "[2, 5]" or "[2;5]" → "[2][5]", the form the client links.
    .replace(/\[(\d+(?:\s*[,;]\s*\d+)+)\]/g, (_, list) => list.split(/[,;]/).map((n) => `[${n.trim()}]`).join(''))
    .replace(/\[(\d+)\]/g, (match, num) => (Number(num) >= 1 && Number(num) <= maxN ? match : ''))
    .replace(/[ \t]+([.,;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

/**
 * Run the full research for a topic. Returns
 * { topic, headline, narrative, sources, provider }.
 */
async function researchTopic(callLLM, db, { topic, language = 'English', provider = null }) {
  const plan = await planResearch(callLLM, db, topic, provider);
  const sources = await gatherSources(db, plan, language);

  if (!sources.some((s) => s.kind === 'news') && !sources.some((s) => s.kind === 'wiki')) {
    throw new ResearchError(`Couldn't find any coverage of "${topic}". Try different wording.`, 404);
  }

  // Swap Google redirect links for the outlets' own URLs while the narrative
  // is being written; the model never sees URLs, so nothing waits on this.
  const linksPromise = resolveGoogleNewsLinks(db, sources.filter((s) => s.kind === 'news').map((s) => s.url))
    .catch((err) => {
      console.warn('[Research] Google News link resolution failed:', err.message);
      return new Map();
    });

  const { background, coverage } = formatSources(sources);
  // Data variables before the user's topic: renderPrompt substitutes in order,
  // so a `{{...}}` typed into the topic is never expanded.
  const messages = buildMessages('topic-research', {
    today: today(),
    sentences: '10-15',
    language,
    background,
    coverage,
    topic,
  });
  const result = await callLLM(messages, {
    db,
    purpose: 'topic-research',
    providerId: provider,
    temperature: 0.4,
    max_tokens: 2500,
  });

  const parsed = parseJSON(result.content, null);
  let headline = typeof parsed?.headline === 'string' ? parsed.headline.trim() : '';
  let narrative = typeof parsed?.narrative === 'string' ? parsed.narrative.trim() : '';
  if (!narrative) {
    // The model ignored the JSON instruction: its prose is still the answer.
    narrative = String(result.content || '').replace(/^```\w*\s*|```\s*$/g, '').trim();
  }
  if (!narrative) throw new ResearchError('The model returned an empty answer. Please try again.', 502);
  if (!headline) headline = plan.topic;

  const articleUrls = await linksPromise;
  return {
    topic,
    headline: headline.slice(0, 200),
    narrative: cleanCitations(narrative, sources.length),
    // Unresolved links keep the Google URL, which still redirects to the article.
    sources: sources.map((s) => (articleUrls.has(s.url) ? { ...s, url: articleUrls.get(s.url) } : s)),
    provider: result.provider || null,
  };
}

module.exports = { researchTopic, researchScope, cleanTopic, topicKey, formatSourcesForChat, ResearchError };
