import { useState, useEffect, useCallback, useRef } from 'react';
import type { Category, Feed, Summary, HistoryEntry, ChatMessage, LlmStats } from '../types';

const BASE = '/api';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/categories`);
      const data = await res.json();
      setCategories(data);
    } catch (e) {
      console.error('Failed to fetch categories', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addCategory = async (name: string, icon?: string) => {
    const res = await fetch(`${BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon }),
    });
    if (!res.ok) throw new Error('Failed to add category');
    await refresh();
  };

  const deleteCategory = async (id: number) => {
    await fetch(`${BASE}/categories/${id}`, { method: 'DELETE' });
    await refresh();
  };

  return { categories, loading, refresh, addCategory, deleteCategory };
}

export function useFeeds(categoryId: number | null) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!categoryId) { setFeeds([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/categories/${categoryId}/feeds`);
      setFeeds(await res.json());
    } catch (e) {
      console.error('Failed to fetch feeds', e);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addFeed = async (name: string, url: string) => {
    if (!categoryId) return;
    const res = await fetch(`${BASE}/categories/${categoryId}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url }),
    });
    if (!res.ok) throw new Error('Failed to add feed');
    await refresh();
  };

  const deleteFeed = async (id: number) => {
    await fetch(`${BASE}/feeds/${id}`, { method: 'DELETE' });
    await refresh();
  };

  return { feeds, loading, refresh, addFeed, deleteFeed };
}

export function useSummary(categoryId: number | null, date?: string | null) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadCached = useCallback(async () => {
    if (!categoryId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const url = date
        ? `${BASE}/categories/${categoryId}/summary?date=${date}`
        : `${BASE}/categories/${categoryId}/summary`;
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load summary');
      if (data.summary) {
        setSummary(data);
      } else {
        setSummary(null);
        if (!date) await doRefresh(categoryId, controller.signal);
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [categoryId, date]);

  const refresh = useCallback(async () => {
    if (!categoryId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRefreshing(true);
    setError(null);
    try {
      await doRefresh(categoryId, controller.signal);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, [categoryId]);

  async function doRefresh(catId: number, signal: AbortSignal) {
    const res = await fetch(`${BASE}/categories/${catId}/refresh`, { method: 'POST', signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to refresh summary');
    setSummary(data);
  }

  return { summary, loading, refreshing, error, loadCached, refresh };
}

export function useSummaryHistory(categoryId: number | null) {
  const [dates, setDates] = useState<HistoryEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!categoryId) { setDates([]); return; }
    try {
      const res = await fetch(`${BASE}/categories/${categoryId}/history`);
      setDates(await res.json());
    } catch {
      setDates([]);
    }
  }, [categoryId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { dates, refresh };
}

export function useChat(summaryId: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!summaryId) { setMessages([]); return; }
    fetch(`${BASE}/chat/${summaryId}`)
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [summaryId]);

  const sendMessage = async (text: string) => {
    if (!summaryId || !text.trim()) return;
    setSending(true);
    const userMsg: ChatMessage = { role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const res = await fetch(`${BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_id: summaryId, message: text }),
      });
      const reply = await res.json();
      if (reply.content) setMessages((prev) => [...prev, reply]);
    } catch (e) {
      console.error('Chat error', e);
    } finally {
      setSending(false);
    }
  };

  return { messages, sending, sendMessage };
}

export function useBriefing() {
  const [briefing, setBriefing] = useState<{ summary: string; generated_at: string; provider?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/briefing/latest`);
      const data = await res.json();
      if (data.summary) setBriefing(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/briefing/generate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBriefing(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLatest(); }, [loadLatest]);

  return { briefing, loading, error, generate };
}

export function useLlmStats() {
  const [stats, setStats] = useState<LlmStats | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/stats/llm?days=30`);
      setStats(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, refresh };
}
