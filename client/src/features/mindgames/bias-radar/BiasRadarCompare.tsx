import { useEffect, useState, useCallback, useRef } from 'react';
import GutCheck from './GutCheck';
import SourceCard from './SourceCard';
import type { SourceArticle, GutCheckReaction } from '../../../types/lens';
import { API_BASE } from '../../../config';
import { BIAS_SORT_ORDER } from '../../../utils/biasRatings';

interface BiasRadarCompareProps {
  currentArticle: SourceArticle;
  searchTitle: string;
  excludeSource?: string;
  language?: string;
}

export default function BiasRadarCompare({ currentArticle, searchTitle, excludeSource, language = 'English' }: BiasRadarCompareProps) {
  const [gutDone, setGutDone] = useState(false);
  const [gutReaction, setGutReaction] = useState<GutCheckReaction | null>(null);
  const [related, setRelated] = useState<SourceArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const fetchRelated = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        articleId: searchTitle,
        source: excludeSource || '',
        language: language,
      });
      const r = await fetch(`${API_BASE}/bias-radar/related?${params}`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const data = await r.json();
      if (!ctrl.signal.aborted) {
        setRelated(data.articles ?? []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load related articles');
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [searchTitle, excludeSource, language]);

  useEffect(() => {
    fetchRelated();
    return () => abortRef.current?.abort();
  }, [fetchRelated]);

  if (!gutDone) {
    return (
      <GutCheck
        onComplete={(reaction) => {
          setGutReaction(reaction);
          setGutDone(true);
        }}
      />
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {gutReaction && (
        <p className="text-xs text-ink-muted">
          You felt <strong>{gutReaction}</strong>. Now let's see how different outlets covered this.
        </p>
      )}

      <SourceCard article={currentArticle} isMain />

      {loading && (
        <p className="text-sm text-ink-muted text-center py-6">Finding other perspectives...</p>
      )}

      {!loading && error && (
        <div className="rounded-lg border px-4 py-3 text-center" style={{ backgroundColor: 'var(--accent-error-bg)', borderColor: 'var(--accent-error-border)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--accent-error-text-strong)' }}>
            Could not find related articles.
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--accent-error-text)' }}>
            {error}
          </p>
          <button
            onClick={fetchRelated}
            className="text-xs underline"
            style={{ color: 'var(--accent-error-text)' }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && related.length === 0 && (
        <p className="text-sm text-ink-muted text-center py-6">
          No other sources found covering this story.
        </p>
      )}

      {!loading && [...related].sort((a, b) =>
        BIAS_SORT_ORDER.indexOf(a.biasRating) - BIAS_SORT_ORDER.indexOf(b.biasRating)
      ).map((article) => (
        <SourceCard key={article.id} article={article} />
      ))}

      {!loading && related.length > 0 && (
        <div className="mt-4 p-4 bg-paper-dark border border-rule rounded-lg">
          <p className="text-sm text-ink">
            <strong>Think about it:</strong> What single fact would change how you interpret this story?
          </p>
        </div>
      )}
      <p className="text-[10px] text-ink-muted text-center mt-2">
        Bias ratings from{' '}
        <a
          href="https://www.allsides.com/media-bias/ratings"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          AllSides.com
        </a>{' '}
        (CC BY-NC 4.0)
      </p>
    </div>
  );
}
