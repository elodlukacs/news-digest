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

type CardStatus = 'idle' | 'exiting-left' | 'exiting-right' | 'entering';

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

  /* ─── Card transform ─── */

  const getCardOpacity = () => {
    if (cardStatus === 'exiting-left') return 0;
    return 1;
  };

  const getCardTransform = () => {
    if (cardStatus === 'exiting-left') return 'translateY(-24px)';
    return 'translateY(0)';
  };

  /* ─── Render ─── */

  const bodyText = elaborated ?? article?.brief ?? '';

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] flex flex-col" style={{ overscrollBehaviorX: 'contain' }}>
      {/* ── Card stage ── */}
      <div className="flex-1 relative flex items-start justify-center px-3 md:px-6 pb-3 pt-2 md:pt-4">
        {/* Card */}
        <div className="w-full max-w-[680px] relative">
          <div
            className="w-full bg-paper rounded-2xl md:rounded-3xl shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08),0_12px_28px_-8px_rgba(0,0,0,0.18),0_24px_56px_-12px_rgba(0,0,0,0.22)] ring-1 ring-black/10 border border-ink/15 flex flex-col overflow-hidden will-change-transform"
            style={{
              transform: getCardTransform(),
              opacity: getCardOpacity(),
              transition: 'transform 220ms ease, opacity 220ms ease',
            }}
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

                {/* Action bar inside card */}
                <div className="shrink-0 px-4 md:px-6 py-3 md:py-4 bg-paper/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 md:gap-3">
                    {/* Chat */}
                    {article.article_id != null && (
                      <button
                        onClick={() => setChatOpen(true)}
                        aria-label="Chat about this article"
                        className="flex-1 flex items-center justify-center gap-2 h-11 md:h-12 text-[13px] md:text-[14px] font-[family-name:var(--font-widget)] font-semibold border border-rule text-ink-muted hover:text-ink hover:border-ink-muted hover:bg-ink/5 transition-all cursor-pointer rounded-xl bg-paper"
                      >
                        <MessageCircle size={16} />
                        <span>Ask a question</span>
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

                  {/* Next story — big primary action */}
                  <button
                    onClick={handleNext}
                    disabled={loading || cardStatus !== 'idle'}
                    aria-label="Next story"
                    className="mt-3 w-full flex items-center justify-center gap-2.5 h-14 md:h-16 text-[15px] md:text-[16px] font-[family-name:var(--font-widget)] font-bold tracking-wide bg-masthead text-paper hover:bg-masthead/90 active:bg-masthead/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer rounded-xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.25)]"
                  >
                    <span>Next story</span>
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
