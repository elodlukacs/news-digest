const BIAS_COLORS = {
  'Far Left': '#8B5CF6',
  'Left': '#A855F7',
  'Center-Left': '#3B82F6',
  'Center': '#22C55E',
  'Center-Right': '#F97316',
  'Right': '#EF4444',
  'Far Right': '#DC2626'
} as const;

const BIAS_LABELS = {
  'Far Left': 'Far L',
  'Left': 'Left',
  'Center-Left': 'Ctr-L',
  'Center': 'Center',
  'Center-Right': 'Ctr-R',
  'Right': 'Right',
  'Far Right': 'Far R'
} as const;

type BiasLabel = keyof typeof BIAS_COLORS;

interface BiasBarProps {
  bias: string;
  className?: string;
}

export function BiasBar({ bias, className = '' }: BiasBarProps) {
  const color = BIAS_COLORS[bias as BiasLabel];
  const label = BIAS_LABELS[bias as BiasLabel];

  if (!color || !label) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 leading-none ${className}`}>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        title={bias}
      />
      <span className="text-[10px] font-[family-name:var(--font-widget)] font-medium text-ink-muted/80">
        {label}
      </span>
    </span>
  );
}
