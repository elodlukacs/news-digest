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
 *                categories opted into research, in parallel, under one
 *                deadline.
 *   3. write   — one LLM pass over the numbered sources (oldest first, each
 *                labelled with its publication date); the model lists a
 *                dated timeline, then writes the narrative citing [n].
 *                Off-by-one citations are repaired afterwards.
 */
const { buildMessages } = require('./promptManager');
const { parseJSON } = require('./parseJSON');
const { normalizeUrl } = require('./attribution');
const { fetchWithTimeout } = require('./fetchWithTimeout');
const { isSearchableKeyword, normalizeText } = require('./articleTriage');
const { matchOutlet } = require('./outletMatcher');
const { parseFeedUrl } = require('./rss');
const { recordSuccess, recordFailure } = require('./feedHealth');
const { resolveGoogleNewsLinks } = require('./googleNewsLinks');
const {
  searchGoogleNews,
  searchGDELT,
  getLanguageConfig,
  NEWS_SEARCH_ENABLED,
} = require('./bias-radar/newsSearch');

const DAY_MS = 86400000;
// Planning only picks search terms; past this the raw topic is good enough.
const PLAN_TIMEOUT_MS = 20000;
// Every source together must answer within this; late ones are dropped.
// Without it a slow feed or Google query (15 s each) could hold the request
// well past a reverse proxy's timeout.
const GATHER_DEADLINE_MS = 15000;
// GDELT regularly takes 10 s+; it is a bonus source, not worth waiting for.
const GDELT_TIMEOUT_MS = 8000;
const WIKI_TIMEOUT_MS = 5000;
const WIKI_EXTRACT_CHARS = 1800;
const WIKI_USER_AGENT = 'NewsReader/1.0 (topic research; self-hosted)';
// Items older than this count as background rather than current coverage.
const RECENT_WINDOW_MS = 45 * DAY_MS;
const MAX_RECENT = 24;
const MAX_BACKGROUND = 10;
// The recent list is spread across ages: a hot topic's newest 24 items are
// often all from the last two days, which hides how it escalated.
const RECENT_TIERS = [
  { maxAgeMs: 3 * DAY_MS, quota: 10 },
  { maxAgeMs: 14 * DAY_MS, quota: 8 },
  { maxAgeMs: RECENT_WINDOW_MS, quota: 6 },
];
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
// A fixed target holds length better than a range; the prompt allows fewer
// when the sources are thin.
const TARGET_SENTENCES = 12;
// The visible reply (timeline + 12 sentences) is ~1k tokens. The headroom is
// for reasoning models, which count hidden thinking against max_tokens: on
// gpt-oss a 3500 limit left the answer cut off mid-timeline.
const WRITER_MAX_TOKENS = 8000;
// Words too common to show that a sentence and a source are about the same thing.
const MATCH_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'was', 'were', 'are', 'has', 'have', 'had',
  'its', 'his', 'her', 'their', 'into', 'over', 'after', 'before', 'about', 'which', 'when', 'while',
  'said', 'says', 'will', 'would', 'could', 'been', 'also', 'than', 'then', 'more', 'most', 'new',
]);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const settle = async (promise, label) => {
  try {
    return await promise;
  } catch (err) {
    console.warn(`[Research] ${label} failed:`, err.message);
    return [];
  }
};

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
        // The model chosen in the menu, like every other research call; the
        // rest of the chain is the fallback.
        providerId: provider,
        temperature: 0.2,
        // Headroom for reasoning models, which spend part of this thinking;
        // at 600 they returned empty content.
        max_tokens: 3000,
      }),
      PLAN_TIMEOUT_MS,
      'Research planning'
    );
    const plan = parseJSON(result.content, null);
    if (!plan || typeof plan !== 'object') return fallback;

    const newsQueries = cleanList(plan.newsQueries, 3);
    const wikipediaTitles = cleanList(plan.wikipediaTitles, 3);
    return {
      topic: typeof plan.topic === 'string' && plan.topic.trim() ? plan.topic.trim().slice(0, 120) : topic,
      // The user's own wording always gets searched too.
      newsQueries: [...new Set([topic, ...newsQueries])].slice(0, 4),
      backgroundQueries: cleanList(plan.backgroundQueries, 2),
      wikipediaTitles: wikipediaTitles.length ? wikipediaTitles : [topic],
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
    // The timeout covers headers and body: fetchWithTimeout alone stops at headers.
    const data = await withTimeout(
      fetchWithTimeout(url, { headers: { 'User-Agent': WIKI_USER_AGENT } }, WIKI_TIMEOUT_MS)
        .then((res) => (res.ok ? res.json() : null)),
      WIKI_TIMEOUT_MS,
      'Wikipedia'
    );
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

const significantWords = (text) =>
  normalizeText(text).split(' ').filter((w) => w.length >= 2 && !MATCH_STOPWORDS.has(w));

/**
 * Text matcher for a set of queries: true when every significant word of at
 * least one query appears. Short words ("ai", "eu") must match whole words so
 * "ai" doesn't match "aid"; longer ones match at a word start ("tariff" →
 * "tariffs"). normalizeText folds accents and keeps letters in any script.
 */
function queryMatcher(queries) {
  const termSets = queries.map(significantWords).filter((terms) => terms.length > 0);
  return (text) => {
    const haystack = ` ${normalizeText(text)} `;
    return termSets.some((terms) => terms.every((t) => haystack.includes(t.length <= 3 ? ` ${t} ` : ` ${t}`)));
  };
}

/**
 * Live items from the feeds of every category opted into research (the
 * "Include in research" setting), filtered to those matching a query.
 */
async function searchResearchFeeds(db, queries, deadlineMs) {
  const matches = queryMatcher(queries);

  // One fetch per distinct feed: the same feed in two opted-in categories
  // shares a url_key.
  const feeds = db.prepare(`
    SELECT MIN(f.id) AS id, MIN(f.name) AS name, MIN(f.url) AS url
    FROM feeds f
    JOIN categories c ON c.id = f.category_id
    WHERE c.include_in_research = 1
    GROUP BY COALESCE(f.url_key, f.url)
    ORDER BY MIN(f.id)
    LIMIT ?
  `).all(MAX_RESEARCH_FEEDS);
  if (!feeds.length) return [];

  const perFeed = await Promise.all(feeds.map(async (feed) => {
    try {
      const parsed = await withTimeout(parseFeedUrl(feed.url), deadlineMs, `feed "${feed.name}"`);
      recordSuccess(db, feed.id);
      const biasRating = matchOutlet(feed.name)?.bias || null;
      return parsed.items.slice(0, MAX_ITEMS_PER_FEED).flatMap((item) => {
        const excerpt = String(item.contentSnippet || item.content || '')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!item.title || !item.link || !matches(`${item.title} ${excerpt}`)) return [];
        return [{
          title: item.title,
          source: feed.name,
          url: item.link,
          // isoDate is rss-parser's normalised form of pubDate.
          publishedAt: item.isoDate || item.pubDate || '',
          excerpt,
          biasRating,
        }];
      });
    } catch (err) {
      console.warn(`[Research] feed "${feed.name}" failed:`, err.message);
      // Our own deadline says nothing about the feed's health.
      if (!/timed out after/.test(err.message)) recordFailure(db, feed.id, err.message);
      return [];
    }
  }));
  return perFeed.flat();
}

