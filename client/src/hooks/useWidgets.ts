import { useState, useEffect } from 'react';
import type { CryptoPrice, HackerNewsItem, OnThisDayEvent, UpcomingRelease } from '../types';

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
  const [onThisDay, setOnThisDay] = useState<OnThisDayEvent[]>([]);
  const [releases, setReleases] = useState<UpcomingRelease[]>([]);
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    fetch('/api/widgets/weather').then((r) => r.json()).then(setWeather).catch(() => {});
    fetch('/api/widgets/rates').then((r) => r.json()).then(setRates).catch(() => {});
    fetch('/api/widgets/headlines').then((r) => r.json()).then(setHeadlines).catch(() => {});
    fetch('/api/widgets/crypto').then((r) => r.json()).then(setCrypto).catch(() => {});
    fetch('/api/widgets/hackernews').then((r) => r.json()).then(setHackerNews).catch(() => {});
    fetch('/api/widgets/on-this-day').then((r) => r.json()).then(setOnThisDay).catch(() => {});
    fetch('/api/widgets/releases').then((r) => r.json()).then(setReleases).catch(() => {});
    fetch('/api/tags/trending').then((r) => r.json()).then(setTrending).catch(() => {});
  }, []);

  return { weather, rates, headlines, crypto, hackerNews, onThisDay, releases, trending };
}
