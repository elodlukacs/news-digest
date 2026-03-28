import type { TechniqueResult } from '../../types/lens';

<<<<<<< HEAD
const DIFFICULTY_STYLES = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
=======
const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  easy: { bg: '#dcfce7', text: '#15803d' },
  medium: { bg: '#fef9c3', text: '#a16207' },
  hard: { bg: '#fee2e2', text: '#b91c1c' },
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
};

interface TechniqueCardProps {
  result: TechniqueResult;
}

export default function TechniqueCard({ result }: TechniqueCardProps) {
  if (result.technique === 'none') {
    return (
<<<<<<< HEAD
      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/30 p-4 space-y-2">
        <p className="text-sm font-semibold text-green-800 dark:text-green-400">✅ No major technique detected</p>
        <p className="text-sm text-green-700 dark:text-green-300">{result.explanation}</p>
=======
      <div className="rounded-lg border border-rule bg-paper-dark p-4 space-y-2">
        <p className="text-sm font-semibold text-ink">No major technique detected</p>
        <p className="text-sm text-ink-muted">{result.explanation}</p>
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
      </div>
    );
  }

<<<<<<< HEAD
=======
  const colors = DIFFICULTY_COLORS[result.difficulty] || DIFFICULTY_COLORS.medium;

>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
  return (
    <div className="rounded-lg border border-rule p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-ink-muted uppercase tracking-wide mb-0.5">Technique detected</p>
          <p className="text-base font-semibold text-ink">{result.displayName}</p>
        </div>
<<<<<<< HEAD
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${DIFFICULTY_STYLES[result.difficulty]}`}>
=======
        <span
          className="text-xs font-medium px-2 py-1 rounded-full shrink-0"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
          {result.difficulty}
        </span>
      </div>

      <blockquote className="border-l-4 border-rule pl-3 italic text-sm text-ink-muted">
        "{result.evidence}"
      </blockquote>

      <p className="text-sm text-ink">{result.explanation}</p>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> d4e8cf99316be01a4e5ec9703d0f68a97c293789
