const { parser } = require('../rss');
const { getBiasRating } = require('./biasRatings');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
  'to', 'for', 'of', 'and', 'or', 'but', 'with', 'as', 'by', 'from',
  'that', 'this', 'it', 'its', 'be', 'have', 'has', 'had', 'not',
  'over', 'after', 'before', 'says', 'said', 'will', 'would', 'could',
  'should', 'must', 'may', 'might', 'can', 'just', 'them', 'their',
  // Common headline words that are too generic for topic matching
  'former', 'family', 'death', 'claim', 'leads', 'react', 'calls',
  'gets', 'take', 'make', 'back', 'also', 'like', 'only', 'come',
  'give', 'find', 'much', 'still', 'very', 'well', 'even', 'know',
  'want', 'need', 'been', 'here', 'them', 'then', 'than', 'when',
  'each', 'what', 'your', 'more', 'some', 'about', 'which', 'their',
  'first', 'after', 'being', 'could', 'other', 'these', 'where',
  'those', 'while', 'under', 'using', 'every', 'between', 'during',
  'before', 'since', 'through', 'against', 'without', 'because',
]);

const HUNGARIAN_STOPWORDS = new Set([
  'a', 'az', 'egy', 'van', 'volt', 'nem', 'és', 'vagy', 'de', 'is',
  'azt', 'akkor', 'már', 'még', 'neki', 'nekem', 'hozzá', 'vele', 'benne',
]);

const LANGUAGE_CONFIGS = {
  English: { hl: 'en-US', gl: 'US' },
  Hungarian: { hl: 'hu', gl: 'HU' },
  German: { hl: 'de', gl: 'DE' },
  French: { hl: 'fr', gl: 'FR' },
  Spanish: { hl: 'es', gl: 'ES' },
  Italian: { hl: 'it', gl: 'IT' },
  Portuguese: { hl: 'pt', gl: 'PT' },
  Russian: { hl: 'ru', gl: 'RU' },
  Chinese: { hl: 'zh-CN', gl: 'CN' },
  Japanese: { hl: 'ja', gl: 'JP' },
};

function getLanguageConfig(language) {
  return LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS['English'];
}

function extractKeywords(title, language = 'English') {
  if (!title) return [];
  
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-záéűőúüűa-z0-9\s]/g, '');
  
  const words = cleaned.split(/\s+/).filter((w) => w.length > 3);
  
  const stopwords = language === 'Hungarian' ? HUNGARIAN_STOPWORDS : STOPWORDS;
  const majorWords = words.filter(w => !stopwords.has(w));
  
  return majorWords.slice(0, 5);
}

function buildSmartQuery(title) {
  const keywords = extractKeywords(title);
  
  if (keywords.length >= 3) {
    const phrase = keywords.slice(0, 3).join(' ');
    return [phrase, keywords.join(' OR ')];
  }
  
  return [keywords.join(' '), keywords.join(' OR ')];
}

async function searchGDELT(title, language = 'English') {
  if (!title) return [];

  const [exactQuery, orQuery] = buildSmartQuery(title);
  if (!exactQuery) return [];

  const urlsToTry = [
    { url: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent('"' + exactQuery + '"')}&mode=artlist&maxrecords=15&format=json&sort=DateDesc`, label: 'exact' },
    { url: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(orQuery)}&mode=artlist&maxrecords=15&format=json&sort=DateDesc`, label: 'or' },
  ];

  for (const { url: gdeltUrl, label } of urlsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(gdeltUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[GDELT] ${label} query returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.articles && data.articles.length > 0) {
        return data.articles
          .filter(a => a.url && a.title)
          .map(a => ({
            title: a.title,
            url: a.url,
            source: a.domain || 'Unknown',
            biasRating: getBiasRating(a.url) || 'unknown',
            publishedAt: a.seendate || '',
            excerpt: a.socialimage || '',
            matchType: 'gdelt',
          }))
          .slice(0, 10);
      }
    } catch (err) {
      console.warn(`[GDELT] ${label} query failed:`, err.message);
      continue;
    }
  }

  return [];
}

