/**
 * Match an LLM-produced summary section back to the source article it came from.
 *
 * This used to be a single expression:
 *
 *   allArticles.find(o => o.link === a.url || o.title.toLowerCase() === a.title.toLowerCase())
 *
 * but the `category-summary` prompt asks the model to *rewrite* titles (and to
 * translate them when the category language isn't English). Every rewritten
 * title that also lost its URL fell through to `undefined`, which zeroed
 * `source`, `pub_date` and `image` — and because `enrichSentimentData` keys off
 * `entry.source`, `matchOutlet` never ran either. The visible symptom was
 * intermittently missing bias bars, credibility badges and images.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'as', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'it',
  'its', 'this', 'that', 'these', 'those', 'has', 'have', 'had', 'will', 'says',
]);

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|source|cmp|ito)/i;

/** Strip protocol, www, trailing slash and tracking params so equivalent URLs compare equal. */
function normalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  try {
    const url = new URL(raw.trim());
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    const host = url.hostname.replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}${url.search}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
  }
}

/** Crude suffix stripping so "spreading"/"spread" and "talks"/"talk" match. */
function stem(word) {
  return word
    .replace(/(ing|edly|ed|es|s)$/, '')
    .replace(/(.)\1$/, '$1');
}

function titleTokens(title) {
  return new Set(
    String(title || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      .map(stem)
      .filter(w => w.length > 2)
  );
}

/**
 * Overlap coefficient (shared / smaller set), not Jaccard: a rewritten headline
 * is often much shorter or longer than the original, which Jaccard penalises
 * even when every significant word is shared.
 */
function titleSimilarity(a, b) {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return { score: shared / Math.min(ta.size, tb.size), shared };
}

// A wrong source badge is worse than a missing one, so a fuzzy match must be
// both strong and clearly better than the runner-up.
const SIMILARITY_THRESHOLD = 0.5;
const MIN_SHARED_TOKENS = 2;
const MIN_MARGIN = 0.15;

/**
 * Resolve one LLM section to a source article.
 *
 * @param section     Parsed LLM output — may carry `url`, `title`, `source_index`.
 * @param articles    The articles handed to the model, in prompt order.
 * @param urlIndex    Map of normalized URL -> article (built once by the caller).
 * @returns { article, method } — `article` is null when nothing matched.
 */
function attributeSection(section, articles, urlIndex) {
  // 1. Explicit index, if the model echoed the [n] marker from the prompt.
  const idx = Number(section.source_index ?? section.sourceIndex);
  if (Number.isInteger(idx) && idx >= 1 && idx <= articles.length) {
    return { article: articles[idx - 1], method: 'index' };
  }

  // 2. Normalized URL — survives tracking params and http/https differences.
  const byUrl = urlIndex.get(normalizeUrl(section.url));
  if (byUrl) return { article: byUrl, method: 'url' };

  // 3. Exact title, normalized.
  const wanted = String(section.title || '').trim().toLowerCase();
  if (wanted) {
    const exact = articles.find(a => String(a.title || '').trim().toLowerCase() === wanted);
    if (exact) return { article: exact, method: 'title' };
  }

  // 4. Fuzzy title — catches rewrites that keep the substantive words.
  //    Translated titles legitimately score 0 here and stay unattributed.
  let best = null;
  let bestScore = 0;
  let bestShared = 0;
  let runnerUp = 0;
  for (const article of articles) {
    const { score, shared } = titleSimilarity(section.title, article.title);
    if (score > bestScore) {
      runnerUp = bestScore;
      bestScore = score;
      bestShared = shared;
      best = article;
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }
  if (
    best
    && bestScore >= SIMILARITY_THRESHOLD
    && bestShared >= MIN_SHARED_TOKENS
    && bestScore - runnerUp >= MIN_MARGIN
  ) {
    return { article: best, method: 'fuzzy' };
  }

  return { article: null, method: 'none' };
}

/** Build the URL lookup once per refresh rather than scanning per section. */
function buildUrlIndex(articles) {
  const index = new Map();
  for (const article of articles) {
    const key = normalizeUrl(article.link);
    if (key && !index.has(key)) index.set(key, article);
  }
  return index;
}

module.exports = { attributeSection, buildUrlIndex, normalizeUrl, titleSimilarity };
