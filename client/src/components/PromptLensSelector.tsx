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
  fullWidth?: boolean;
}

function LensMenuContent({
  selected,
  onSelect,
  setOpen,
}: {
  selected: PromptLens | null;
  onSelect: (lens: PromptLens | null) => void;
  setOpen: (v: boolean) => void;
}) {
  return (
    <>
      <DropdownMenuItem
        role="menuitemradio"
        aria-checked={!selected}
        onClick={() => { onSelect(null); setOpen(false); }}
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
              role="menuitemradio"
              aria-checked={selected?.slug === lens.slug}
              onClick={() => { onSelect(lens); setOpen(false); }}
              className={selected?.slug === lens.slug ? 'bg-paper-dark' : ''}
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
    </>
  );
}

export function PromptLensSelector({ selectedSlug, onSelect, onRun, running, disabled, fullWidth }: Props) {
  const [open, setOpen] = useState(false);
  const selected = LENSES.find((l) => l.slug === selectedSlug) ?? null;

  if (fullWidth) {
    return (
      <div className="flex flex-col gap-2">
        {/* Trigger row: dropdown trigger + clear button as siblings */}
        <div className="flex">
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <button
                disabled={disabled}
                className={`flex-1 flex items-center gap-3 px-4 py-3 border border-rule bg-paper text-ink disabled:opacity-50 active:scale-[0.98] transition-transform cursor-pointer ${selected ? 'rounded-l-xl border-r-0' : 'rounded-xl'}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {selected ? (
                    <span className="text-xl shrink-0">{selected.icon}</span>
                  ) : (
                    <Eye size={18} className="text-ink-muted shrink-0" />
                  )}
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-sm font-semibold leading-tight text-ink truncate">
                      {selected ? selected.name : 'Reading Lens'}
                    </span>
                    <span className="text-[11px] text-ink-muted mt-0.5 truncate">
                      {selected ? selected.description : 'Choose a perspective'}
                    </span>
                  </div>
                </div>
                <ChevronDown size={16} className="text-ink-muted shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto">
              <LensMenuContent selected={selected} onSelect={onSelect} setOpen={setOpen} />
            </DropdownMenuContent>
          </DropdownMenu>

          {selected && (
            <button
              onClick={() => onSelect(null)}
              className="flex items-center justify-center px-3 rounded-r-xl border border-l-0 border-rule bg-paper hover:bg-paper-dark transition-colors cursor-pointer"
              aria-label="Clear lens"
            >
              <X size={14} className="text-ink-muted" />
            </button>
          )}
        </div>

        {selected && (
          <button
            onClick={onRun}
            disabled={disabled || running}
            aria-label={running ? 'Generating lens result' : `Run ${selected.name}`}
            aria-busy={running}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-masthead text-paper disabled:opacity-50 active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold leading-tight">
                {running ? 'Generating…' : `Run ${selected.name}`}
              </span>
              {!running && (
                <span className="text-[11px] text-paper/60 mt-0.5">{selected.description}</span>
              )}
            </div>
            {running ? (
              <span className="animate-pulse text-paper/70 text-lg tracking-widest">···</span>
            ) : (
              <Play size={18} className="shrink-0 ml-3" fill="currentColor" />
            )}
          </button>
        )}
      </div>
    );
  }

  // Desktop: segmented pill — clear button is a sibling outside the trigger
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-rule shadow-sm">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-serif bg-paper hover:bg-paper-dark border-r border-rule transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {selected ? (
              <>
                <span className="text-sm leading-none">{selected.icon}</span>
                <span className="text-ink font-medium max-w-[110px] truncate">{selected.name}</span>
                <ChevronDown size={12} className="text-ink-muted" />
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
        <DropdownMenuContent align="start" sideOffset={6} className="w-64">
          <LensMenuContent selected={selected} onSelect={onSelect} setOpen={setOpen} />
        </DropdownMenuContent>
      </DropdownMenu>

      {selected && (
        <button
          onClick={() => onSelect(null)}
          className="inline-flex items-center justify-center px-2 py-1.5 bg-paper hover:bg-paper-dark border-r border-rule transition-colors cursor-pointer"
          aria-label="Clear lens"
        >
          <X size={12} className="text-ink-muted" />
        </button>
      )}

      <button
        onClick={onRun}
        disabled={disabled || !selected || running}
        aria-label={running ? 'Generating lens result' : 'Run selected lens'}
        aria-busy={running}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-serif font-semibold bg-masthead text-paper hover:bg-masthead/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {running ? (
          <span className="animate-pulse tracking-widest">···</span>
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
