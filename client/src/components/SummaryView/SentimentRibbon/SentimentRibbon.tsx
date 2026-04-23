import { TrendingUp, TrendingDown, Minus, Scale } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const RIBBON_STYLES: Record<string, string> = {
  positive: 'bg-[var(--color-positive-bg)] text-[var(--color-positive-text)] ring-[var(--color-positive-dot)]/40',
  negative: 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)] ring-[var(--color-negative-dot)]/40',
  neutral: 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)] ring-[var(--color-neutral-dot)]/40',
  mixed: 'bg-[var(--color-mixed-bg)] text-[var(--color-mixed-text)] ring-[var(--color-mixed-dot)]/40',
};

const RIBBON_ICONS: Record<string, LucideIcon> = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
  mixed: Scale,
};

const RIBBON_LABELS: Record<string, string> = {
  positive: 'Positive sentiment',
  negative: 'Negative sentiment',
  neutral: 'Neutral sentiment',
  mixed: 'Mixed sentiment',
};

interface SentimentRibbonProps {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}

export function SentimentRibbon({ sentiment }: SentimentRibbonProps) {
  const Icon = RIBBON_ICONS[sentiment];
  return (
    <span
      className={`absolute top-2.5 right-2.5 md:top-3 md:right-3 z-10 inline-flex items-center justify-center w-7 h-7 rounded-xl ring-1 pointer-events-none shadow-sm ${RIBBON_STYLES[sentiment]}`}
      aria-label={RIBBON_LABELS[sentiment]}
      title={RIBBON_LABELS[sentiment]}
    >
      <Icon size={14} strokeWidth={2.25} />
    </span>
  );
}
