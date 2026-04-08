import { useState } from 'react';
import { Eye, X, ChevronDown, Play } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export interface PromptLens {
  slug: string;
  name: string;
  description: string;
  group: string;
  icon: string;
}

const LENSES: PromptLens[] = [
  { slug: 'category-weird-daily', name: 'Weird Daily', description: 'Extract the strangest fact', group: 'Fun & Weird', icon: '🔭' },
  { slug: 'bad-movie-plot', name: 'Netflix Thriller', description: 'Summarize as a bad movie pitch', group: 'Fun & Weird', icon: '🎬' },
  { slug: 'hidden-incentives', name: 'Hidden Incentives', description: 'Who benefits from this story?', group: 'Critical', icon: '🔍' },
  { slug: '100-years-ago', name: '100 Years Ago', description: 'Historical parallel from a century ago', group: 'Critical', icon: '🏛️' },
  { slug: 'contrarian-take', name: 'Contrarian Take', description: 'Strongest opposing view', group: 'Critical', icon: '🎯' },
  { slug: 'unintended-consequences', name: 'Unintended Consequences', description: 'Predict surprising side effects', group: 'Critical', icon: '💥' },
  { slug: 'explain-to-alien', name: 'Explain to Alien', description: 'First-principles clarity', group: 'Perspective', icon: '👽' },
  { slug: 'most-counterintuitive-fact', name: 'Counterintuitive Fact', description: 'The fact that changes everything', group: 'Perspective', icon: '🧠' },
  { slug: 'five-minute-rabbit-hole', name: '5-Min Rabbit Hole', description: 'Adjacent topic worth exploring', group: 'Perspective', icon: '🕳️' },
  { slug: 'standup-comedy', name: 'Standup Comedy', description: "Today's news as a comedy set", group: 'Comedy', icon: '🎤' },
];

const GROUPS = ['Fun & Weird', 'Critical', 'Perspective', 'Comedy'] as const;

interface Props {
  selectedSlug: string | null;
  onSelect: (lens: PromptLens | null) => void;
  onRun: () => void;
  running?: boolean;
  disabled?: boolean;
}

export function PromptLensSelector({ selectedSlug, onSelect, onRun, running, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const selected = LENSES.find((l) => l.slug === selectedSlug) ?? null;

  return (
    <div className="inline-flex">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-serif border border-rule border-r-0 bg-paper hover:bg-paper-dark transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {selected ? (
              <>
                <span className="text-sm">{selected.icon}</span>
                <span className="text-ink font-medium max-w-[100px] truncate">{selected.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(null);
                  }}
                  className="ml-0.5 p-0.5 hover:bg-rule/50 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  aria-label="Clear lens"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                <Eye size={14} className="text-ink-muted" />
                <span className="text-ink-muted">Lens</span>
                <ChevronDown size={12} className="text-ink-muted" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem
            onClick={() => onSelect(null)}
            className={!selected ? 'bg-paper-dark' : ''}
          >
            <span className="w-5 text-center">◯</span>
            <div>
              <div className="font-medium">None</div>
              <div className="text-[11px] text-ink-muted">Select a reading lens</div>
            </div>
          </DropdownMenuItem>
          {GROUPS.map((group, gi) => (
            <div key={group}>
              {gi > 0 && <DropdownMenuSeparator />}
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.15em] font-bold text-ink-muted font-sans">
                {group}
              </p>
              {LENSES.filter((l) => l.group === group).map((lens) => (
                <DropdownMenuItem
                  key={lens.slug}
                  onClick={() => {
                    onSelect(lens);
                    setOpen(false);
                  }}
                  className={selectedSlug === lens.slug ? 'bg-paper-dark' : ''}
                >
                  <span className="w-5 text-center">{lens.icon}</span>
                  <div>
                    <div className="font-medium">{lens.name}</div>
                    <div className="text-[11px] text-ink-muted">{lens.description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={onRun}
        disabled={disabled || !selected || running}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-serif font-medium border border-masthead bg-masthead text-paper hover:bg-masthead/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {running ? (
          <span className="animate-pulse">...</span>
        ) : (
          <>
            <Play size={11} fill="currentColor" />
            Go
          </>
        )}
      </button>
    </div>
  );
}

export { LENSES };
export type { PromptLens as PromptLensType };
