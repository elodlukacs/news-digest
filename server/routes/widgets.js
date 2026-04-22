const express = require('express');
const { parser } = require('../lib/rss');
const { fetchWithTimeout } = require('../lib/fetchWithTimeout');

const router = express.Router();

let cryptoCache = { data: null, fetchedAt: 0 };
const releasesCache = new Map();

router.get('/weather', async (req, res) => {
  try {
    const lat = req.query.lat || 46.77;
    const lon = req.query.lon || 23.60;
    const resp = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=4&timezone=auto`
    );
    const data = await resp.json();
    const current = data.current;

    const weatherCodes = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
      55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
      71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
      81: 'Heavy rain showers', 95: 'Thunderstorm',
    };

    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      if (data.daily?.time?.[i]) {
        forecast.push({
          date: data.daily.time[i],
          code: data.daily.weather_code[i],
          condition: weatherCodes[data.daily.weather_code[i]] || 'Unknown',
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
        });
      }
    }

    res.json({
      temperature: Math.round(current.temperature_2m),
      code: current.weather_code,
      condition: weatherCodes[current.weather_code] || 'Unknown',
      wind: Math.round(current.wind_speed_10m),
      humidity: current.relative_humidity_2m,
      location: 'Cluj-Napoca',
      forecast,
    });
  } catch (err) {
    console.error('Weather error:', err);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

router.get('/rates', async (req, res) => {
  try {
    const resp = await fetchWithTimeout('https://open.er-api.com/v6/latest/RON');
    const data = await resp.json();
    const pick = ['EUR', 'USD', 'GBP', 'HUF'];
    const rates = {};
    for (const c of pick) {
      if (data.rates[c]) rates[c] = data.rates[c];
    }
    res.json({
      base: 'RON',
      date: data.time_last_update_utc?.split(' ').slice(1, 4).join(' ') || '',
      rates,
    });
  } catch (err) {
    console.error('Rates error:', err);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

router.get('/headlines', async (req, res) => {
  try {
    const pbsFeed = { name: 'PBS', url: 'https://www.pbs.org/newshour/feeds/rss/headlines' };

    const results = await Promise.allSettled(
      [pbsFeed].map(async (feed) => {
        const parsed = await parser.parseURL(feed.url);
        return parsed.items.slice(0, 10).map((item) => ({
          title: item.title || '',
          link: item.link || '',
          source: feed.name,
          pubDate: item.pubDate || '',
        }));
      })
    );

    const headlines = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    res.json(headlines);
  } catch (err) {
    console.error('Headlines error:', err);
    res.status(500).json({ error: 'Failed to fetch headlines' });
  }
});

router.get('/crypto', async (req, res) => {
  if (cryptoCache.data && Date.now() - cryptoCache.fetchedAt < 120_000) {
    return res.json(cryptoCache.data);
  }
  try {
    const resp = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
    const data = await resp.json();
    if (!data.bitcoin?.usd) {
      if (cryptoCache.data) return res.json(cryptoCache.data);
      return res.json([]);
    }
    const coins = [
      { id: 'bitcoin', symbol: 'BTC', price: data.bitcoin.usd, change_24h: data.bitcoin.usd_24h_change || 0 },
      { id: 'ethereum', symbol: 'ETH', price: data.ethereum?.usd || 0, change_24h: data.ethereum?.usd_24h_change || 0 },
      { id: 'solana', symbol: 'SOL', price: data.solana?.usd || 0, change_24h: data.solana?.usd_24h_change || 0 },
    ];
    cryptoCache = { data: coins, fetchedAt: Date.now() };
    res.json(coins);
  } catch (err) {
    console.error('Crypto error:', err);
    if (cryptoCache.data) return res.json(cryptoCache.data);
    res.status(500).json({ error: 'Failed to fetch crypto prices' });
  }
});

router.get('/releases', async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.json({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });

  const today = new Date();
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + 7);
  const from = req.query.from || today.toISOString().split('T')[0];
  const to = req.query.to || defaultEnd.toISOString().split('T')[0];
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
  const cacheKey = `${from}|${to}`;

  const cached = releasesCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 30 * 60_000) {
    const { allReleases } = cached;
    const total = allReleases.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    return res.json({
      items: allReleases.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    });
  }

  try {
    const ALLOWED_LANGUAGES = new Set(['en', 'hu']);
    const TMDB_PAGES = 3;

    const moviePages = await Promise.all(
      Array.from({ length: TMDB_PAGES }, (_, i) =>
        fetchWithTimeout(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&primary_release_date.gte=${from}&primary_release_date.lte=${to}&sort_by=popularity.desc&page=${i + 1}&without_genres=16`)
          .then(r => r.json())
      )
    );
    const tvPages = await Promise.all(
      Array.from({ length: TMDB_PAGES }, (_, i) =>
        fetchWithTimeout(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&first_air_date.gte=${from}&first_air_date.lte=${to}&sort_by=popularity.desc&page=${i + 1}&without_genres=16`)
          .then(r => r.json())
      )
    );

    const movies = moviePages
      .flatMap(d => d.results || [])
      .filter(m => ALLOWED_LANGUAGES.has(m.original_language))
      .map(m => ({
        id: m.id,
        title: m.title,
        date: m.release_date,
        type: 'movie',
        rating: m.vote_average || null,
        overview: m.overview?.slice(0, 120) || '',
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
      }));

    const shows = tvPages
      .flatMap(d => d.results || [])
      .filter(t => ALLOWED_LANGUAGES.has(t.original_language))
      .map(t => ({
        id: t.id,
        title: t.name,
        date: t.first_air_date,
        type: 'tv',
        rating: t.vote_average || null,
        overview: t.overview?.slice(0, 120) || '',
        poster: t.poster_path ? `https://image.tmdb.org/t/p/w185${t.poster_path}` : null,
      }));

    const allReleases = [...movies, ...shows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    releasesCache.set(cacheKey, { allReleases, fetchedAt: Date.now() });
    if (releasesCache.size > 20) {
      const oldest = releasesCache.keys().next().value;
      releasesCache.delete(oldest);
    }

    const total = allReleases.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    res.json({
      items: allReleases.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (err) {
    console.error('TMDB error:', err);
    if (cached) {
      const { allReleases } = cached;
      const total = allReleases.length;
      const totalPages = Math.ceil(total / pageSize);
      const start = (page - 1) * pageSize;
      return res.json({
        items: allReleases.slice(start, start + pageSize),
        total,
        page,
        pageSize,
        totalPages,
      });
    }
    res.status(500).json({ error: 'Failed to fetch releases' });
  }
});

router.get('/releases/:type/:id', async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB not configured' });

  const { type, id } = req.params;
  if (type !== 'movie' && type !== 'tv') return res.status(400).json({ error: 'Invalid type' });

  try {
    const resp = await fetchWithTimeout(`https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&append_to_response=credits,videos`);
    const data = await resp.json();
    if (data.success === false) return res.status(404).json({ error: 'Not found' });

    const cast = (data.credits?.cast || []).slice(0, 8).map(c => c.name);
    const directors = (data.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name);
    const creators = (data.created_by || []).map(c => c.name);
    const trailer = (data.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const genres = (data.genres || []).map(g => g.name);

    res.json({
      id: data.id,
      title: data.title || data.name,
      tagline: data.tagline || null,
      overview: data.overview || '',
      date: data.release_date || data.first_air_date || '',
      type,
      rating: data.vote_average || null,
      votes: data.vote_count || 0,
      runtime: data.runtime || (data.episode_run_time?.[0]) || null,
      genres,
      cast,
      directors: type === 'movie' ? directors : creators,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w300${data.poster_path}` : null,
      backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}` : null,
      trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      seasons: data.number_of_seasons || null,
      episodes: data.number_of_episodes || null,
      status: data.status || null,
    });
  } catch (err) {
    console.error('TMDB detail error:', err);
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});

// ─── Daily Weird Fact ───
let weirdFactCache = { data: null, fetchedAt: 0 };
router.get('/weird-fact', async (req, res) => {
  const TTL = 24 * 60 * 60 * 1000;
  if (weirdFactCache.data && Date.now() - weirdFactCache.fetchedAt < TTL) {
    return res.json(weirdFactCache.data);
  }
  try {
    const parsed = await parser.parseURL('https://www.atlasobscura.com/feeds/latest');
    const item = parsed.items[0];
    if (!item) return res.json(null);
    const data = {
      title: item.title || '',
      link: item.link || '',
      source: 'Atlas Obscura',
      pubDate: item.pubDate || '',
    };
    weirdFactCache = { data, fetchedAt: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Weird fact error:', err);
    if (weirdFactCache.data) return res.json(weirdFactCache.data);
    res.status(500).json({ error: 'Failed to fetch weird fact' });
  }
});

// ─── On This Day ───
let onThisDayCache = { data: null, fetchedAt: 0 };
router.get('/on-this-day', async (req, res) => {
  const TTL = 24 * 60 * 60 * 1000;
  if (onThisDayCache.data && Date.now() - onThisDayCache.fetchedAt < TTL) {
    return res.json(onThisDayCache.data);
  }
  try {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${mm}/${dd}`;
    const resp = await fetchWithTimeout(url, {}, 5000);
    const data = await resp.json();
    const events = (data.selected || data.events || []).slice(0, 3).map(e => ({
      year: e.year,
      text: e.text,
      link: e.pages?.[0]?.content_urls?.desktop?.page || null,
    }));
    onThisDayCache = { data: events, fetchedAt: Date.now() };
    res.json(events);
  } catch (err) {
    console.error('On this day error:', err);
    if (onThisDayCache.data) return res.json(onThisDayCache.data);
    res.status(500).json({ error: 'Failed to fetch on this day' });
  }
});

module.exports = router;
