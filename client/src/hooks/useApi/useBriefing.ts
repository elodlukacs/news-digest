import { useState, useEffect, useCallback, useRef } from 'react';
import type { Briefing } from '../../types';
import { API_BASE as BASE } from '../../config';

export function useBriefing(providerId: string = 'openai/gpt-oss-20b') {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadLatest = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/briefing/latest`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error('Failed to load briefing');
      const data = await res.json();
      if (data.summary) setBriefing(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load briefing');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const generate = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/briefing/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate briefing');
      setBriefing(data);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadLatest();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [loadLatest]);

  return { briefing, loading, error, generate };
}
