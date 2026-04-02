import { Badge } from './ui/badge';

interface Props {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}

const COLORS: Record<string, string> = {
  positive: 'bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]',
  negative: 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]',
  neutral: 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]',
  mixed: 'bg-[var(--color-mixed-bg)] text-[var(--color-mixed-text)]',
};

const DOT_COLORS: Record<string, string> = {
  positive: 'bg-[var(--color-positive-dot)]',
  negative: 'bg-[var(--color-negative-dot)]',
  neutral: 'bg-[var(--color-neutral-dot)]',
  mixed: 'bg-[var(--color-mixed-dot)]',
};

export function SentimentBadge({ sentiment }: Props) {
  const bgClass = COLORS[sentiment];
  const dotClass = DOT_COLORS[sentiment];
  return (
    <Badge className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium border-0 pointer-events-none h-8 ${bgClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {sentiment}
    </Badge>
  );
}
