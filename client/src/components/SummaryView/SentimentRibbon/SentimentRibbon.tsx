const RIBBON_COLORS: Record<string, string> = {
  positive: 'bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]',
  negative: 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]',
  neutral: 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]',
  mixed: 'bg-[var(--color-mixed-bg)] text-[var(--color-mixed-text)]',
};

const RIBBON_DOT: Record<string, string> = {
  positive: 'bg-[var(--color-positive-dot)]',
  negative: 'bg-[var(--color-negative-dot)]',
  neutral: 'bg-[var(--color-neutral-dot)]',
  mixed: 'bg-[var(--color-mixed-dot)]',
};

interface SentimentRibbonProps {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}

export function SentimentRibbon({ sentiment }: SentimentRibbonProps) {
  return (
    <span
      className={`absolute -top-1.5 right-0 md:top-0 md:right-0 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-bl-lg text-[9px] uppercase tracking-wider font-semibold pointer-events-none ${RIBBON_COLORS[sentiment]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${RIBBON_DOT[sentiment]}`} />
      {sentiment}
    </span>
  );
}
