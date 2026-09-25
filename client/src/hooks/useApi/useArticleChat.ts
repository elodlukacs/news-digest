import { useState, useEffect, useCallback, useRef } from 'react';
import type { ArticleContextStatus, ArticleSourceKind, ChatMessage } from '../../types';
import { API_BASE as BASE } from '../../config';

export function useArticleChat(
  summaryId: number | null,
  articleTitle: string | null,
  articleContent: string | null,
  articleUrl: string | null,
  providerId: string = 'openai/gpt-oss-20b',
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextStatus, setContextStatus] = useState<ArticleContextStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!summaryId || !articleTitle) { setMessages([]); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({ article_title: articleTitle });
    fetch(`${BASE}/chat/${summaryId}?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((data) => { if (!controller.signal.aborted) setMessages(data); })
      .catch((err) => { if (!controller.signal.aborted) { console.error('Failed to load chat history:', err); setMessages([]); } });

    return () => { controller.abort(); abortRef.current = null; };
  }, [summaryId, articleTitle]);

  // Have the server fetch the original article and build the background
  // briefing as soon as the chat opens, so the first question doesn't wait on
  // it. Both are cached server-side; re-opening the same article is cheap.
  // articleContent is read via ref: it only matters on the first call.
  const articleContentRef = useRef(articleContent);
  articleContentRef.current = articleContent;

  useEffect(() => {
    if (!summaryId || !articleTitle) { setContextStatus(null); return; }
    const controller = new AbortController();
    setContextStatus({ state: 'loading' });

    fetch(`${BASE}/chat/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary_id: summaryId,
        article_title: articleTitle,
        article_url: articleUrl || undefined,
        article_content: articleContentRef.current || undefined,
      }),
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((data: { source: ArticleSourceKind; briefing: boolean }) => {
        if (!controller.signal.aborted) setContextStatus({ state: 'ready', source: data.source, briefing: data.briefing });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('Failed to load article context:', err);
        setContextStatus({ state: 'failed' });
      });

    return () => controller.abort();
  }, [summaryId, articleTitle, articleUrl]);

  const sendMessage = useCallback(async (text: string) => {
    if (!summaryId || !articleTitle || !text.trim()) return;
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
        body: JSON.stringify({
          summary_id: requestId,
          message: text,
          provider: providerId,
          article_title: articleTitle,
          article_url: articleUrl || undefined,
          article_content: articleContent || undefined,
        }),
        signal: controller.signal,
      });
      const reply = await res.json();
      if (!res.ok) {
        setError(reply.error || 'Failed to send message');
        return;
      }
      if (reply.content && summaryId === requestId && !controller.signal.aborted) {
        setMessages((prev) => [...prev, reply]);
      } else if (!reply.content && !controller.signal.aborted) {
        setError('No response received');
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Chat error', e);
      setError('Failed to send message');
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  }, [summaryId, articleTitle, articleContent, articleUrl, providerId]);

  return { messages, sending, error, sendMessage, contextStatus };
}
