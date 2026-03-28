const { parser } = require('../rss');
const { getBiasRating } = require('./biasRatings');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
  'to', 'for', 'of', 'and', 'or', 'but', 'with', 'as', 'by', 'from',
  'that', 'this', 'it', 'its', 'be', 'have', 'has', 'had', 'not',
  'over', 'after', 'before', 'says', 'said', 'will', 'would', 'could',
  'should', 'must', 'may', 'might', 'can', 'just', 'them', 'their',
]);

<<<<<<< HEAD
const HUNGARIAN_STOPWORDS = new Set([
  'a', 'az', 'egy', 'van', 'volt', 'nem', 'és', 'vagy', 'de', 'is',
  'azt', 'akkor', 'már', 'még', 'neki', 'nekem', 'hozzá', 'vele', 'benne',
  'ebből', 'ebből', 'ezt', 'ez', 'az', 'ott', 'ahol', 'mikor', 'amikor',
  'lesz', 'volt', 'van', 'lesz', 'lesz', 'ittt', 'ott', 'így', 'úgy',
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
=======
function extractKeywords(title) {
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
  if (!title) return [];
  
  const cleaned = title
    .toLowerCase()
<<<<<<< HEAD
    .replace(/[^a-zа-яáéűőúüűa-z0-9\s]/g, '');
  
  const words = cleaned.split(/\s+/).filter((w) => w.length > 3);
  
  const stopwords = language === 'Hungarian' ? HUNGARIAN_STOPWORDS : STOPWORDS;
  const majorWords = words.filter(w => !stopwords.has(w));
  
  return majorWords.slice(0, 5);
=======
    .replace(/[^a-z0-9\s]/g, '');
  
  const words = cleaned.split(/\s+/).filter((w) => w.length > 3 && !STOPWORDS.has(w));
  
  const skipWords = new Set(['breaking', 'update', 'latest', 'news', 'report', 'coverage']);
  const majorWords = words.filter(w => !skipWords.has(w));
  
  if (majorWords.length <= 2) {
    return words.slice(0, 4);
  }
  
  return majorWords.slice(0, 4);
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
}

function buildSmartQuery(title) {
  const keywords = extractKeywords(title);
  
  if (keywords.length >= 3) {
    const phrase = keywords.slice(0, 3).join(' ');
    return [phrase, keywords.join(' OR ')];
  }
  
  return [keywords.join(' '), keywords.join(' OR ')];
}

<<<<<<< HEAD
async function searchGDELT(title, language = 'English') {
  if (!title) return [];
  
  const [exactQuery, orQuery] = buildSmartQuery(title);
=======
async function searchGDELT(title) {
  if (!title) return [];
  
  const [exactQuery, orQuery] = buildSmartQuery(title);
  
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
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

<<<<<<< HEAD
async function searchGoogleNews(title, language = 'English') {
=======
async function searchGoogleNews(title) {
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
  if (!title) return [];
  
  const [exactQuery, orQuery] = buildSmartQuery(title);
  const queriesToTry = [exactQuery, orQuery];
<<<<<<< HEAD
  const langConfig = getLanguageConfig(language);
=======
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789

  for (const query of queriesToTry) {
    if (!query) continue;
    
    try {
<<<<<<< HEAD
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
=======
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US`;
      const parsed = await parser.parseURL(url);

    if (!parsed.items || parsed.items.length === 0) {
      return [];
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
      break;
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
    } catch (err) {
      console.warn('[GoogleNews] Search failed:', err.message);
    }
  }
  
  return [];
}

<<<<<<< HEAD
async function searchAllSources(title, excludeSource = null, language = 'English') {
  console.log('[NewsSearch] Searching for:', title, 'language:', language, 'excluding:', excludeSource);

  const [gdeltResults, googleResults] = await Promise.all([
    searchGDELT(title, language),
    searchGoogleNews(title, language),
  ]);

  console.log('[NewsSearch] Results - GDELT:', gdeltResults.length, 'Google:', googleResults.length);

  const results = [...gdeltResults, ...googleResults];
=======
async function searchBingNews(title) {
  const keywords = extractKeywords(title);
  const query = keywords.slice(0, 3).join(' ');

  if (!query) return [];
  
  const BING_SUBSCRIPTION_KEY = process.env.BING_NEWS_KEY;
  if (!BING_SUBSCRIPTION_KEY) {
    return [];
  }

  try {
    const url = `https://api.bing.microsoft.com/v7.0/news/search?q=${encodeURIComponent(query)}&count=10&mkt=en-US&freshness=Day`;
    const response = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': BING_SUBSCRIPTION_KEY },
      timeout: 10000,
    });

    if (!response.ok) {
      console.warn('[Bing] API error:', response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.value || data.value.length === 0) {
      return [];
    }

    return data.value
      .filter(a => a.url && a.name)
      .map(a => ({
        title: a.name,
        url: a.url,
        source: a.provider?.[0]?.name || 'Unknown',
        biasRating: getBiasRating(a.url) || 'center',
        publishedAt: a.datePublished || '',
        excerpt: a.description?.slice(0, 200) || '',
        matchType: 'bing',
      }))
      .slice(0, 8);
  } catch (err) {
    console.warn('[Bing] Search failed:', err.message);
    return [];
  }
}

async function searchAllSources(title, excludeSource = null) {
  console.log('[NewsSearch] Searching for:', title, 'excluding:', excludeSource);

  const [gdeltResults, googleResults, bingResults] = await Promise.all([
    searchGDELT(title),
    searchGoogleNews(title),
    searchBingNews(title),
  ]);

  console.log('[NewsSearch] Results - GDELT:', gdeltResults.length, 'Google:', googleResults.length, 'Bing:', bingResults.length);

  const results = [...gdeltResults, ...googleResults, ...bingResults];
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789

  if (results.length === 0) {
    console.log('[NewsSearch] No results from any source for:', title);
    return [];
  }

<<<<<<< HEAD
=======
  console.log('[NewsSearch] Before filtering:', results.length, 'articles');

>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
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

<<<<<<< HEAD
  console.log('[NewsSearch] Final results:', biasOrdered.length, '(center/left/right)');
=======
  console.log('[NewsSearch] Final results:', biasOrdered.length, 'Returning:', biasOrdered.slice(0, 6).map(a => a.title?.slice(0, 40)));
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789

  return biasOrdered.slice(0, 6);
}

module.exports = {
  searchGDELT,
  searchGoogleNews,
<<<<<<< HEAD
  searchAllSources,
  extractKeywords,
  getLanguageConfig,
=======
  searchBingNews,
  searchAllSources,
  extractKeywords,
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
};