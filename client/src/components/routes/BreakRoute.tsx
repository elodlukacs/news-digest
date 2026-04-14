import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { API_BASE } from '../../config';
import { Skeleton } from '../ui/skeleton';
import { timeAgo } from '../../utils/date';

interface SurpriseArticle {
  id: number;
  title: string;
  description: string;
  link: string;
  source: string;
  pub_date: string;
  category_name?: string;
}

export function BreakRoute() {
  const [article, setArticle] = useState<SurpriseArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchArticle = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/homepage/surprise`, { signal: controller.signal });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No articles found');
      }
      const data = await res.json();
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

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* ── Content ── */}
      <div className="max-w-[720px] mx-auto px-5 md:px-8 pt-6 md:pt-12 pb-[8.5rem] md:pb-40">
        <p className="text-[10px] md:text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.35em] text-ink-muted/70 font-semibold mb-8 md:mb-12">
          Take a Break
        </p>

        {loading && (
          <div className="space-y-5">
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-full h-9" />
            <Skeleton className="w-5/6 h-9" />
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
              <p className="text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.22em] font-bold text-masthead mb-4">
                {article.category_name}
              </p>
            )}
            <h1 className="font-serif text-[28px] leading-[1.15] md:text-[40px] md:leading-[1.1] lg:text-[46px] font-black text-ink tracking-[-0.02em] mb-5">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-[family-name:var(--font-widget)] text-ink-muted mb-8">
              <span className="font-semibold text-ink-light">{article.source}</span>
              {article.pub_date && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{timeAgo(article.pub_date)}</span>
                </>
              )}
            </div>
            <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.75] md:text-[19px] md:leading-[1.8] text-ink-light whitespace-pre-line">
              {article.description}
            </p>
          </article>
        )}
      </div>

      {/* ── Sticky action bar (always visible) ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/95 backdrop-blur-sm"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-[720px] mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center gap-3">
          <button
            onClick={fetchArticle}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2.5 h-14 md:h-14 text-[15px] md:text-[16px] font-[family-name:var(--font-widget)] font-semibold tracking-wide bg-masthead text-paper hover:bg-masthead/90 active:bg-masthead/95 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Next article
          </button>
          {article && !loading && (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Read full article"
              className="shrink-0 flex items-center justify-center h-14 w-14 md:h-14 md:w-auto md:px-5 md:gap-2 border border-rule text-ink-muted hover:text-ink hover:border-ink-muted transition-colors cursor-pointer bg-paper"
            >
              <ExternalLink size={16} />
              <span className="hidden md:inline text-[13px] font-[family-name:var(--font-widget)] font-medium">Read full</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
