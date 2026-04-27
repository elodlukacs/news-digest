import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip';

const BIAS_ITEMS = [
  { bias: 'Far Left', color: '#8B5CF6' },
  { bias: 'Left', color: '#A855F7' },
  { bias: 'Center-Left', color: '#3B82F6' },
  { bias: 'Center', color: '#22C55E' },
  { bias: 'Center-Right', color: '#F97316' },
  { bias: 'Right', color: '#EF4444' },
  { bias: 'Far Right', color: '#DC2626' },
] as const;

const CRED_TIERS = [
  { min: 90, grade: 'A+', label: 'Very High', color: '#065f46' },
  { min: 80, grade: 'A', label: 'High', color: '#166534' },
  { min: 70, grade: 'B', label: 'Medium-High', color: '#854d0e' },
  { min: 60, grade: 'C', label: 'Medium', color: '#713f12' },
  { min: 50, grade: 'D', label: 'Low-Medium', color: '#7f1d1d' },
  { min: 0, grade: 'F', label: 'Low', color: '#991b1b' },
];

export function SourceRatingsLegend() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="h-9 inline-flex items-center justify-center px-2.5 rounded-md text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
            aria-label="What do bias and credibility mean?"
          >
            <Info size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-[340px] p-4 space-y-4">
          <div>
            <p className="text-[11px] font-[family-name:var(--font-widget)] font-bold text-ink-muted uppercase tracking-[0.15em] mb-2">Political Bias</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {BIAS_ITEMS.map((item) => (
                <div key={item.bias} className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px] font-[family-name:var(--font-widget)] text-ink-light">{item.bias}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-[family-name:var(--font-widget)] font-bold text-ink-muted uppercase tracking-[0.15em] mb-2">Credibility Tiers</p>
            <div className="space-y-1">
              {CRED_TIERS.map((tier) => (
                <div key={tier.min} className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-[family-name:var(--font-widget)] font-bold leading-none shrink-0 border border-white/10"
                    style={{ backgroundColor: tier.color, color: tier.color === '#065f46' ? '#a7f3d0' : tier.color === '#166534' ? '#bbf7d0' : tier.color === '#854d0e' ? '#fef08a' : tier.color === '#713f12' ? '#fde68a' : '#fecaca' }}
                  >
                    {tier.grade}
                  </span>
                  <span className="text-[11px] font-[family-name:var(--font-widget)] text-ink-light">{tier.label}</span>
                  <span className="text-[10px] font-[family-name:var(--font-widget)] text-ink-muted ml-auto">{tier.min === 0 ? '<50' : `≥${tier.min}`}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-ink-muted italic pt-1 border-t border-rule/50">
            Ratings from AllSides, Ad Fontes Media, and MBFC. Shown when available for the article&rsquo;s source.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
