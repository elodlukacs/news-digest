const { parser } = require('../rss');
const { getBiasRating } = require('./biasRatings');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
  'to', 'for', 'of', 'and', 'or', 'but', 'with', 'as', 'by', 'from',
  'that', 'this', 'it', 'its', 'be', 'have', 'has', 'had', 'not',
  'over', 'after', 'before', 'says', 'said', 'will', 'would', 'could',
  'should', 'must', 'may', 'might', 'can', 'just', 'them', 'their',
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
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent('"' + exactQuery + '"')}&mode=artlist&maxrecords=15&format=json&sort=DateDesc`,
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(orQuery)}&mode=artlist&maxrecords=15&format=json&sort=DateDesc`,
  ];

  for (const gdeltUrl of urlsToTry) {
    try {
      const response = await fetch(gdeltUrl, { timeout: 15000 });
      if (!response.ok) continue;

      const data = await response.json();
      
      if (data.articles && data.articles.length > 0) {
        return data.articles
          .filter(a => a.url && a.title)
          .map(a => ({
            title: a.title,
            url: a.url,
            source: a.domain || 'Unknown',
            biasRating: getBiasRating(a.url) || 'center',
            publishedAt: a.seendate || '',
            excerpt: a.socialimage || '',
            matchType: 'gdelt',
          }))
          .slice(0, 10);
      }
    } catch {
      continue;
    }
  }

  return [];
}

async function searchGoogleNews(title, language = 'English') {
  if (!title) return [];
  
  const [exactQuery, orQuery] = buildSmartQuery(title);
  const queriesToTry = [exactQuery, orQuery];
  const langConfig = getLanguageConfig(language);

  for (const query of queriesToTry) {
    if (!query) continue;
    
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${langConfig.hl}&gl=${langConfig.gl}`;
      const parsed = await parser.parseURL(url);

      if (!parsed.items || parsed.items.length === 0) {
        continue;
      }

      return parsed.items
        .slice(0, 10)
        .filter((item) => item.link)
        .map((item) => {
          let source = 'Google News';
          try {
            const url = new URL(item.link);
            const paths = url.pathname.split('/').filter(Boolean);
            if (paths.length > 0 && paths[0] !== 'rss' && paths[0] !== 'search') {
              source = paths[0];
            }
          } catch {}
          
          return {
            title: item.title?.replace(/^.*? - /, '') || item.title,
            url: item.link,
            source,
            biasRating: getBiasRating(item.link) || 'center',
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
  console.log('[NewsSearch] Searching for:', title, 'language:', language, 'excluding:', excludeSource);

  const [gdeltResults, googleResults] = await Promise.all([
    searchGDELT(title, language),
    searchGoogleNews(title, language),
  ]);

  console.log('[NewsSearch] Results - GDELT:', gdeltResults.length, 'Google:', googleResults.length);

  const results = [...gdeltResults, ...googleResults];

  if (results.length === 0) {
    console.log('[NewsSearch] No results from any source for:', title);
    return [];
  }

  let filtered = results;
  if (excludeSource) {
    filtered = results.filter(
      a => !a.source.toLowerCase().includes(excludeSource.toLowerCase())
    );
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

  const biasOrdered = deduped.sort((a, b) => {
    const biasOrder = { left: 0, 'lean-left': 1, center: 2, 'lean-right': 3, right: 4 };
    const biasA = biasOrder[a.biasRating] ?? 2;
    const biasB = biasOrder[b.biasRating] ?? 2;
    return Math.abs(biasA - 2) - Math.abs(biasB - 2);
  });

  console.log('[NewsSearch] Final results:', biasOrdered.length);

  return biasOrdered.slice(0, 6);
}

module.exports = {
  searchGDELT,
  searchGoogleNews,
  searchAllSources,
  extractKeywords,
  getLanguageConfig,
};