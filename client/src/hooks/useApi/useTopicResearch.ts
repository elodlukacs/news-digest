import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage, RecentResearch, TopicResearch } from '../../types';
import { API_BASE as BASE } from '../../config';

const RESEARCH_BASE = `${BASE}/research`;

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === 'string' ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export function useTopicResearch(providerId: string) {
  const [result, setResult] = useState<TopicResearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentResearch[]>([]);
  // Set only when a research run (not opening a saved one) failed, so the
  // page can offer to retry that topic.
  const [retryTopic, setRetryTopic] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recentAbortRef = useRef<AbortController | null>(null);

  const loadRecent = useCallback(async () => {
    recentAbortRef.current?.abort();
    const controller = new AbortController();
    recentAbortRef.current = controller;
    try {
      const res = await fetch(`${RESEARCH_BASE}/recent`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: RecentResearch[] = await res.json();
      if (!controller.signal.aborted) setRecent(data);
    } catch (e) {
      if (!isAbort(e)) console.error('Failed to load recent research:', e);
    }
  }, []);

  /** Run (or reuse) research for a topic. Resolves to the result, or null on failure/abort. */
  const research = useCallback(async (topic: string, { fresh = false } = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);
    setRetryTopic(null);
    try {
      const res = await fetch(RESEARCH_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, provider: providerId, fresh }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await readError(res, 'Research failed. Try again in a moment.'));
      const data: TopicResearch = await res.json();
      if (controller.signal.aborted) return null;
      setResult(data);
      loadRecent();
      return data;
    } catch (e) {
      if (isAbort(e)) return null;
      setError(e instanceof Error ? e.message : 'Research failed. Try again in a moment.');
      setRetryTopic(topic);
      return null;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [providerId, loadRecent]);

  const load = useCallback(async (id: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    // Otherwise a failed load would show its error above the previous result.
    setResult(null);
    setRetryTopic(null);
    try {
      const res = await fetch(`${RESEARCH_BASE}/${id}`, { signal: controller.signal });
      if (!res.ok) throw new Error(await readError(res, 'Could not open that research.'));
      const data: TopicResearch = await res.json();
      if (!controller.signal.aborted) setResult(data);
    } catch (e) {
      if (isAbort(e)) return;
      setError(e instanceof Error ? e.message : 'Could not open that research.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${RESEARCH_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setRecent((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('Failed to delete research:', e);
    }
  }, []);

  /** Back to the empty search page; cancels anything in flight. */
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setResult(null);
    setError(null);
    setRetryTopic(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecent();
    return () => {
      abortRef.current?.abort();
      recentAbortRef.current?.abort();
    };
  }, [loadRecent]);

  return { result, loading, error, retryTopic, recent, research, load, remove, clear };
}

export function useResearchChat(researchId: number | null, providerId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
    // An aborted send skips its own setSending(false), which left the input
    // disabled after switching research mid-reply.
    setSending(false);
    sendAbortRef.current?.abort();
    if (!researchId) return;
    const controller = new AbortController();
    fetch(`${RESEARCH_BASE}/${researchId}/chat`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((data: ChatMessage[]) => { if (!controller.signal.aborted) setMessages(data); })
      .catch((e) => { if (!isAbort(e)) console.error('Failed to load research chat:', e); });
    return () => controller.abort();
  }, [researchId]);

  useEffect(() => () => sendAbortRef.current?.abort(), []);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!researchId || !message) return;
    sendAbortRef.current?.abort();
    const controller = new AbortController();
    sendAbortRef.current = controller;

    const userMessage: ChatMessage = { role: 'user', content: message, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${RESEARCH_BASE}/${researchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, provider: providerId }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await readError(res, 'The question could not be answered. Try again.'));
      const reply: ChatMessage = await res.json();
      if (!controller.signal.aborted) setMessages((prev) => [...prev, reply]);
    } catch (e) {
      if (isAbort(e)) return;
      const reason = e instanceof Error ? e.message : 'The question could not be answered. Try again.';
      setError(reason);
      // Shown in the thread, where the reader is looking. The server stored
      // neither turn, so both disappear on the next load.
      setMessages((prev) => [...prev, { role: 'assistant', content: `_${reason}_`, created_at: new Date().toISOString() }]);
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  }, [researchId, providerId]);

  return { messages, sending, error, send };
}
