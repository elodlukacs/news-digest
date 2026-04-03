import { useState, useEffect, useRef } from 'react';
import { API_BASE as BASE } from '../config';

export interface GroqModel {
  id: string;
  name: string;
  owned_by: string;
  context_window: number;
  max_completion_tokens: number;
  provider: string;
}

const DEFAULT_MODEL = 'openai/gpt-oss-20b';

export function useModels() {
  const [models, setModels] = useState<GroqModel[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch(`${BASE}/models`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch models');
        const data = await res.json();
        if (!controller.signal.aborted) setModels(data);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to fetch models', e);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => { controller.abort(); };
  }, []);

  return { models, loading, defaultModel: DEFAULT_MODEL };
}
