import { BarChart3 } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';
import { THEMES } from '../hooks/useTheme';

const THEME_COLORS: Record<string, { bg: string; label: string }> = {
  classic: { bg: '#8B4513', label: 'Classic' },
  broadsheet: { bg: '#1A365D', label: 'Broadsheet' },
  evening: { bg: '#C9A04E', label: 'Evening' },
  morning: { bg: '#2D6A4F', label: 'Morning' },
};

interface Props {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onShowStats: () => void;
}

export function Header({ theme, onThemeChange, onShowStats }: Props) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const todayShort = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.ceil((now.getTime() - startOfYear.getTime()) / 86400000);
  const edition = `Vol. ${now.getFullYear() - 2024 + 1}, No. ${dayOfYear}`;

  return (
    <header className="max-w-[1600px] mx-auto px-4 md:px-6 pt-3 md:pt-4 pb-2 md:pb-3">
      {/* Single row: meta | masthead | controls */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: edition + date */}
        <div className="shrink-0 hidden sm:block">
          <p className="text-[9px] md:text-[10px] font-sans uppercase tracking-[0.25em] text-ink-muted">{edition}</p>
          <p className="text-[9px] md:text-[10px] font-sans uppercase tracking-[0.2em] text-ink-muted mt-0.5">{todayShort}</p>
        </div>

        {/* Center: masthead */}
        <div className="text-center flex-1 min-w-0">
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-masthead leading-[0.9]">
            The Daily Brief
          </h1>
          <p className="mt-0.5 text-[10px] md:text-[11px] font-serif italic text-masthead/50 tracking-wide">
            AI-curated news summaries
          </p>
        </div>

        {/* Right: theme + stats */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => onThemeChange(t)}
                className={`w-3.5 h-3.5 rounded-full cursor-pointer transition-all duration-200 border-2 ${
                  theme === t
                    ? 'border-ink scale-110'
                    : 'border-transparent hover:scale-110 opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: THEME_COLORS[t].bg }}
                title={THEME_COLORS[t].label}
                aria-label={`Switch to ${THEME_COLORS[t].label} theme`}
              />
            ))}
          </div>
          <div className="w-px h-3.5 bg-rule" />
          <button
            onClick={onShowStats}
            className="flex items-center gap-1.5 text-ink-muted hover:text-masthead cursor-pointer transition-colors duration-300"
          >
            <BarChart3 size={14} />
            <span className="hidden md:inline text-[9px] uppercase tracking-[0.2em] font-semibold">Stats</span>
          </button>
        </div>
      </div>
    </header>
  );
}
