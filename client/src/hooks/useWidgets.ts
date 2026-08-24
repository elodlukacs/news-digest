import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import type { CryptoPrice, UpcomingRelease, Weather, Rates, Headline } from '../types';
import type { WeirdFactWidget, OnThisDayEvent } from '../types/widgets';

/**
 * Widget data with a module-level TTL cache.
 *
 * Eight parallel requests used to re-fire on every mount, so navigating between
 * Briefing and Releases re-fetched everything each time — and a failed widget
 * was indistinguishable from an empty one, because errors collapsed to null.
 * The server already caches these upstream; this stops the round trips.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface WidgetData {
  weather: Weather | null;
  rates: Rates | null;
  headlines: Headline[];
  crypto: CryptoPrice[];
  releases: UpcomingRelease[];
  trending: { tag: string; count: number }[];
  weirdFact: WeirdFactWidget | null;
  onThisDay: OnThisDayEvent[];
}

const EMPTY: WidgetData = {
  weather: null,
  rates: null,
  headlines: [],
  crypto: [],
  releases: [],
  trending: [],
  weirdFact: null,
  onThisDay: [],
};

type WidgetKey = keyof WidgetData;

let cache: { data: WidgetData; errors: Partial<Record<WidgetKey, string>>; fetchedAt: number } | null = null;
let inFlight: Promise<{ data: WidgetData; errors: Partial<Record<WidgetKey, string>> }> | null = null;

async function getJson(path: string, signal: AbortSignal) {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function loadWidgets(signal: AbortSignal) {
  const sources: { key: WidgetKey; path: string; pick?: (d: unknown) => unknown }[] = [
    { key: 'weather', path: '/widgets/weather' },
    { key: 'rates', path: '/widgets/rates' },
    { key: 'headlines', path: '/widgets/headlines' },
    { key: 'crypto', path: '/widgets/crypto' },
    { key: 'releases', path: '/widgets/releases', pick: (d) => (d as { items?: unknown })?.items ?? d },
    { key: 'trending', path: '/tags/trending' },
    { key: 'weirdFact', path: '/widgets/weird-fact' },
    { key: 'onThisDay', path: '/widgets/on-this-day' },
  ];

  const settled = await Promise.allSettled(
    sources.map(s => getJson(s.path, signal).then(d => (s.pick ? s.pick(d) : d))),
  );

  const data: WidgetData = { ...EMPTY };
  const errors: Partial<Record<WidgetKey, string>> = {};

  settled.forEach((result, i) => {
    const { key } = sources[i];
    if (result.status === 'fulfilled' && result.value != null) {
      (data as unknown as Record<string, unknown>)[key] = result.value;
    } else if (result.status === 'rejected') {
      // Per-widget errors, so the UI can say "unavailable" rather than
      // rendering an empty widget that looks like there's simply no data.
      errors[key] = result.reason instanceof Error ? result.reason.message : 'failed';
    }
  });

  return { data, errors };
}

export function useWidgets() {
  const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS ? cache : null;
  const [data, setData] = useState<WidgetData>(fresh?.data ?? EMPTY);
  const [errors, setErrors] = useState<Partial<Record<WidgetKey, string>>>(fresh?.errors ?? {});
  const [loading, setLoading] = useState(!fresh);

  useEffect(() => {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      setData(cache.data);
      setErrors(cache.errors);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    // Share one request set across simultaneous mounts.
    const request = inFlight ?? (inFlight = loadWidgets(controller.signal).finally(() => {
      inFlight = null;
    }));

    request
      .then(({ data: next, errors: nextErrors }) => {
        cache = { data: next, errors: nextErrors, fetchedAt: Date.now() };
        if (cancelled) return;
        setData(next);
        setErrors(nextErrors);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // Only abort if nothing else is waiting on this request set.
      if (!inFlight) controller.abort();
    };
  }, []);

  return { ...data, errors, loading };
}
