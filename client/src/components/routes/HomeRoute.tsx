import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExternalLink,
  Sparkles,
  MessageCircle,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE } from '../../config';
import { Skeleton } from '../ui/skeleton';
import { timeAgo } from '../../utils/date';
import { ArticleChatPopup } from '../ArticleChatPopup';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
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

type CardStatus = 'idle' | 'exiting-left' | 'exiting-right' | 'entering';

/* ─── Constants ─── */

const SURPRISE_BASE = `${API_BASE}/homepage/surprise`;
const SESSION_SEEN_KEY = 'home_seen_urls';
const MAX_SEEN = 50;
const SWIPE_EXIT_DISTANCE = 400;

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

  const [cardStatus, setCardStatus] = useState<CardStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);

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
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticle();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchArticle]);

  const handleNext = useCallback(() => {
    if (loading || cardStatus !== 'idle') return;
    setCardStatus('exiting-left');
    setTimeout(() => {
      fetchArticle();
      setCardStatus('entering');
      setTimeout(() => setCardStatus('idle'), 400);
    }, 280);
  }, [fetchArticle, loading, cardStatus]);

  const handlePrevious = useCallback(() => {
    // Previous not implemented for this feed — just triggers next for now
    handleNext();
  }, [handleNext]);



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

  /* ─── Swipe gesture ─── */

  const { offset, isDragging, elRef } = useSwipeGesture({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrevious,
    enabled: !loading && cardStatus === 'idle',
  });

  /* ─── Card transform ─── */

  const getCardTransform = () => {
    if (cardStatus === 'exiting-left') {
      return `translateX(-${SWIPE_EXIT_DISTANCE}px) rotate(-8deg)`;
    }
    if (cardStatus === 'exiting-right') {
      return `translateX(${SWIPE_EXIT_DISTANCE}px) rotate(8deg)`;
    }
    if (cardStatus === 'entering') {
      return 'translateX(0) rotate(0deg)';
    }
    if (isDragging && offset !== 0) {
      const rotate = offset * 0.04;
      return `translateX(${offset}px) rotate(${rotate}deg)`;
    }
    return 'translateX(0) rotate(0deg)';
  };

  const getCardOpacity = () => {
    if (cardStatus === 'exiting-left' || cardStatus === 'exiting-right') {
      return 0;
    }
    if (cardStatus === 'entering') {
      return 1;
    }
    if (isDragging && offset !== 0) {
      return Math.max(0.5, 1 - Math.abs(offset) / 600);
    }
    return 1;
  };

  /* ─── Render ─── */

  const bodyText = elaborated ?? article?.brief ?? '';

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] flex flex-col" style={{ overscrollBehaviorX: 'contain' }}>
      {/* ── Card stage ── */}
      <div className="flex-1 relative flex items-start justify-center px-3 md:px-6 pb-3 pt-2 md:pt-4">
        {/* Swipe hint arrows */}
        {!loading && !error && article && (
          <>
            <div className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-300"
              style={{ opacity: isDragging && offset > 0 ? 0.35 : 0.1 }}>
              <ChevronLeft size={40} strokeWidth={1.5} className="text-ink-muted" />
            </div>
            <div className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-300"
              style={{ opacity: isDragging && offset < 0 ? 0.35 : 0.1 }}>
              <ChevronRight size={40} strokeWidth={1.5} className="text-ink-muted" />
            </div>
          </>
        )}

        {/* Card */}
        <div
          className="w-full max-w-[680px] relative select-none touch-none [&_*]:touch-none"
          ref={elRef}
        >
          <div
            className="w-full bg-paper rounded-2xl md:rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.15)] border border-rule/60 flex flex-col overflow-hidden transition-all will-change-transform"
            style={{
              transform: getCardTransform(),
              opacity: getCardOpacity(),
              transitionDuration: isDragging ? '0ms' : '280ms',
              transitionTimingFunction: isDragging ? 'linear' : 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              cursor: isDragging ? 'grabbing' : 'grab',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              WebkitTouchCallout: 'none',
            } as React.CSSProperties & Record<string, string>}
          >
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
              <>
                {/* Content area */}
                <div>
                  <div className="p-5 md:p-8 pb-2">
                    {/* Category */}
                    {article.category_name && (
                      <p className="text-[10px] md:text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.25em] font-bold text-masthead mb-3">
                        {article.category_name}
                      </p>
                    )}

                    {/* Title */}
                    <h1 className="font-serif text-[24px] leading-[1.15] sm:text-[28px] md:text-[34px] md:leading-[1.1] font-black text-ink tracking-[-0.02em] mb-4">
                      {article.title}
                    </h1>

                    {/* Meta */}
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

                  {/* Body */}
                  <div className="px-5 md:px-8 pb-4">
                    <div className="font-[family-name:var(--font-body)] text-[15px] leading-[1.75] md:text-[17px] md:leading-[1.8] text-ink-light space-y-4 [&_strong]:text-ink [&_strong]:font-bold [&_a]:underline [&_a]:decoration-rule hover:[&_a]:decoration-ink">
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

                    {/* Elaborate CTA */}
                    {!elaborated && !elaborating && article.raw_content && (
                      <button
                        onClick={handleElaborate}
                        className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-[family-name:var(--font-widget)] font-semibold border border-masthead/30 text-masthead hover:bg-masthead/5 transition-colors cursor-pointer rounded-lg"
                      >
                        <Sparkles size={14} />
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

                {/* Action bar inside card */}
                <div className="shrink-0 border-t border-rule/50 px-4 md:px-6 py-3 md:py-4 bg-paper/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 md:gap-3">
                    {/* Chat */}
                    {article.article_id != null && (
                      <button
                        onClick={() => setChatOpen(true)}
                        aria-label="Chat about this article"
                        className="flex-1 flex items-center justify-center gap-2 h-11 md:h-12 text-[13px] md:text-[14px] font-[family-name:var(--font-widget)] font-semibold border border-rule text-ink-muted hover:text-ink hover:border-ink-muted hover:bg-ink/5 transition-all cursor-pointer rounded-xl bg-paper"
                      >
                        <MessageCircle size={16} />
                        <span>Chat</span>
                      </button>
                    )}

                    {/* Read full */}
                    {article.link && (
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Read full article"
                        className="flex-1 flex items-center justify-center gap-2 h-11 md:h-12 text-[13px] md:text-[14px] font-[family-name:var(--font-widget)] font-semibold border border-rule text-ink-muted hover:text-ink hover:border-ink-muted hover:bg-ink/5 transition-all cursor-pointer rounded-xl bg-paper"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={16} />
                        <span>Read full</span>
                      </a>
                    )}
                  </div>

                  {/* Swipe hint */}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <ArrowRightLeft size={14} className="text-ink-muted/40" />
                    <span className="text-xs font-[family-name:var(--font-widget)] text-ink-muted/40 tracking-wider">
                      Swipe to browse
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat popup */}
      {chatOpen && article && article.article_id != null && (
        <ArticleChatPopup
          headline={article.title}
          sourceName={article.source}
          messages={chatMessages}
          sending={chatSending}
          onSend={handleSendChat}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
