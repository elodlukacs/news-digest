import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MessageCircle, RotateCw, ExternalLink } from 'lucide-react';

import { BiasBar } from '@/components/BiasBar';
import { timeAgo } from '@/utils/date';
import { safeHref } from '@/utils/safeHref';
import type { ResearchSource, TopicResearch } from '@/types';

interface ResearchArticleProps {
  research: TopicResearch;
  fontSize: number;
  onAskFollowUp: () => void;
  onResearchAgain: () => void;
}

const CITATION_RE = /((?:\[\d+\])+)/g;
const HIGHLIGHT_MS = 1800;

function formatDate(publishedAt: string): string {
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Paragraph text with `[n]` turned into superscript links to the source list.
 * A run like `[1][2]` becomes one group, "1,2" — rendered side by side it
 * reads as source 12.
 */
function CitedText({ text, maxN, onCite }: { text: string; maxN: number; onCite: (n: number) => void }) {
  const tidy = text.replace(/\s+(?=\[\d+\])/g, '');
  const parts: ReactNode[] = tidy.split(CITATION_RE).map((part, i) => {
    if (!/^(?:\[\d+\])+$/.test(part)) return part;
    const nums = [...new Set([...part.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))]
      .filter((n) => n >= 1 && n <= maxN);
    if (!nums.length) return null;
    return (
      <sup key={i} className="ml-[1px] font-[family-name:var(--font-widget)] text-[0.68em] font-semibold text-masthead">
        {nums.map((n, j) => (
          <span key={n}>
            {j > 0 && ','}
            <a
              href={`#research-source-${n}`}
              onClick={(e) => { e.preventDefault(); onCite(n); }}
              aria-label={`Source ${n}`}
              className="hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-masthead rounded-sm px-[1px]"
            >
              {n}
            </a>
          </span>
        ))}
      </sup>
    );
  });
  return <>{parts}</>;
}

export function ResearchArticle({ research, fontSize, onAskFollowUp, onResearchAgain }: ResearchArticleProps) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  const cite = useCallback((n: number) => {
    const el = document.getElementById(`research-source-${n}`);
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // On wide screens the list is a sticky side column: scroll it, not the page.
    const sideColumn = window.matchMedia('(min-width: 1024px)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: sideColumn ? 'nearest' : 'center' });
    setHighlighted(n);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
  }, []);

  const paragraphs = research.narrative.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const maxN = research.sources.length;
  const background = research.sources.filter((s) => s.kind === 'wiki');
  const coverage = research.sources.filter((s) => s.kind === 'news');
  const [lede, ...body] = paragraphs;

  return (
    <article className="pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:gap-x-12 xl:gap-x-20">
      <div className="min-w-0">
        <h1 className="font-serif text-[28px] leading-[1.15] sm:text-[36px] md:text-[44px] xl:text-[50px] font-black text-ink tracking-[-0.02em] max-w-[24ch]">
          {research.headline}
        </h1>

        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-[family-name:var(--font-widget)] text-[13px] text-ink-muted">
          <span>Researched {timeAgo(research.created_at)}</span>
          <span aria-hidden className="w-1 h-1 rounded-full bg-ink-muted/40" />
          <span>{coverage.length} news reports, {background.length} background articles</span>
        </p>

        <div className="mt-8 font-[family-name:var(--font-body)] text-ink-light">
          {lede && (
            <p
              className="font-serif text-ink font-medium max-w-[66ch]"
              style={{ fontSize: `${Math.round(fontSize * 1.18)}px`, lineHeight: 1.6 }}
            >
              <CitedText text={lede} maxN={maxN} onCite={cite} />
            </p>
          )}
          <div className="mt-5 space-y-5 max-w-[78ch]" style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}>
            {body.map((p, i) => (
              <p key={i}><CitedText text={p} maxN={maxN} onCite={cite} /></p>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 font-[family-name:var(--font-widget)]">
          <button
            type="button"
            onClick={onAskFollowUp}
            className="inline-flex items-center gap-2 rounded-md bg-masthead text-paper px-4 py-2 text-[14px] font-semibold hover:bg-masthead/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <MessageCircle size={15} />
            Ask a follow-up
          </button>
          <button
            type="button"
            onClick={onResearchAgain}
            className="inline-flex items-center gap-2 rounded-md border border-rule px-4 py-2 text-[14px] font-medium text-ink-light hover:text-ink hover:border-ink-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead"
          >
            <RotateCw size={14} />
            Research again with the latest news
          </button>
        </div>
      </div>

      <section
        aria-labelledby="research-sources-heading"
        className="mt-14 pt-6 border-t border-rule lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-6 xl:pl-8 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:overscroll-contain"
      >
        <h2 id="research-sources-heading" className="font-serif text-[20px] font-bold text-ink">
          Sources <span className="font-[family-name:var(--font-widget)] text-[13px] font-normal text-ink-muted">{maxN}</span>
        </h2>
        {background.length > 0 && (
          <SourceGroup title="Background" sources={background} highlighted={highlighted} />
        )}
        {coverage.length > 0 && (
          <SourceGroup title="News coverage" sources={coverage} highlighted={highlighted} />
        )}
      </section>
    </article>
  );
}

function SourceGroup({ title, sources, highlighted }: { title: string; sources: ResearchSource[]; highlighted: number | null }) {
  return (
    <div className="mt-5">
      <h3 className="font-[family-name:var(--font-widget)] text-[13px] font-semibold text-ink-light mb-2">{title}</h3>
      <ol className="space-y-1">
        {sources.map((s) => {
          const href = safeHref(s.url);
          const date = formatDate(s.publishedAt);
          return (
            <li
              key={s.n}
              id={`research-source-${s.n}`}
              className={`scroll-mt-24 flex gap-3 rounded-md px-2 py-1.5 -mx-2 transition-colors duration-500 ${highlighted === s.n ? 'bg-masthead/12' : ''}`}
            >
              <span className="w-6 shrink-0 text-right font-[family-name:var(--font-widget)] text-[12px] font-semibold text-masthead tabular-nums pt-[3px]">
                {s.n}
              </span>
              <div className="min-w-0 font-[family-name:var(--font-widget)]">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-[15px] leading-snug text-ink hover:text-masthead focus-visible:outline-none focus-visible:underline"
                  >
                    {s.title}
                    <ExternalLink size={11} className="inline ml-1 -mt-0.5 opacity-40 group-hover:opacity-80" aria-hidden />
                  </a>
                ) : (
                  <span className="text-[15px] leading-snug text-ink">{s.title}</span>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted">
                  <span className="font-medium text-ink-light">{s.source}</span>
                  {date && <span>{date}</span>}
                  {s.biasRating && <BiasBar bias={s.biasRating} />}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
