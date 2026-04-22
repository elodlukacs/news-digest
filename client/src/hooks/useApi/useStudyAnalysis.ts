import { useState, useEffect, useCallback, useRef } from 'react';
import type { StudyAnalysis, StudyAnalysisEntry } from '../../types';
import { API_BASE as BASE } from '../../config';

export function useStudyAnalysis() {
  const [result, setResult] = useState<StudyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StudyAnalysisEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/forensics/study/history?limit=20`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Failed to load study history:', err); setHistory([]); } finally { setHistoryLoading(false); }
  }, []);

  const analyze = useCallback(async (headline: string, provider?: string) => {
    if (headline.trim().length < 10) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/forensics/study`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: headline.trim(), provider }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed');
      }
      const data = await res.json();
      if (!controller.signal.aborted) setResult(data);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { result, loading, error, analyze, history, historyLoading, loadHistory };
}
