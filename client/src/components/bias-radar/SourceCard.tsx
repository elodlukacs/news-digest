import type { SourceArticle } from '../../types/lens';
import { BIAS_LABELS, BIAS_COLORS } from '../../utils/biasRatings';

interface SourceCardProps {
  article: SourceArticle;
  isMain?: boolean;
}

export default function SourceCard({ article, isMain }: SourceCardProps) {
  const color = article.biasRating ? BIAS_COLORS[article.biasRating] : '#6b7280';
  const label = article.biasRating ? BIAS_LABELS[article.biasRating] : 'Unknown';

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${isMain ? 'border-ink' : 'border-rule'}`}>
      {isMain && (
        <span className="text-[10px] uppercase tracking-wider text-ink-muted font-medium">You're reading this</span>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{article.source}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      </div>
      <p className="text-sm font-medium text-ink leading-snug">{article.title}</p>
      <p className="text-xs text-ink-muted line-clamp-3">{article.excerpt}</p>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        Read full article →
      </a>
    </div>
  );
}