import { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
import type { TimelineResult } from '../../types/lens';

interface BiasRadarTimelineProps {
  articleId: string;
}

type Status = 'loading' | 'done' | 'error' | 'no-history' | 'no-cluster';

export default function BiasRadarTimeline({ articleId }: BiasRadarTimelineProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<TimelineResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTimeline() {
      setStatus('loading');
      setResult(null);

      try {
        const res = await fetch(
          `${API_BASE}/bias-radar/timeline?articleId=${encodeURIComponent(articleId)}`
        );
        const data = await res.json();

        if (cancelled) return;

        if (data.code === 'NO_CLUSTER') {
          setStatus('no-cluster');
          return;
        }

        if (!data.result) {
          setStatus('no-history');
          return;
        }

        setResult(data.result);
        setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    fetchTimeline();
    return () => { cancelled = true; };
  }, [articleId]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-ink-muted">Checking story history…</span>
      </div>
    );
  }

  if (status === 'no-cluster') {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-ink-muted">
          This article hasn't been grouped into a topic cluster yet.
        </p>
      </div>
    );
  }

  if (status === 'no-history') {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-ink-muted">
          No earlier coverage found from this source on this story.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-accent">Could not load timeline data.</p>
      </div>
    );
  }

  if (!result) return null;

  const analysisBlocks = [
    { label: 'Framing Shift', content: result.framingShift },
    { label: 'Claim Evolution', content: result.claimEvolution },
    { label: 'Inconsistency', content: result.inconsistency },
  ];

  return (
    <div className="px-5 py-4 space-y-6">
      {/* Timeline entries */}
      {result.entries.length > 0 && (
        <div className="relative pl-6">
          {/* Vertical connecting line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-rule" />

          <div className="space-y-4">
            {result.entries.map((entry, i) => (
              <div key={entry.articleId ?? i} className="relative">
                {/* Dot */}
                <div className="absolute -left-6 top-1.5 w-[9px] h-[9px] rounded-full bg-rule border-2 border-paper" />

                <p className="text-xs text-ink-muted">
                  {new Date(entry.publishedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {entry.source && (
                    <span className="ml-2">&middot; {entry.source}</span>
                  )}
                </p>
                <p className="text-sm text-ink mt-0.5 leading-snug">{entry.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis cards */}
      <div className="space-y-3">
        {analysisBlocks.map((block) => (
          <div
            key={block.label}
            className="border border-rule rounded-lg px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">
              {block.label}
            </p>
            <p className="text-sm text-ink leading-relaxed">{block.content}</p>
          </div>
        ))}
      </div>

      {/* Significance callout */}
      {result.significance && (
        <div className="border border-masthead/30 bg-paper-dark rounded-lg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-masthead mb-1">
            Why this matters
          </p>
          <p className="text-sm text-ink leading-relaxed">{result.significance}</p>
        </div>
      )}
    </div>
  );
}
