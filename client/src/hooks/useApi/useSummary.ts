import { useState, useEffect, useCallback, useRef } from 'react';
import type { Summary } from '../../types';
import { API_BASE as BASE } from '../../config';

export function useSummary(
  categoryId: number | null,
  snapshotId?: number | null,
  providerId: string = 'openai/gpt-oss-20b',
) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!categoryId) { setSummary(null); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = snapshotId
          ? `${BASE}/categories/${categoryId}/summary?summary_id=${snapshotId}`
          : `${BASE}/categories/${categoryId}/summary`;
        const res = await fetch(url, { signal: controller.signal });
        let data: Summary & { error?: string };
        try {
          data = await res.json();
        } catch {
          if (!res.ok) throw new Error(`Server error (${res.status})`);
          throw new Error('Invalid response from server');
        }
        if (!res.ok) throw new Error(data.error || 'Failed to load summary');
        // No implicit generation here. This used to POST /refresh — a paid LLM
        // call — whenever a category had no summary yet, with no user intent,
        // and re-fired it whenever the navbar model changed. The caller shows a
        // "Generate summary" affordance and calls refresh() explicitly.
        setSummary(data.summary ? data : null);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    // providerId is deliberately excluded: it only affects refresh(), and
    // including it made switching models reload (and previously regenerate).
  }, [categoryId, snapshotId]);

  const refresh = useCallback(async (keyword?: string) => {
    if (!categoryId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/categories/${categoryId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, keyword: keyword || undefined }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to refresh summary');
      setSummary(data);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      try {
        const fallbackRes = await fetch(`${BASE}/categories/${categoryId}/summary`, { signal: controller.signal });
        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok && fallbackData.summary) {
          setSummary(fallbackData);
          setError('Refresh failed — showing latest from archive');
        } else {
          setError(e instanceof Error ? e.message : 'Unknown error');
        }
      } catch {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, [categoryId, providerId]);

  const loadLatest = useCallback(async () => {
    if (!categoryId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/categories/${categoryId}/summary`, { signal: controller.signal });
      const data: Summary & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load summary');
      if (data.summary) setSummary(data);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [categoryId]);

  return { summary, loading, refreshing, error, refresh, loadLatest };
}
