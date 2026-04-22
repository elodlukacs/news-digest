import { useState, useCallback, useRef } from 'react';
import { API_BASE as BASE } from '../../config';

export function useLens(categoryId: number | null, providerId: string) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [lensName, setLensName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (lensSlug: string) => {
    if (!categoryId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setContent(null);
    setLensName(null);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/categories/${categoryId}/lens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lensSlug, provider: providerId }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run lens');
      setContent(data.content);
      setLensName(data.lensName);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [categoryId, providerId]);

  const clear = useCallback(() => {
    setContent(null);
    setLensName(null);
    setError(null);
  }, []);

  return { loading, content, lensName, error, run, clear };
}
