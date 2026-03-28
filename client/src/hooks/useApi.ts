import { useState, useEffect, useCallback, useRef } from 'react';
import type { Category, Feed, Summary, HistoryEntry, ChatMessage, Job, JobFilters, JobCounts, Briefing, HomepageBrief } from '../types';

import { API_BASE as BASE } from '../config';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/categories`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      if (!controller.signal.aborted) setCategories(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Failed to fetch categories', e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [refresh]);

  const addCategory = useCallback(async (name: string, icon?: string) => {
    const res = await fetch(`${BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon }),
    });
    if (!res.ok) throw new Error('Failed to add category');
    await refresh();
  }, [refresh]);

  const deleteCategory = useCallback(async (id: number) => {
    await fetch(`${BASE}/categories/${id}`, { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  return { categories, loading, refresh, addCategory, deleteCategory };
}

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
    await fetch(`${BASE}/feeds/${id}`, { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  return { feeds, loading, refresh, addFeed, deleteFeed };
}

export function useSummary(categoryId: number | null, snapshotId?: number | null, providerId: string = 'llama') {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-load when categoryId or snapshotId changes
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
        if (data.summary) {
          setSummary(data);
        } else if (!snapshotId) {
          // No cached summary and no snapshotId — auto-refresh
          const refreshRes = await fetch(`${BASE}/categories/${categoryId}/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: providerId }),
            signal: controller.signal,
          });
          const refreshData: Summary & { error?: string } = await refreshRes.json();
          if (!refreshRes.ok) throw new Error(refreshData.error || 'Failed to refresh summary');
          setSummary(refreshData);
        } else {
          setSummary(null);
        }
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
  }, [categoryId, snapshotId, providerId]);

  const refresh = useCallback(async () => {
    if (!categoryId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSummary(null);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/categories/${categoryId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to refresh summary');
      setSummary(data);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // On failure, fall back to latest cached summary from archive
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

  return { summary, loading, refreshing, error, refresh };
}

export function useSummaryHistory(categoryId: number | null) {
  const [dates, setDates] = useState<HistoryEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

export function useChat(summaryId: number | null, providerId: string = 'llama') {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!summaryId) { setMessages([]); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`${BASE}/chat/${summaryId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => { if (!controller.signal.aborted) setMessages(data); })
      .catch(() => { if (!controller.signal.aborted) setMessages([]); });

    return () => { controller.abort(); abortRef.current = null; };
  }, [summaryId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!summaryId || !text.trim()) return;
    if (sendAbortRef.current) sendAbortRef.current.abort();
    const controller = new AbortController();
    sendAbortRef.current = controller;
    const requestId = summaryId;
    setSending(true);
    setError(null);
    const userMsg: ChatMessage = { role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const res = await fetch(`${BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_id: requestId, message: text, provider: providerId }),
        signal: controller.signal,
      });
      const reply = await res.json();
      // Only append if summaryId hasn't changed since the request started
      if (reply.content && summaryId === requestId && !controller.signal.aborted) {
        setMessages((prev) => [...prev, reply]);
      } else if (!reply.content && !controller.signal.aborted) {
        setError('No response received');
      }
    } catch (e) {
      console.error('Chat error', e);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [summaryId, providerId]);

  return { messages, sending, error, sendMessage };
}

export function useBriefing(providerId: string = 'llama') {
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
      if (!res.ok) throw new Error(data.error);
      setBriefing(data);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLatest();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [loadLatest]);

  return { briefing, loading, error, generate };
}

export function useHomepage() {
  const [briefs, setBriefs] = useState<HomepageBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetch(`${BASE}/homepage`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setBriefs(data); setLoading(false); })
      .catch(() => { setLoading(false); });
    return () => { controller.abort(); abortRef.current = null; };
  }, []);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRefreshing(true);
    try {
      const res = await fetch(`${BASE}/homepage/refresh`, { method: 'POST', signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setBriefs(data);
        }
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { briefs, loading, refreshing, refresh };
}

const DEFAULT_FILTERS: JobFilters = { status: '', source: '', workType: '', search: '', country: '', aiOnly: false };

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<JobCounts>({ total: 0, new: 0, applied: 0, ignored: 0, aiFiltered: 0 });
  const [sources, setSources] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [aiFiltering, setAiFiltering] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const statusAbortRef = useRef<AbortController | null>(null);

  const fetchList = useCallback(async (f: JobFilters, p: number) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.status) params.set('status', f.status);
      if (f.source) params.set('source', f.source);
      if (f.workType) params.set('workType', f.workType);
      if (f.search) params.set('search', f.search);
      if (f.country) params.set('country', f.country);
      if (f.aiOnly) params.set('aiOnly', 'true');
      params.set('page', String(p));
      params.set('limit', '100');

      const res = await fetch(`${BASE}/jobs?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
        setTotal(data.total);
        setCounts(data.counts);
        setSources(data.sources);
        setCountries(data.countries);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList(filters, page);
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [filters, page, fetchList]);

  const updateFilters = useCallback((partial: Partial<JobFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
    setPage(1);
  }, []);

  const fetchJobs = useCallback(async () => {
    setFetching(true);
    try {
      await fetch(`${BASE}/jobs/fetch`, { method: 'POST' });
      await fetchList(filters, 1);
      setPage(1);
    } catch { /* silent */ } finally {
      setFetching(false);
    }
  }, [filters, fetchList]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    if (statusAbortRef.current) statusAbortRef.current.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;
    let previousJobs: Job[] = [];
    let previousCounts: JobCounts = { total: 0, new: 0, applied: 0, ignored: 0, aiFiltered: 0 };
    setJobs(prev => {
      previousJobs = prev;
      return prev.map(j => j.id === id ? { ...j, status: status as Job['status'] } : j);
    });
    setCounts(prev => {
      previousCounts = { ...prev };
      const updated = { ...prev };
      const job = previousJobs.find(j => j.id === id);
      if (job) {
        updated[job.status as keyof Pick<JobCounts, 'new' | 'applied' | 'ignored'>]--;
        updated[status as keyof Pick<JobCounts, 'new' | 'applied' | 'ignored'>]++;
      }
      return updated;
    });
    try {
      const res = await fetch(`${BASE}/jobs/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to update status');
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setJobs(previousJobs);
      setCounts(previousCounts);
      console.error('Failed to update job status:', e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);

  const aiFilter = useCallback(async (providerId?: string) => {
    setAiFiltering(true);
    try {
      await fetch(`${BASE}/jobs/ai-filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });
      await fetchList(filters, page);
    } catch { /* silent */ } finally {
      setAiFiltering(false);
    }
  }, [filters, page, fetchList]);

  return {
    jobs, total, counts, sources, countries,
    filters, updateFilters, page, setPage,
    loading, fetching, aiFiltering,
    fetchJobs, updateStatus, aiFilter,
    refresh: () => fetchList(filters, page),
  };
}
