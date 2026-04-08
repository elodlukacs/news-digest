import { useState, useRef, useEffect } from 'react';
import { ExternalLink, ArrowRight, RotateCcw } from 'lucide-react';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';
import type { RabbitHoleResponse } from '../../../types/lens';

interface Props {
  headline: string;
  content: string;
  language?: string;
}

type State = 'loading' | 'result' | 'error';

export default function BiasRadarRabbitHole({ headline, content, language }: Props) {
  const selectedLlm = useLlm();
  const [state, setState] = useState<State>('loading');
  const [result, setResult] = useState<RabbitHoleResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchRabbitHole();
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRabbitHole() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState('loading');

    try {
      const res = await fetch(`${API_BASE}/bias-radar/rabbit-hole`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, content, language, provider: selectedLlm }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RabbitHoleResponse = await res.json();
      setResult(data);
      setState('result');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setState('error');
    }
  }

  /* ─── Loading ─── */
  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16" role="status">
        <div className="flex gap-1.5 mb-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-masthead/40 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
        <p className="text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.2em] text-ink-muted">
          Tracing connections...
        </p>
      </div>
    );
  }

  /* ─── Error ─── */
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6" role="alert">
        <p className="font-[family-name:var(--font-body)] text-[15px] text-ink-light italic text-center leading-relaxed mb-4">
          The thread went cold this time.
        </p>
        <button
          onClick={fetchRabbitHole}
          className="flex items-center gap-1.5 text-[12px] font-[family-name:var(--font-widget)] text-masthead hover:text-ink transition-colors cursor-pointer"
        >
          <RotateCcw size={12} />
          Try another angle
        </button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="px-5 py-5 space-y-0">
      {/* ── Topic headline ── */}
      <div className="pb-5 border-b border-rule">
        <p className="text-[12px] font-[family-name:var(--font-widget)] uppercase tracking-[0.2em] text-masthead/60 mb-2 font-medium">
          From this article, explore
        </p>
        <h3 className="font-serif text-[22px] font-bold text-ink leading-[1.3] tracking-[-0.01em]">
          {result.topic}
        </h3>
      </div>

      {/* ── Connection ── */}
      {result.whyItConnects && (
        <div className="py-4 border-b border-rule">
          <div className="flex items-start gap-3">
            <ArrowRight size={14} className="text-masthead shrink-0 mt-[3px]" />
            <div>
              <p className="text-[12px] font-[family-name:var(--font-widget)] uppercase tracking-[0.2em] text-masthead/60 mb-1 font-medium">
                Connection
              </p>
              <p className="font-[family-name:var(--font-body)] text-[14px] leading-[1.7] text-ink-light">
                {result.whyItConnects}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Fun fact ── */}
      {result.funFact && (
        <div className="py-4 border-b border-rule">
          <p className="text-[12px] font-[family-name:var(--font-widget)] uppercase tracking-[0.2em] text-masthead/60 mb-1.5 font-medium">
            One thing most people don&apos;t know
          </p>
          <p className="font-[family-name:var(--font-body)] text-[14px] leading-[1.7] text-ink">
            {result.funFact}
          </p>
        </div>
      )}

      {/* ── Wikipedia excerpt ── */}
      {result.wikiSummary && (
        <div className="py-4 border-b border-rule">
          <p className="text-[12px] font-[family-name:var(--font-widget)] uppercase tracking-[0.2em] text-ink-muted/50 mb-1.5 font-medium">
            Background
          </p>
          <p className="font-[family-name:var(--font-body)] text-[14px] leading-[1.7] text-ink-muted line-clamp-5">
            {result.wikiSummary}
          </p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="pt-5 space-y-3">
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(result.searchQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-masthead text-paper text-[13px] font-[family-name:var(--font-widget)] font-medium tracking-wide hover:bg-masthead/90 transition-colors cursor-pointer border border-masthead"
        >
          Go deeper
          <ExternalLink size={13} />
        </a>

        <button
          onClick={fetchRabbitHole}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-[family-name:var(--font-widget)] text-ink-muted hover:text-ink border border-rule hover:border-ink-muted transition-colors cursor-pointer bg-paper"
        >
          <RotateCcw size={11} />
          Find another thread
        </button>
      </div>
    </div>
  );
}