const timeOf = (item) => {
  const t = Date.parse(item.publishedAt);
  return Number.isFinite(t) && t <= Date.now() + 3600000 ? t : 0;
};

/** An excerpt that only repeats the headline (Google News RSS: "Title  Publisher") wastes prompt space. */
function usefulExcerpt(title, excerpt) {
  const e = normalizeText(excerpt);
  return !e || e.startsWith(normalizeText(title)) ? '' : excerpt;
}

/**
 * Dedupe by URL and title, cap per outlet, split into recent (spread across
 * RECENT_TIERS) and background.
 */
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
  const age = (item) => (timeOf(item) ? now - timeOf(item) : 0);
  // Undated items count as recent: every source here is a live search or feed.
  const isRecent = (item) => age(item) <= RECENT_WINDOW_MS;
  const byNewest = (a, b) => timeOf(b) - timeOf(a);

  // Shared per-outlet cap, so the tiers can't each take three from one outlet.
  const perSource = new Map();
  const taken = new Set();
  const pick = (list, max) => {
    const out = [];
    for (const item of list) {
      if (out.length >= max) break;
      if (taken.has(item)) continue;
      const key = String(item.source || '').toLowerCase();
      const count = perSource.get(key) || 0;
      if (count >= MAX_PER_SOURCE) continue;
      perSource.set(key, count + 1);
      taken.add(item);
      out.push(item);
    }
    return out;
  };

  const recentPool = unique.filter(isRecent).sort(byNewest);
  const recent = [];
  let minAge = -1;
  for (const tier of RECENT_TIERS) {
    const inTier = recentPool.filter((i) => age(i) > minAge && age(i) <= tier.maxAgeMs);
    recent.push(...pick(inTier, tier.quota));
    minAge = tier.maxAgeMs;
  }
  // A quiet tier leaves room: fill it newest first.
  recent.push(...pick(recentPool, MAX_RECENT - recent.length));

  return {
    recent,
    background: pick(unique.filter((i) => !isRecent(i)).sort(byNewest), MAX_BACKGROUND),
  };
}

