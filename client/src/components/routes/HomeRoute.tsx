import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExternalLink,
  Sparkles,
  MessageCircle,
  RotateCw,
  ArrowRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE } from '../../config';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { timeAgo } from '../../utils/date';
import { ArticleChatPopup } from '../ArticleChatPopup';
import type { ChatMessage } from '../../types';

/* ─── Types ─── */

interface SurpriseArticle {
  article_id: number | null;
  title: string;
  brief: string;
  raw_content?: string;
  link: string;
  source: string;
  pub_date: string;
  category_name?: string;
  has_expanded?: boolean;
}

/* ─── Constants ─── */

const SURPRISE_BASE = `${API_BASE}/homepage/surprise`;
const SESSION_SEEN_KEY = 'home_seen_urls';
const MAX_SEEN = 50;
/* ─── Session helpers ─── */

function getSeenUrls(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function addSeenUrls(urls: string[]) {
  try {
    const existing = getSeenUrls();
    for (const u of urls) existing.add(u);
    while (existing.size > MAX_SEEN) {
      const first = existing.values().next().value;
      if (first) existing.delete(first);
    }
    sessionStorage.setItem(SESSION_SEEN_KEY, JSON.stringify([...existing]));
  } catch {
    sessionStorage.removeItem(SESSION_SEEN_KEY);
  }
}

function clearSeenUrls() {
  sessionStorage.removeItem(SESSION_SEEN_KEY);
}

/* ─── Component ─── */

export function HomeRoute() {
  const [article, setArticle] = useState<SurpriseArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [elaborated, setElaborated] = useState<string | null>(null);
  const [elaborating, setElaborating] = useState(false);
  const [elaborateError, setElaborateError] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const transitionRef = useRef(false);

  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');

  const fetchArticle = useCallback(async (retryAfterClear = false) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setElaborated(null);
    setElaborateError(null);
    setChatMessages([]);
    setChatOpen(false);

    try {
      const seen = getSeenUrls();
      const excludeParam = seen.size > 0
        ? `?exclude=${encodeURIComponent([...seen].join(','))}`
        : '';
      const res = await fetch(`${SURPRISE_BASE}${excludeParam}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.error || 'No articles found';
        // Auto-reset and retry once if pool is exhausted
        if (!retryAfterClear && seen.size > 0 && res.status === 404) {
          clearSeenUrls();
          fetchArticle(true);
          return;
        }
        throw new Error(errMsg);
      }
      const data = (await res.json()) as SurpriseArticle;
      if (data.link) addSeenUrls([data.link]);
      setArticle(data);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        if (transitionRef.current) {
          transitionRef.current = false;
          setPhase('enter');
        }
      }
    }
  }, []);

  useEffect(() => {
    fetchArticle();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchArticle]);

  const handleNext = useCallback(() => {
    if (loading || phase !== 'idle') return;
    transitionRef.current = true;
    setPhase('exit');
  }, [loading, phase]);

  useEffect(() => {
    if (phase !== 'exit') return;
    const timer = setTimeout(() => {
      fetchArticle();
    }, 250);
    return () => clearTimeout(timer);
  }, [phase, fetchArticle]);

  useEffect(() => {
    if (phase !== 'enter') return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase('idle');
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, [phase]);

  const handleElaborate = useCallback(async () => {
    if (!article || elaborating) return;
    setElaborating(true);
    setElaborateError(null);
    try {
      const res = await fetch(`${SURPRISE_BASE}/elaborate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.article_id,
          title: article.title,
          source: article.source,
          content: article.raw_content || article.brief,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to elaborate');
      }
      const data = await res.json();
      setElaborated(String(data.content || '').trim());
    } catch (e: unknown) {
      setElaborateError(
        e instanceof Error ? e.message : 'Failed to elaborate',
      );
    } finally {
      setElaborating(false);
    }
  }, [article, elaborating]);

  const handleSendChat = useCallback(
    async (text: string) => {
      if (!article || chatSending) return;
      const optimistic: ChatMessage = {
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, optimistic]);
      setChatSending(true);
      try {
        const res = await fetch(`${SURPRISE_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            article_id: article.article_id,
            title: article.title,
            content: elaborated || article.raw_content || article.brief,
            message: text,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Chat failed');
        }
        const reply = await res.json();
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: reply.content,
            created_at: reply.created_at,
          },
        ]);
      } catch (e: unknown) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Sorry — ${e instanceof Error ? e.message : 'something went wrong'}.`,
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setChatSending(false);
      }
    },
    [article, chatSending, elaborated],
  );

  /* ─── Render ─── */

  const bodyText = elaborated ?? article?.brief ?? '';

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] flex flex-col" style={{ overscrollBehaviorX: 'contain' }}>
      <div className="flex-1 flex justify-center px-3 md:px-6 pb-[calc(12rem+env(safe-area-inset-bottom))] md:pb-[13rem] pt-2 md:pt-4">
        <div className="w-full max-w-[680px]">
            {/* Loading state */}
            {loading && (
              <div className="flex-1 p-6 md:p-8 flex flex-col justify-center space-y-5">
                <Skeleton className="w-20 h-3" />
                <Skeleton className="w-full h-8 md:h-10" />
                <Skeleton className="w-4/5 h-8 md:h-10" />
                <Skeleton className="w-16 h-3 mt-4" />
                <div className="space-y-3 pt-4">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-3/4 h-4" />
                </div>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="flex-1 p-6 md:p-8 flex flex-col justify-center items-center text-center">
                <p className="font-[family-name:var(--font-body)] text-[16px] text-accent italic mb-6">
                  {error}
                </p>
                <button
                  onClick={() => fetchArticle()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-[family-name:var(--font-widget)] font-semibold bg-masthead text-paper hover:bg-masthead/90 transition-colors cursor-pointer rounded-lg"
                >
                  <RotateCw size={14} />
                  Try again
                </button>
              </div>
            )}

            {/* Article content */}
            {article && !loading && (
              <div
                className="transition-all duration-300 ease-out will-change-transform"
                style={
                  phase === 'exit'
                    ? { opacity: 0, transform: 'translateY(-20px)' }
                    : phase === 'enter'
                      ? { opacity: 0, transform: 'translateY(20px)' }
                      : { opacity: 1, transform: 'translateY(0)' }
                }
              >
                <div>
                  <div className="p-5 md:p-8 pb-2">
                    {article.category_name && (
                      <p className="text-[10px] md:text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.25em] font-bold text-masthead mb-3">
                        {article.category_name}
                      </p>
                    )}

                    <h1 className="font-serif text-[24px] leading-[1.2] sm:text-[28px] md:text-[34px] md:leading-[1.2] font-black text-ink tracking-[-0.02em] mb-4">
                      {article.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-[family-name:var(--font-widget)] text-ink-muted mb-5">
                      {article.source && (
                        <span className="font-semibold text-ink-light">
                          {article.source}
                        </span>
                      )}
                      {article.pub_date && (
                        <>
                          {article.source && (
                            <span className="text-ink-muted/40">·</span>
                          )}
                          <span>{timeAgo(article.pub_date)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="px-5 md:px-8 pb-4">
                    <div className="font-[family-name:var(--font-body)] text-[16px] leading-[1.75] md:text-[18px] md:leading-[1.8] text-ink-light space-y-4 [&_strong]:text-ink [&_strong]:font-bold [&_a]:underline [&_a]:decoration-rule hover:[&_a]:decoration-ink">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="whitespace-pre-line">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 space-y-2">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 space-y-2">
                              {children}
                            </ol>
                          ),
                        }}
                      >
                        {bodyText}
                      </ReactMarkdown>
                    </div>

                    {!elaborated && !elaborating && article.raw_content && (
                      <button
                        onClick={handleElaborate}
                        className="mt-4 inline-flex items-center gap-1.5 text-[14px] md:text-[15px] font-[family-name:var(--font-body)] italic text-masthead underline decoration-masthead/40 decoration-dotted underline-offset-4 hover:decoration-masthead hover:decoration-solid transition-all cursor-pointer"
                      >
                        <Sparkles size={13} className="not-italic" />
                        I want to know more
                      </button>
                    )}
                    {elaborating && (
                      <div className="mt-6 flex items-center gap-2 text-[13px] font-[family-name:var(--font-widget)] text-ink-muted">
                        <Sparkles size={14} className="animate-pulse" />
                        Expanding the story…
                      </div>
                    )}
                    {elaborateError && (
                      <div className="mt-4 text-[13px] font-[family-name:var(--font-widget)] text-accent italic">
                        {elaborateError}
                        <button
                          onClick={handleElaborate}
                          className="ml-3 underline hover:text-ink cursor-pointer"
                        >
                          Try again
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
        </div>
      </div>

      {/* Sticky action toolbar */}
      {article && !loading && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-rule bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto w-full max-w-[680px] px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center gap-2 md:gap-3">
              {article.article_id != null && (
                <Button
                  variant="outline"
                  onClick={() => setChatOpen(true)}
                  aria-label="Chat about this article"
                  className="flex-1 h-11 md:h-12 rounded-xl text-[13px] md:text-[14px] font-[family-name:var(--font-widget)] font-semibold text-ink-muted hover:text-ink hover:bg-ink/5"
                >
                  <MessageCircle size={16} />
                  <span>Ask a question</span>
                </Button>
              )}

              {article.link && (
                <Button
                  asChild
                  variant="outline"
                  aria-label="Read full article"
                  className="flex-1 h-11 md:h-12 rounded-xl text-[13px] md:text-[14px] font-[family-name:var(--font-widget)] font-semibold text-ink-muted hover:text-ink hover:bg-ink/5"
                >
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={16} />
                    <span>Read full</span>
                  </a>
                </Button>
              )}
            </div>

            <Button
              onClick={handleNext}
              disabled={loading || phase !== 'idle'}
              aria-label="Next story"
              className="mt-3 w-full h-14 md:h-16 rounded-xl text-[15px] md:text-[16px] font-[family-name:var(--font-widget)] font-bold tracking-wide bg-masthead text-paper hover:bg-masthead/90 active:bg-masthead/80"
            >
              <span>Next story</span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      )}

      {/* Chat popup */}
      {article && article.article_id != null && (
        <ArticleChatPopup
          open={chatOpen}
          onOpenChange={setChatOpen}
          headline={article.title}
          sourceName={article.source}
          messages={chatMessages}
          sending={chatSending}
          onSend={handleSendChat}
        />
      )}
    </div>
  );
}
