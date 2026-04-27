interface CredibilityBadgeProps {
  credibility: number;
  factCheckGrade?: string;
  className?: string;
}

function credibilityColor(score: number): { bg: string; text: string } {
  if (score >= 90) return { bg: '#065f46', text: '#a7f3d0' };
  if (score >= 80) return { bg: '#166534', text: '#bbf7d0' };
  if (score >= 70) return { bg: '#854d0e', text: '#fef08a' };
  if (score >= 60) return { bg: '#713f12', text: '#fde68a' };
  if (score >= 50) return { bg: '#7f1d1d', text: '#fecaca' };
  return { bg: '#991b1b', text: '#fecaca' };
}

export function CredibilityBadge({ credibility, factCheckGrade, className = '' }: CredibilityBadgeProps) {
  const c = credibilityColor(credibility);
  return (
    <span
      className={`inline-flex items-center leading-none ${className}`}
      title={`Credibility: ${factCheckGrade || ''} ${credibility}/100`}
    >
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-[family-name:var(--font-widget)] font-bold leading-none border border-white/10"
        style={{ backgroundColor: c.bg, color: c.text }}
      >
        {factCheckGrade && (
          <span className="opacity-80 font-semibold tracking-tight">{factCheckGrade}</span>
        )}
        <span>{credibility}</span>
      </span>
    </span>
  );
}
