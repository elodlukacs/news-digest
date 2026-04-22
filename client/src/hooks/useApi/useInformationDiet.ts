import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { LlmContext } from '../../contexts/LlmContext';
import type { InformationDietResult } from '../../types';
import { API_BASE as BASE } from '../../config';

export function useInformationDiet(sources: { name: string; url?: string }[]) {
  const selectedLlm = useContext(LlmContext);
  const [result, setResult] = useState<InformationDietResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async () => {
    if (sources.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE}/bridge/information-diet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources, provider: selectedLlm }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [sources, selectedLlm]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { result, loading, error, analyze };
}
