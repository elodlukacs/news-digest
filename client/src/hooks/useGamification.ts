import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../config';
import type { GamificationStats, ChallengeResult, RecoveryResult } from '../types';

export function useGamification() {
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/gamification/stats`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch gamification stats');
      const data = await res.json();
      if (!controller.signal.aborted) setStats(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Failed to fetch gamification stats', e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [refresh]);

  const completeChallenge = useCallback(async (antibodiesEarned = 1, source = 'daily_quiz'): Promise<ChallengeResult> => {
    const res = await fetch(`${API_BASE}/gamification/complete-challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ antibodiesEarned, source }),
    });
    if (!res.ok) throw new Error('Failed to complete challenge');
    const data: ChallengeResult = await res.json();
    await refresh();
    return data;
  }, [refresh]);

  const applyRecoveryBoost = useCallback(async (): Promise<RecoveryResult> => {
    const res = await fetch(`${API_BASE}/gamification/recovery-boost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to use recovery boost');
    }
    const data: RecoveryResult = await res.json();
    await refresh();
    return data;
  }, [refresh]);

  return { stats, loading, refresh, completeChallenge, applyRecoveryBoost };
}
