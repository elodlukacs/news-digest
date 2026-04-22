import { useState, useEffect, useCallback, useRef } from 'react';
import type { Feed } from '../../types';
import { API_BASE as BASE } from '../../config';

export function useFeeds(categoryId: number | null) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!categoryId) { setFeeds([]); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/categories/${categoryId}/feeds`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch feeds');
      const data = await res.json();
      if (!controller.signal.aborted) setFeeds(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Failed to fetch feeds', e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    refresh();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [refresh]);

  const addFeed = useCallback(async (name: string, url: string) => {
    if (!categoryId) return;
    const res = await fetch(`${BASE}/categories/${categoryId}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url }),
    });
    if (!res.ok) throw new Error('Failed to add feed');
    await refresh();
  }, [categoryId, refresh]);

  const deleteFeed = useCallback(async (id: number) => {
    const res = await fetch(`${BASE}/feeds/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete feed');
    await refresh();
  }, [refresh]);

  return { feeds, loading, refresh, addFeed, deleteFeed };
}
