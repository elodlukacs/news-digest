import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import type { CryptoPrice, HackerNewsItem, UpcomingRelease } from '../types';

interface ForecastDay {
  date: string;
  code: number;
  condition: string;
  high: number;
  low: number;
}

interface Weather {
  temperature: number;
  code: number;
  condition: string;
  wind: number;
  humidity: number;
  location: string;
  forecast: ForecastDay[];
}

interface Rates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface Headline {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

export function useWidgets() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [crypto, setCrypto] = useState<CryptoPrice[]>([]);
  const [hackerNews, setHackerNews] = useState<HackerNewsItem[]>([]);
  const [releases, setReleases] = useState<UpcomingRelease[]>([]);
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`${API_BASE}/widgets/weather`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/widgets/rates`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/widgets/headlines`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/widgets/crypto`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/widgets/hackernews`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/widgets/releases`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/tags/trending`).then(r => r.json()).catch(() => null),
    ]).then(([w, r, h, c, hn, rel, t]) => {
      if (cancelled) return;
      if (w) setWeather(w);
      if (r) setRates(r);
      if (h) setHeadlines(h);
      if (c) setCrypto(c);
      if (hn) setHackerNews(hn);
      if (rel) setReleases(rel);
      if (t) setTrending(t);
    });

    return () => { cancelled = true; };
  }, []);

  return { weather, rates, headlines, crypto, hackerNews, releases, trending };
}
