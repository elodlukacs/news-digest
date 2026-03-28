import type { TechniqueResult } from '../../types/lens';

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  easy: { bg: '#dcfce7', text: '#15803d' },
  medium: { bg: '#fef9c3', text: '#a16207' },
  hard: { bg: '#fee2e2', text: '#b91c1c' },
};

interface TechniqueCardProps {
  result: TechniqueResult;
}

export default function TechniqueCard({ result }: TechniqueCardProps) {
  if (result.technique === 'none') {
    return (
      <div className="rounded-lg border border-rule bg-paper-dark p-4 space-y-2">
        <p className="text-sm font-semibold text-ink">No major technique detected</p>
        <p className="text-sm text-ink-muted">{result.explanation}</p>
      </div>
    );
  }

  const colors = DIFFICULTY_COLORS[result.difficulty] || DIFFICULTY_COLORS.medium;

  return (
    <div className="rounded-lg border border-rule p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-ink-muted uppercase tracking-wide mb-0.5">Technique detected</p>
          <p className="text-base font-semibold text-ink">{result.displayName}</p>
        </div>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full shrink-0"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {result.difficulty}
        </span>
      </div>

      <blockquote className="border-l-4 border-rule pl-3 italic text-sm text-ink-muted">
        "{result.evidence}"
      </blockquote>

      <p className="text-sm text-ink">{result.explanation}</p>
    </div>
  );
}
