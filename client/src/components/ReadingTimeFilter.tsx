import { Clock } from 'lucide-react';

const OPTIONS = [
  { label: 'All', value: null },
  { label: '2 min', value: 2 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
] as const;

interface Props {
  selected: number | null;
  onChange: (minutes: number | null) => void;
}

export function ReadingTimeFilter({ selected, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Reading time filter">
      <Clock size={13} className="text-ink-muted shrink-0" />
      {OPTIONS.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onChange(opt.value)}
          aria-pressed={selected === opt.value}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-sm border transition-colors cursor-pointer ${
            selected === opt.value
              ? 'bg-masthead text-paper border-masthead'
              : 'bg-paper border-rule text-ink-muted hover:text-ink hover:border-ink-muted'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
