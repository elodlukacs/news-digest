const { parser } = require('../rss');
const { getBiasRating } = require('./biasRatings');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
  'to', 'for', 'of', 'and', 'or', 'but', 'with', 'as', 'by', 'from',
  'that', 'this', 'it', 'its', 'be', 'have', 'has', 'had', 'not',
  'over', 'after', 'before', 'says', 'said', 'will', 'would', 'could',
  'should', 'must', 'may', 'might', 'can', 'just', 'them', 'their',
]);

function extractKeywords(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 5);
}

async function searchGDELT(title) {
  const keywords = extractKeywords(title);
  const query = keywords.join(' ');
  
  if (!query) return [];

  try {
    const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=15&format=json&sort=DateDesc`;
    
    const response = await fetch(gdeltUrl, { timeout: 15000 });
    if (!response.ok) {
      console.warn('[GDELT] Request failed:', response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.articles || data.articles.length === 0) {
      return [];
    }

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
      .slice(0, 8);
  } catch (err) {
    console.warn('[GDELT] Search failed:', err.message);
    return [];
  }
}

async function searchGoogleNews(title) {
  const keywords = extractKeywords(title);
  const query = keywords.slice(0, 2).join(' ');

  if (!query) return [];

  try {
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
  } catch (err) {
    console.warn('[GoogleNews] Search failed:', err.message);
    return [];
  }
}

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
  const results = [];

  const [gdeltResults, googleResults, bingResults] = await Promise.all([
    searchGDELT(title),
    searchGoogleNews(title),
    searchBingNews(title),
  ]);

  results.push(...gdeltResults, ...googleResults, ...bingResults);

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

  return biasOrdered.slice(0, 6);
}

module.exports = {
  searchGDELT,
  searchGoogleNews,
  searchBingNews,
  searchAllSources,
  extractKeywords,
};