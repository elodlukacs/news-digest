import { useState, useEffect, useCallback, useRef } from 'react';
import type { Category, Feed, Summary, HistoryEntry, ChatMessage, Job, JobFilters, JobCounts, Briefing } from '../types';

import { API_BASE as BASE } from '../config';

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
        const data = await res.json();
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
          const refreshData = await refreshRes.json();
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

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!categoryId) { setDates([]); return; }
      try {
        const res = await fetch(`${BASE}/categories/${categoryId}/history`);
        const data = await res.json();
        if (!cancelled) setDates(data);
      } catch {
        if (!cancelled) setDates([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [categoryId, refreshKey]);
  return { dates, refresh };
}

export function useChat(summaryId: number | null, providerId: string = 'llama') {
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
        body: JSON.stringify({ summary_id: summaryId, message: text, provider: providerId }),
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
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/briefing/latest`);
      const data = await res.json();
      if (data.summary) setBriefing(data);
    } catch { /* silent */ } finally {
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

export interface HomepageArticle {
  title: string;
  excerpt: string;
  link: string;
  image: string;
  pubDate: string;
  source: string;
}

export interface HomepageBrief {
  categoryId: number;
  categoryName: string;
  articles: HomepageArticle[];
}

export function useHomepage() {
  const [briefs, setBriefs] = useState<HomepageBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/homepage`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setBriefs(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${BASE}/homepage/refresh`, { method: 'POST' });
      const data = await res.json();
      if (Array.isArray(data)) setBriefs(data);
    } catch { /* silent */ }
    setRefreshing(false);
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

  const fetchList = useCallback(async (f: JobFilters, p: number) => {
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

      const res = await fetch(`${BASE}/jobs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
        setTotal(data.total);
        setCounts(data.counts);
        setSources(data.sources);
        setCountries(data.countries);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(filters, page); }, [filters, page, fetchList]);

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
    const previousJobs = jobs;
    const previousCounts = { ...counts };
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: status as Job['status'] } : j));
    setCounts(prev => {
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
      });
      if (!res.ok) throw new Error('Failed to update status');
    } catch {
      setJobs(previousJobs);
      setCounts(previousCounts);
    }
  }, [jobs, counts]);

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
