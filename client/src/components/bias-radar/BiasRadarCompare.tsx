import { useEffect, useState, useCallback } from 'react';
import GutCheck from './GutCheck';
import SourceCard from './SourceCard';
import type { SourceArticle, GutCheckReaction } from '../../types/lens';
import { API_BASE } from '../../config';

interface BiasRadarCompareProps {
  currentArticle: SourceArticle;
  searchTitle: string;
  excludeSource?: string;
}

export default function BiasRadarCompare({ currentArticle, searchTitle, excludeSource }: BiasRadarCompareProps) {
  const [gutDone, setGutDone] = useState(false);
  const [gutReaction, setGutReaction] = useState<GutCheckReaction | null>(null);
  const [related, setRelated] = useState<SourceArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRelated = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        articleId: searchTitle,
        source: excludeSource || '',
      });
      const r = await fetch(`${API_BASE}/bias-radar/related?${params}`);
      const data = await r.json();
      setRelated(data.articles ?? []);
    } finally {
      setLoading(false);
    }
  }, [searchTitle, excludeSource]);

  // Fetch immediately in parallel with gut check
  useEffect(() => {
    fetchRelated();
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
        <p className="text-sm text-ink-muted text-center py-6">Finding other perspectives…</p>
      )}

      {!loading && related.length === 0 && (
        <p className="text-sm text-ink-muted text-center py-6">
          No other sources found covering this story in the last 72 hours.
        </p>
      )}

      {!loading && related.map((article) => (
        <SourceCard key={article.id} article={article} />
      ))}

      {!loading && related.length > 0 && (
        <div className="mt-4 p-4 bg-paper-dark border border-rule rounded-lg">
          <p className="text-sm text-ink">
            <strong>Think about it:</strong> What single fact would change how you interpret this story?
          </p>
        </div>
      )}
    </div>
  );
}
