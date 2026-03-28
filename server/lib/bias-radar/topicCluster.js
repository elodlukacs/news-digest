const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
  'to', 'for', 'of', 'and', 'or', 'but', 'with', 'as', 'by', 'from',
  'that', 'this', 'it', 'its', 'be', 'have', 'has', 'had', 'not',
  'over', 'after', 'before', 'says', 'said', 'will', 'would', 'could',
  'should', 'must', 'may', 'might', 'can', 'just', 'them', 'their',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now',
]);

const BIAS_ORDER = {
  left: 0,
  'lean-left': 1,
  center: 2,
  'lean-right': 3,
  right: 4,
};

function extractKeywords(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function keywordOverlap(a, b) {
  if (!a || !b) return 0;
  const setB = new Set(b);
  return a.filter((w) => setB.has(w)).length;
}

function normalizeDate(dateStr) {
  if (!dateStr) return 0;
  try {
    return new Date(dateStr).getTime();
  } catch {
    return 0;
  }
}

function findRelatedArticles(articles, targetId, options = {}) {
  const {
    windowHours = 48,
    maxResults = 3,
    minOverlap = 2,
  } = options;

  const target = articles.find((a) => a.id === targetId);
  if (!target) return [];

  const targetWords = extractKeywords(target.title || target.description || '');
  const targetTime = normalizeDate(target.publishedAt || target.pubDate);
  const windowMs = windowHours * 60 * 60 * 1000;

  const candidates = articles
    .filter((a) => {
      if (a.id === targetId) return false;
      
      const sourceMatch = a.feed_name === target.feed_name || a.source === target.source;
      if (sourceMatch) return false;

      const articleTime = normalizeDate(a.publishedAt || a.pubDate);
      if (isNaN(articleTime)) return false;
      
      const timeDiff = Math.abs(articleTime - targetTime);
      if (timeDiff > windowMs) return false;

      const candidateWords = extractKeywords(a.title || a.description || '');
      const overlap = keywordOverlap(targetWords, candidateWords);
      
      return overlap >= minOverlap;
    })
    .sort((a, b) => {
      const biasA = BIAS_ORDER[a.biasRating] ?? 2;
      const biasB = BIAS_ORDER[b.biasRating] ?? 2;
      return biasA - biasB;
    });

  const seen = new Set();
  const results = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.biasRating)) continue;
    seen.add(candidate.biasRating);
    results.push(candidate);
    if (results.length >= maxResults) break;
  }

  return results;
}

function getTopicSignature(title) {
  const keywords = extractKeywords(title);
  return keywords.sort().slice(0, 5).join('_');
}

function clusterArticlesByTopic(articles, windowHours = 72) {
  const clusters = [];
  const windowMs = windowHours * 60 * 60 * 1000;
  const processed = new Set();

  for (const article of articles) {
    if (processed.has(article.id)) continue;

    const articleTime = normalizeDate(article.publishedAt || article.pubDate);
    const topicSig = getTopicSignature(article.title || article.description || '');

    const cluster = [article];
    processed.add(article.id);

    for (const other of articles) {
      if (processed.has(other.id)) continue;

      const otherTime = normalizeDate(other.publishedAt || other.pubDate);
      const timeDiff = Math.abs(articleTime - otherTime);
      
      if (timeDiff > windowMs) continue;

      const otherSig = getTopicSignature(other.title || other.description || '');
      if (topicSig === otherSig || keywordOverlap(extractKeywords(article.title || article.description || ''), extractKeywords(other.title || other.description || '')) >= 2) {
        cluster.push(other);
        processed.add(other.id);
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

module.exports = {
  extractKeywords,
  keywordOverlap,
  findRelatedArticles,
  getTopicSignature,
  clusterArticlesByTopic,
  STOPWORDS,
};