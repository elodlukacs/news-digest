import { useState, useEffect, useCallback, useRef } from 'react';
import type { Summary } from '../../types';
import { API_BASE as BASE } from '../../config';

class SummaryRequestError extends Error {
  status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

async function readSummary(res: Response): Promise<Summary & { error?: string }> {
  let data: Summary & { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new SummaryRequestError(res.ok ? 'Invalid response from server' : `Server error (${res.status})`, res.status);
  }
  if (!res.ok) throw new SummaryRequestError(data.error || `Request failed (${res.status})`, res.status);
  return data;
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export function useSummary(
  categoryId: number | null,
  snapshotId?: number | null,
  providerId: string = 'openai/gpt-oss-20b',
) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shownCategoryRef = useRef<number | null>(null);

  // One request at a time. Whoever aborts the previous request also clears its
  // busy flags: the aborted request's own `finally` skips them, so aborting a
  // refresh (by switching category or clearing the filter) used to leave the
  // page stuck on "Refreshing…" with every action disabled until reload.
  const startRequest = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setRefreshing(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setErrorStatus(null);
    return controller;
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : 'Unknown error');
    setErrorStatus(e instanceof SummaryRequestError ? e.status : null);
  }, []);

  useEffect(() => {
    // A different category must not show the previous one's cards while its
    // own summary loads (or after that load fails).
    if (shownCategoryRef.current !== categoryId) {
      shownCategoryRef.current = categoryId;
      setSummary(null);
    }
    if (!categoryId) return;
    const controller = startRequest();

    const load = async () => {
      setLoading(true);
      try {
        const url = snapshotId
          ? `${BASE}/categories/${categoryId}/summary?summary_id=${snapshotId}`
          : `${BASE}/categories/${categoryId}/summary`;
        const data = await readSummary(await fetch(url, { signal: controller.signal }));
        // No implicit generation here. This used to POST /refresh — a paid LLM
        // call — whenever a category had no summary yet, with no user intent,
        // and re-fired it whenever the navbar model changed. The caller shows a
        // "Generate summary" affordance and calls refresh() explicitly.
        setSummary(data.summary ? data : null);
      } catch (e: unknown) {
        if (isAbort(e)) return;
        fail(e);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
    // providerId is deliberately excluded: it only affects refresh(), and
    // including it made switching models reload (and previously regenerate).
  }, [categoryId, snapshotId, startRequest, fail]);

  /**
   * Generate a new summary, optionally filtered. Resolves to it, or null.
   * On failure the summary on screen is left as it was and the server's own
   * message (and status, for rate limits) is surfaced. This used to swap in
   * the archived summary under a generic "Refresh failed" — hiding "No
   * articles found matching X" and every 429.
   */
  const refresh = useCallback(async (keyword?: string): Promise<Summary | null> => {
    if (!categoryId) return null;
    const controller = startRequest();
    setRefreshing(true);
    try {
      const res = await fetch(`${BASE}/categories/${categoryId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, keyword: keyword || undefined }),
        signal: controller.signal,
      });
      const data = await readSummary(res);
      setSummary(data);
      return data;
    } catch (e: unknown) {
      if (!isAbort(e)) fail(e);
      return null;
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, [categoryId, providerId, startRequest, fail]);

  /** Show the category's latest unfiltered summary (used to clear a filter). */
  const loadLatest = useCallback(async () => {
    if (!categoryId) return;
    const controller = startRequest();
    setLoading(true);
    try {
      const data = await readSummary(await fetch(`${BASE}/categories/${categoryId}/summary`, { signal: controller.signal }));
      setSummary(data.summary ? data : null);
    } catch (e: unknown) {
      if (!isAbort(e)) fail(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [categoryId, startRequest, fail]);

  return { summary, loading, refreshing, error, errorStatus, refresh, loadLatest };
}
