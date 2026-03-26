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

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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
    const controller = new AbortController();
    const { signal } = controller;

    fetchJson<Weather>(`${API_BASE}/widgets/weather`, signal).then(d => { if (d) setWeather(d); });
    fetchJson<Rates>(`${API_BASE}/widgets/rates`, signal).then(d => { if (d) setRates(d); });
    fetchJson<Headline[]>(`${API_BASE}/widgets/headlines`, signal).then(d => { if (d) setHeadlines(d); });
    fetchJson<CryptoPrice[]>(`${API_BASE}/widgets/crypto`, signal).then(d => { if (d) setCrypto(d); });
    fetchJson<HackerNewsItem[]>(`${API_BASE}/widgets/hackernews`, signal).then(d => { if (d) setHackerNews(d); });
    fetchJson<UpcomingRelease[]>(`${API_BASE}/widgets/releases`, signal).then(d => { if (d) setReleases(d); });
    fetchJson<{ tag: string; count: number }[]>(`${API_BASE}/tags/trending`, signal).then(d => { if (d) setTrending(d); });

    return () => controller.abort();
  }, []);

  return { weather, rates, headlines, crypto, hackerNews, releases, trending };
}
