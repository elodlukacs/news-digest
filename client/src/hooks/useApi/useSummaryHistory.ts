import { useState, useEffect, useCallback, useRef } from 'react';
import type { HistoryEntry } from '../../types';
import { API_BASE as BASE } from '../../config';

export function useSummaryHistory(categoryId: number | null) {
  const [dates, setDates] = useState<HistoryEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!categoryId) { setDates([]); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${BASE}/categories/${categoryId}/history`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setDates(data);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (!cancelled) setDates([]);
      }
    }
    load();
    return () => { cancelled = true; controller.abort(); abortRef.current = null; };
  }, [categoryId, refreshKey]);

  return { dates, refresh };
}
