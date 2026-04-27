import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExploreCatalog, DiscoveredFeed } from '../../types';
import { API_BASE as BASE } from '../../config';

export function useExploreFeeds() {
  const [catalog, setCatalog] = useState<ExploreCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/explore-feeds`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to load explore catalog');
      const data: ExploreCatalog = await res.json();
      if (!controller.signal.aborted) setCatalog(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Failed to load explore catalog', e);
      if (!controller.signal.aborted) setError('Could not load catalogue');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [refresh]);

  const subscribe = useCallback(async (categoryId: number, name: string, url: string) => {
    const res = await fetch(`${BASE}/categories/${categoryId}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to subscribe');
    }
    await refresh();
  }, [refresh]);

  const discoverFromUrl = useCallback(async (url: string): Promise<DiscoveredFeed[]> => {
    const res = await fetch(`${BASE}/discover-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error('Discovery failed');
    const data = await res.json();
    return data.feeds || [];
  }, []);

  return { catalog, loading, error, refresh, subscribe, discoverFromUrl };
}
