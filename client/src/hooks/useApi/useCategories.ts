import { useState, useEffect, useCallback, useRef } from 'react';
import type { Category } from '../../types';
import { API_BASE as BASE } from '../../config';

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
    const res = await fetch(`${BASE}/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete category');
    await refresh();
  }, [refresh]);

  const renameCategory = useCallback(async (id: number, name: string) => {
    const res = await fetch(`${BASE}/categories/${id}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to rename category');
    }
    await refresh();
  }, [refresh]);

  const reorderCategory = useCallback(async (id: number, afterId: number | null) => {
    await fetch(`${BASE}/categories/${id}/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ afterId }),
    });
    await refresh();
  }, [refresh]);

  return { categories, loading, refresh, addCategory, deleteCategory, renameCategory, reorderCategory };
}