/** The research language's own edition first, then the extra ones. */
function googleEditions(language) {
  return [getLanguageConfig(language), ...(EXTRA_EDITIONS[language] || ENGLISH_INTERNATIONAL)];
}

async function gatherSources(db, plan, language) {
  const googleShape = (results) => results.map((r) => ({
    title: r.title,
    source: r.source,
    url: r.url,
    publishedAt: r.publishedAt,
    excerpt: r.excerpt || '',
    biasRating: r.biasRating && r.biasRating !== 'unknown' ? r.biasRating : null,
  }));

  const bounded = (promise, label, ms = GATHER_DEADLINE_MS) => settle(withTimeout(promise, ms, label), label);
  // Planner queries are already short keywords: no OR-of-keywords fallback,
  // which pulled in loosely related stories.
  const google = (q, opts, label) => (NEWS_SEARCH_ENABLED
    ? bounded(searchGoogleNews(q, language, { ...opts, fallback: false }), `Google News ${label} "${q}"`)
    : Promise.resolve([]));
  // Every news query on the main edition; the two strongest also on the other
  // editions, so coverage is not just what the US edition ranks highest.
  const [primary, ...extraEditions] = googleEditions(language);
  const recentSearches = [
    ...plan.newsQueries.map((q) => google(q, { limit: 25, when: '30d', edition: primary }, primary.gl)),
    ...extraEditions.flatMap((edition) => plan.newsQueries.slice(0, 2).map((q) =>
      google(q, { limit: 15, when: '30d', edition }, edition.gl))),
  ];

  const [local, recentNews, olderNews, gdelt, wiki] = await Promise.all([
    settle(searchResearchFeeds(db, plan.newsQueries, GATHER_DEADLINE_MS), 'research feeds'),
    Promise.all(recentSearches),
    Promise.all(plan.backgroundQueries.map((q) => google(q, { limit: 15, edition: primary }, 'background'))),
    bounded(searchGDELT(plan.topic, language), 'GDELT', GDELT_TIMEOUT_MS),
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

  // One numbered list: Wikipedia first (background), then news oldest first,
  // undated last. A higher number is a later item — a time cue the model
  // can't miss — and the newest items sit right before the task.
  const byOldest = (a, b) => (timeOf(a) || Infinity) - (timeOf(b) || Infinity);
  let n = 0;
  return [
    ...wikiPages.map((w) => ({
      n: ++n, kind: 'wiki', title: w.title, source: 'Wikipedia', url: w.url, publishedAt: '', excerpt: w.extract, biasRating: null,
    })),
    ...[...background, ...recent].sort(byOldest).map((item) => ({
      n: ++n, kind: 'news', ...item, excerpt: usefulExcerpt(item.title, item.excerpt || '').slice(0, EXCERPT_CHARS),
    })),
  ];
}

function formatDate(publishedAt) {
  const t = Date.parse(publishedAt);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : 'undated';
}

/**
 * "pub Thu 2026-10-01 (6d ago)": weekday so "on Tuesday" in the text can be
 * resolved, age so recency is obvious, and "pub" so it isn't read as the
 * date of the event.
 */
function pubLabel(publishedAt, now = Date.now()) {
  const t = timeOf({ publishedAt });
  if (!t) return 'pub unknown';
  const days = Math.floor((now - t) / DAY_MS);
  const ago = days <= 0 ? 'today' : days === 1 ? '1d ago' : `${days}d ago`;
  return `pub ${WEEKDAYS[new Date(t).getUTCDay()]} ${new Date(t).toISOString().slice(0, 10)} (${ago})`;
}

function formatSources(sources) {
  const background = sources
    .filter((s) => s.kind === 'wiki')
    .map((s) => `[${s.n}] Wikipedia — ${s.title}:\n${s.excerpt}`)
    .join('\n\n');
  const coverage = sources
    .filter((s) => s.kind === 'news')
    .map((s) => `[${s.n}] ${pubLabel(s.publishedAt)} · ${s.source} — ${s.title}${s.excerpt ? `. ${s.excerpt}` : ''}`)
    .join('\n');
  return {
    background: background || '(none)',
    coverage: coverage || '(none)',
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
 * Fix the most common citation slip: the right claim, a neighbouring number.
 * A citation moves to n±1 only when the cited source shares no meaningful
 * word with its sentence and the neighbour shares at least two. Conservative
 * on purpose — and only for English output, where the words are comparable.
 */
function repairCitations(text, sources) {
  const vocab = new Map(sources.map((s) => [
    s.n,
    new Set(significantWords(`${s.title} ${s.excerpt}`).filter((w) => w.length >= 4)),
  ]));
  const overlap = (sentenceWords, n) => {
    const known = vocab.get(n);
    return known ? sentenceWords.filter((w) => known.has(w)).length : 0;
  };
  let repaired = 0;
  const out = text.replace(/[^.!?\n]*(?:\[\d+\])+[^.!?\n]*[.!?]?/g, (sentence) => {
    const sentenceWords = significantWords(sentence.replace(/\[\d+\]/g, ' ')).filter((w) => w.length >= 4);
    return sentence.replace(/\[(\d+)\]/g, (match, num) => {
      const n = Number(num);
      if (overlap(sentenceWords, n) > 0) return match;
      const best = [n - 1, n + 1]
        .map((m) => ({ m, score: overlap(sentenceWords, m) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best.score < 2) return match;
      repaired++;
      return `[${best.m}]`;
    });
  });
  if (repaired) console.log(`[Research] repaired ${repaired} off-by-one citation(s)`);
  return out;
}

/** The narrative out of the writer's reply, whatever shape it came back in. */
function extractNarrative(content, parsed) {
  if (Array.isArray(parsed?.paragraphs)) {
    return parsed.paragraphs.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim()).join('\n\n');
  }
  if (typeof parsed?.narrative === 'string') return parsed.narrative.trim();
  const raw = String(content || '').replace(/^```\w*\s*|```\s*$/g, '').trim();
  // Plain prose: the model ignored the JSON instruction, but it is the answer.
  if (!raw.startsWith('{')) return raw;
  // JSON cut off mid-reply that parseJSON couldn't recover: keep the complete
  // paragraph strings that did arrive (long strings; timeline entries are short).
  return [...raw.matchAll(/"((?:[^"\\]|\\.){80,})"/g)]
    .map((m) => {
      try { return JSON.parse(`"${m[1]}"`); } catch { return ''; }
    })
    .filter(Boolean)
    .join('\n\n');
}

const sentenceCount = (text) => (text.replace(/\[\d+\]/g, '').match(/[^.!?]+[.!?]+(?=\s|$)/g) || []).length;

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
    sentences: String(TARGET_SENTENCES),
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
    max_tokens: WRITER_MAX_TOKENS,
  });

  const parsed = parseJSON(result.content, null);
  let headline = typeof parsed?.headline === 'string' ? parsed.headline.trim() : '';
  let narrative = extractNarrative(result.content, parsed);
  if (!narrative) {
    console.warn(`[Research] no narrative in the writer's reply (${String(result.content || '').length} chars): ${String(result.content || '').slice(0, 400)}`);
    throw new ResearchError('The model returned an empty answer. Please try again.', 502);
  }
  if (!headline) headline = plan.topic;
  narrative = cleanCitations(narrative, sources.length);
  if (language === 'English') narrative = repairCitations(narrative, sources);
  const timelineLength = Array.isArray(parsed?.timeline) ? parsed.timeline.length : 0;
  console.log(`[Research] "${plan.topic}": ${sentenceCount(narrative)} sentences (target ${TARGET_SENTENCES}), ${timelineLength} timeline events`);

  const articleUrls = await linksPromise;
  return {
    topic,
    headline: headline.slice(0, 200),
    narrative,
    // Unresolved links keep the Google URL, which still redirects to the article.
    sources: sources.map((s) => (articleUrls.has(s.url) ? { ...s, url: articleUrls.get(s.url) } : s)),
    provider: result.provider || null,
  };
}

module.exports = {
  researchTopic,
  researchScope,
  cleanTopic,
  topicKey,
  formatSourcesForChat,
  ResearchError,
  // Exported so they can be checked from the command line; not used elsewhere.
  queryMatcher,
  repairCitations,
  extractNarrative,
};
