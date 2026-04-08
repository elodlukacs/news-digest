import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, ExternalLink, Pause, Play, RotateCcw } from 'lucide-react';
import { API_BASE } from '../../config';
import { Skeleton } from '../ui/skeleton';

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
  const [seconds, setSeconds] = useState(300);
  const [timerActive, setTimerActive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

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
      setSeconds(300);
      setTimerActive(false);
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

  useEffect(() => {
    if (!timerActive) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setTimerActive(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = seconds / 300;
  const circumference = 2 * Math.PI * 36;

  return (
    <div className="max-w-[1100px] mx-auto px-4 pt-4 md:pt-6 pb-12">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[13px] font-[family-name:var(--font-widget)] text-ink-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <p className="text-[9px] font-[family-name:var(--font-widget)] uppercase tracking-[0.3em] text-ink-muted/60 font-medium">
          Take a Break
        </p>
      </div>

      {/* ── Main layout: sidebar + article ── */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-14">

        {/* ── Left: Timer sidebar ── */}
        <div className="md:w-48 shrink-0 flex flex-row md:flex-col items-center md:items-start gap-6 md:gap-5">
          {/* Timer ring */}
          <div className="relative w-20 h-20 md:w-24 md:h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="var(--color-rule)" strokeWidth="2.5" />
              <circle
                cx="40" cy="40" r="36" fill="none"
                stroke="var(--color-masthead)"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg md:text-xl font-bold text-ink font-mono tabular-nums tracking-tight">
                {minutes}:{secs.toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Timer controls */}
          <div className="flex flex-col gap-2">
            {!timerActive ? (
              <button
                onClick={() => setTimerActive(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-[family-name:var(--font-widget)] font-medium border border-masthead/30 text-masthead hover:bg-masthead/5 transition-colors cursor-pointer"
              >
                <Play size={11} />
                Start
              </button>
            ) : (
              <button
                onClick={() => setTimerActive(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-[family-name:var(--font-widget)] font-medium border border-rule text-ink-muted hover:bg-paper-dark transition-colors cursor-pointer"
              >
                <Pause size={11} />
                Pause
              </button>
            )}
            {seconds < 300 && (
              <button
                onClick={() => { setSeconds(300); setTimerActive(false); }}
                className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-[family-name:var(--font-widget)] text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <RotateCcw size={10} />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Article content ── */}
        <div className="flex-1 min-w-0">
          {loading && (
            <div className="space-y-4 pt-2">
              <Skeleton className="w-24 h-3" />
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-16 h-3" />
              <div className="space-y-2 pt-4">
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-5/6 h-4" />
                <Skeleton className="w-4/6 h-4" />
              </div>
            </div>
          )}

          {error && (
            <div className="pt-8">
              <p className="font-[family-name:var(--font-body)] text-[15px] text-accent italic mb-4">{error}</p>
              <button
                onClick={fetchArticle}
                className="flex items-center gap-1.5 text-[12px] font-[family-name:var(--font-widget)] text-masthead hover:text-ink transition-colors cursor-pointer"
              >
                <RefreshCw size={12} />
                Try again
              </button>
            </div>
          )}

          {article && !loading && (
            <article>
              {article.category_name && (
                <p className="text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.2em] font-bold text-masthead mb-3">
                  {article.category_name}
                </p>
              )}
              <h1 className="font-serif text-2xl md:text-[32px] lg:text-[36px] font-black text-ink leading-[1.2] tracking-[-0.02em] mb-3">
                {article.title}
              </h1>
              <p className="text-[12px] font-[family-name:var(--font-widget)] text-ink-muted mb-6">
                {article.source}
              </p>
              <p className="font-[family-name:var(--font-body)] text-[17px] md:text-[18px] leading-[1.85] text-ink-light max-w-[60ch]">
                {article.description}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 mt-8 pt-6 border-t border-rule">
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-[family-name:var(--font-widget)] font-medium bg-masthead text-paper hover:bg-masthead/90 transition-colors cursor-pointer border border-masthead"
                >
                  Read full article
                  <ExternalLink size={13} />
                </a>
                <button
                  onClick={fetchArticle}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-[family-name:var(--font-widget)] font-medium border border-rule text-ink-muted hover:text-ink hover:border-ink-muted transition-colors cursor-pointer disabled:opacity-50 bg-paper"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  Next article
                </button>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
