import { useState, useEffect, useCallback, useRef } from 'react';
import type { Job, JobFilters, JobCounts, SourceCounts, FetchReport } from '../../types';
import { API_BASE as BASE } from '../../config';

export const DEFAULT_FILTERS: JobFilters = {
  saved: false,
  source: '',
  workType: '',
  search: '',
  country: '',
  aiOnly: false,
};

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<JobCounts>({ total: 0, new: 0, saved: 0, aiFiltered: 0 });
  const [sourceCounts, setSourceCounts] = useState<SourceCounts>({});
  const [sources, setSources] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [aiFiltering, setAiFiltering] = useState(false);
  const [lastFetchReport, setLastFetchReport] = useState<FetchReport | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const saveAbortRef = useRef<AbortController | null>(null);

  const fetchList = useCallback(async (f: JobFilters, p: number) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.saved) params.set('saved', 'true');
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
        setSourceCounts(data.sourceCounts || {});
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
      const res = await fetch(`${BASE}/jobs/fetch`, { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        setLastFetchReport({
          fetched: body.fetched ?? 0,
          sources: Array.isArray(body.sources) ? body.sources : [],
          finishedAt: Date.now(),
        });
      }
      await fetchList(filters, 1);
      setPage(1);
    } catch { /* silent */ } finally {
      setFetching(false);
    }
  }, [filters, fetchList]);

  const saveJob = useCallback(async (id: string) => {
    if (saveAbortRef.current) saveAbortRef.current.abort();
    const controller = new AbortController();
    saveAbortRef.current = controller;
    let previousJobs: Job[] = [];
    let previousCounts: JobCounts = { total: 0, new: 0, saved: 0, aiFiltered: 0 };
    setJobs(prev => {
      previousJobs = prev;
      return prev.map(j => j.id === id ? { ...j, saved: true } : j);
    });
    setCounts(prev => {
      previousCounts = { ...prev };
      return { ...prev, saved: prev.saved + 1 };
    });
    try {
      const res = await fetch(`${BASE}/jobs/${id}/save`, {
        method: 'POST',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to save job');
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setJobs(previousJobs);
      setCounts(previousCounts);
      console.error('Failed to save job:', e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);

  const unsaveJob = useCallback(async (id: string) => {
    if (saveAbortRef.current) saveAbortRef.current.abort();
    const controller = new AbortController();
    saveAbortRef.current = controller;
    let previousJobs: Job[] = [];
    let previousCounts: JobCounts = { total: 0, new: 0, saved: 0, aiFiltered: 0 };
    setJobs(prev => {
      previousJobs = prev;
      return prev.map(j => j.id === id ? { ...j, saved: false } : j);
    });
    setCounts(prev => {
      previousCounts = { ...prev };
      return { ...prev, saved: Math.max(0, prev.saved - 1) };
    });
    try {
      const res = await fetch(`${BASE}/jobs/${id}/save`, {
        method: 'DELETE',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to unsave job');
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setJobs(previousJobs);
      setCounts(previousCounts);
      console.error('Failed to unsave job:', e instanceof Error ? e.message : 'Unknown error');
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
    jobs, total, counts, sources, countries, sourceCounts,
    filters, updateFilters, page, setPage,
    loading, fetching, aiFiltering, lastFetchReport,
    fetchJobs, saveJob, unsaveJob, aiFilter,
    refresh: () => fetchList(filters, page),
  };
}