async function searchGoogleNews(title, language = 'English') {
  if (!title) return [];

  const [exactQuery, orQuery] = buildSmartQuery(title);
  // Try full title first (Google News handles natural language well), then keyword queries
  const queriesToTry = [title, exactQuery, orQuery].filter(Boolean);
  const langConfig = getLanguageConfig(language);

  for (const query of queriesToTry) {
    if (!query) continue;

    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${langConfig.hl}&gl=${langConfig.gl}`;
      const parsed = await parser.parseURL(url);

      if (!parsed.items || parsed.items.length === 0) {
        console.warn('[GoogleNews] No results for query:', query);
        continue;
      }

      console.debug('[GoogleNews] Got', parsed.items.length, 'items for query:', query);

      return parsed.items
        .slice(0, 10)
        .filter((item) => item.link)
        .map((item) => {
          // Google News titles are "Article Title - Publisher Name"
          const titleMatch = item.title?.match(/^(.+)\s+-\s+(.+)$/);
          const articleTitle = titleMatch ? titleMatch[1].trim() : item.title;
          const publisherFromTitle = titleMatch ? titleMatch[2].trim() : null;

          let source = publisherFromTitle || 'Unknown';
          let ratingUrl = item.link;
          try {
            if (item.source?.url) {
              ratingUrl = item.source.url;
              // If we didn't get a publisher from the title, use source metadata
              if (!publisherFromTitle) {
                source = item.source.title || new URL(item.source.url).hostname.replace('www.', '');
              }
            }
          } catch {}

          return {
            title: articleTitle,
            url: item.link,
            source,
            biasRating: getBiasRating(ratingUrl) || 'unknown',
            publishedAt: item.pubDate || '',
            excerpt: item.contentSnippet?.slice(0, 200) || '',
            matchType: 'google',
          };
        });
    } catch (err) {
      console.warn('[GoogleNews] Search failed:', err.message);
    }
  }
  
  return [];
}

async function searchAllSources(title, excludeSource = null, language = 'English') {
  console.debug('[NewsSearch] Searching for:', title, 'language:', language, 'excluding:', excludeSource);

  const searchKeywords = extractKeywords(title, language);

  const [gdeltResults, googleResults] = await Promise.all([
    searchGDELT(title, language),
    searchGoogleNews(title, language),
  ]);

  console.debug('[NewsSearch] Results - GDELT:', gdeltResults.length, 'Google:', googleResults.length);

  const results = [...gdeltResults, ...googleResults];

  if (results.length === 0) {
    console.debug('[NewsSearch] No results from any source for:', title);
    return [];
  }

  let filtered = results;
  if (excludeSource) {
    filtered = results.filter(
      a => !a.source.toLowerCase().includes(excludeSource.toLowerCase())
    );
  }

  // Relevance filter: require at least one keyword overlap with search title
  if (searchKeywords.length > 0) {
    const relevant = filtered.filter((a) => {
      const articleTitle = (a.title || '').toLowerCase();
      return searchKeywords.some(kw => articleTitle.includes(kw));
    });
    // Only use filtered results if we have enough; otherwise keep originals
    if (relevant.length >= 3) {
      console.debug('[NewsSearch] Relevance filter:', filtered.length, '→', relevant.length);
      filtered = relevant;
    }
  }

  const seen = new Map();
  const deduped = filtered.filter((a) => {
    try {
      const domain = new URL(a.url).hostname.replace('www.', '').replace('news.google.com', 'google');
      if (seen.has(domain)) return false;
      seen.set(domain, true);
      return true;
    } catch {
      return true;
    }
  });

  // Prioritize rated sources over unrated, then sort center-outward
  const biasOrdered = deduped.sort((a, b) => {
    const aRated = a.biasRating !== 'unknown';
    const bRated = b.biasRating !== 'unknown';
    if (aRated !== bRated) return aRated ? -1 : 1;
    const biasOrder = { left: 0, 'lean-left': 1, center: 2, 'lean-right': 3, right: 4 };
    const biasA = biasOrder[a.biasRating] ?? 2;
    const biasB = biasOrder[b.biasRating] ?? 2;
    return Math.abs(biasA - 2) - Math.abs(biasB - 2);
  });

  console.debug('[NewsSearch] Final results:', biasOrdered.length);

  return biasOrdered.slice(0, 6);
}

module.exports = {
  searchGDELT,
  searchGoogleNews,
  searchAllSources,
  extractKeywords,
  getLanguageConfig,
};