import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ExternalLink, Sparkles, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE } from '../../config';
import { Skeleton } from '../ui/skeleton';
import { timeAgo } from '../../utils/date';
import { ArticleChatPopup } from '../ArticleChatPopup';
import type { ChatMessage } from '../../types';

interface SurpriseArticle {
  id: number;
  title: string;
  description: string;
  raw_content?: string;
  link: string;
  source: string;
  pub_date: string;
  category_name?: string;
  has_expanded?: boolean;
}

const SURPRISE_BASE = `${API_BASE}/homepage/surprise`;

export function BreakRoute() {
  const [article, setArticle] = useState<SurpriseArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Elaborated (longer) summary state — article-scoped
  const [elaborated, setElaborated] = useState<string | null>(null);
  const [elaborating, setElaborating] = useState(false);
  const [elaborateError, setElaborateError] = useState<string | null>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const lastIdRef = useRef<number | null>(null);

  const fetchArticle = useCallback(async () => {
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
      const excludeParam = lastIdRef.current ? `?exclude=${lastIdRef.current}` : '';
      const res = await fetch(`${SURPRISE_BASE}${excludeParam}`, { signal: controller.signal });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No articles found');
      }
      const data = (await res.json()) as SurpriseArticle;
      lastIdRef.current = data.id;
      setArticle(data);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticle();
    return () => { abortRef.current?.abort(); };
  }, [fetchArticle]);

  const handleElaborate = useCallback(async () => {
    if (!article || elaborating) return;
    setElaborating(true);
    setElaborateError(null);
    try {
      const res = await fetch(`${SURPRISE_BASE}/elaborate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          title: article.title,
          source: article.source,
          content: article.raw_content || article.description,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to elaborate');
      }
      const data = await res.json();
      setElaborated(String(data.content || '').trim());
    } catch (e: unknown) {
      setElaborateError(e instanceof Error ? e.message : 'Failed to elaborate');
    } finally {
      setElaborating(false);
    }
  }, [article, elaborating]);

  const handleSendChat = useCallback(async (text: string) => {
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
          article_id: article.id,
          title: article.title,
          content: elaborated || article.raw_content || article.description,
          message: text,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Chat failed');
      }
      const reply = await res.json();
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply.content, created_at: reply.created_at }]);
    } catch (e: unknown) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry — ${e instanceof Error ? e.message : 'something went wrong'}.`, created_at: new Date().toISOString() },
      ]);
    } finally {
      setChatSending(false);
    }
  }, [article, chatSending, elaborated]);

  const bodyText = elaborated ?? article?.description ?? '';

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="max-w-[720px] mx-auto px-5 md:px-8 pt-6 md:pt-12 pb-[10.5rem] md:pb-44">
        <p className="text-[10px] md:text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.35em] text-ink-muted/70 font-semibold mb-6 md:mb-10">
          Take a Break
        </p>

        {loading && (
          <div className="space-y-5">
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-full h-7 md:h-9" />
            <Skeleton className="w-5/6 h-7 md:h-9" />
            <Skeleton className="w-20 h-3 mt-6" />
            <div className="space-y-3 pt-6">
              <Skeleton className="w-full h-5" />
              <Skeleton className="w-full h-5" />
              <Skeleton className="w-5/6 h-5" />
              <Skeleton className="w-4/6 h-5" />
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="pt-4">
            <p className="font-[family-name:var(--font-body)] text-[16px] text-accent italic mb-5">{error}</p>
            <button
              onClick={fetchArticle}
              className="inline-flex items-center gap-2 text-[13px] font-[family-name:var(--font-widget)] text-masthead hover:text-ink transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
        )}

        {article && !loading && (
          <article>
            {article.category_name && (
              <p className="text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.22em] font-bold text-masthead mb-3 md:mb-4">
                {article.category_name}
              </p>
            )}
            <h1 className="font-serif text-[22px] leading-[1.2] sm:text-[26px] md:text-[36px] md:leading-[1.1] lg:text-[42px] font-black text-ink tracking-[-0.02em] mb-4 md:mb-5">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-[family-name:var(--font-widget)] text-ink-muted mb-7 md:mb-8">
              <span className="font-semibold text-ink-light">{article.source}</span>
              {article.pub_date && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{timeAgo(article.pub_date)}</span>
                </>
              )}
            </div>

            <div className="font-[family-name:var(--font-body)] text-[16px] leading-[1.75] md:text-[18px] md:leading-[1.8] text-ink-light space-y-4 [&_strong]:text-ink [&_strong]:font-bold [&_a]:underline [&_a]:decoration-rule hover:[&_a]:decoration-ink">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="whitespace-pre-line">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-2">{children}</ol>,
                }}
              >
                {bodyText}
              </ReactMarkdown>
            </div>

            {/* Elaborate CTA — inline, hidden after success */}
            {!elaborated && !elaborating && (
              <button
                onClick={handleElaborate}
                className="mt-8 md:mt-10 inline-flex items-center gap-2 px-5 py-3 text-[13px] md:text-[14px] font-[family-name:var(--font-widget)] font-semibold border border-masthead/40 text-masthead hover:bg-masthead/5 transition-colors cursor-pointer"
              >
                <Sparkles size={15} />
                I want to know more
              </button>
            )}
            {elaborating && (
              <div className="mt-8 md:mt-10 flex items-center gap-2 text-[13px] font-[family-name:var(--font-widget)] text-ink-muted">
                <Sparkles size={14} className="animate-pulse" />
                Expanding the story…
              </div>
            )}
            {elaborateError && (
              <div className="mt-6 text-[13px] font-[family-name:var(--font-widget)] text-accent italic">
                {elaborateError}
                <button onClick={handleElaborate} className="ml-3 underline hover:text-ink cursor-pointer">Try again</button>
              </div>
            )}
          </article>
        )}
      </div>

      {/* ── Sticky action bar ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/95 backdrop-blur-sm"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-[720px] mx-auto px-3 md:px-8 py-3 md:py-4 flex items-center gap-2 md:gap-3">
          <button
            onClick={fetchArticle}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 h-14 text-[15px] md:text-[16px] font-[family-name:var(--font-widget)] font-semibold tracking-wide bg-masthead text-paper hover:bg-masthead/90 active:bg-masthead/95 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Next article
          </button>
          {article && !loading && (
            <>
              <button
                onClick={() => setChatOpen(true)}
                aria-label="Chat about this article"
                className="shrink-0 flex items-center justify-center h-14 w-14 border border-rule text-ink-muted hover:text-ink hover:border-ink-muted transition-colors cursor-pointer bg-paper"
              >
                <MessageCircle size={16} />
              </button>
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Read full article"
                className="shrink-0 flex items-center justify-center h-14 w-14 md:w-auto md:px-4 md:gap-2 border border-rule text-ink-muted hover:text-ink hover:border-ink-muted transition-colors cursor-pointer bg-paper"
              >
                <ExternalLink size={16} />
                <span className="hidden md:inline text-[13px] font-[family-name:var(--font-widget)] font-medium">Read full</span>
              </a>
            </>
          )}
        </div>
      </div>

      {chatOpen && article && (
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
