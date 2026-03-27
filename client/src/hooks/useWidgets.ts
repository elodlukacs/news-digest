import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';
import type { CryptoPrice, HackerNewsItem, UpcomingRelease, Weather, Rates, Headline } from '../types';

export function useWidgets() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [crypto, setCrypto] = useState<CryptoPrice[]>([]);
  const [hackerNews, setHackerNews] = useState<HackerNewsItem[]>([]);
  const [releases, setReleases] = useState<UpcomingRelease[]>([]);
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    Promise.all([
      fetch(`${API_BASE}/widgets/weather`, { signal: controller.signal }).then(r => { if (!r.ok) return null; return r.json(); }).catch(() => null),
      fetch(`${API_BASE}/widgets/rates`, { signal: controller.signal }).then(r => { if (!r.ok) return null; return r.json(); }).catch(() => null),
      fetch(`${API_BASE}/widgets/headlines`, { signal: controller.signal }).then(r => { if (!r.ok) return null; return r.json(); }).catch(() => null),
      fetch(`${API_BASE}/widgets/crypto`, { signal: controller.signal }).then(r => { if (!r.ok) return null; return r.json(); }).catch(() => null),
      fetch(`${API_BASE}/widgets/hackernews`, { signal: controller.signal }).then(r => { if (!r.ok) return null; return r.json(); }).catch(() => null),
      fetch(`${API_BASE}/widgets/releases`, { signal: controller.signal }).then(r => { if (!r.ok) return null; return r.json(); }).catch(() => null),
      fetch(`${API_BASE}/tags/trending`, { signal: controller.signal }).then(r => { if (!r.ok) return null; return r.json(); }).catch(() => null),
    ]).then(([w, r, h, c, hn, rel, t]) => {
      if (controller.signal.aborted) return;
      if (w) setWeather(w);
      if (r) setRates(r);
      if (h) setHeadlines(h);
      if (c) setCrypto(c);
      if (hn) setHackerNews(hn);
      if (rel) setReleases(rel);
      if (t) setTrending(t);
      setLoading(false);
    });

    return () => { controller.abort(); abortRef.current = null; };
  }, []);

  return { weather, rates, headlines, crypto, hackerNews, releases, trending, loading };
}
