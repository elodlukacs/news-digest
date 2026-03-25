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

  const edition = `Vol. ${new Date().getFullYear() - 2024 + 1}, No. ${Math.ceil(
    (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000
  )}`;

  return (
    <header className="max-w-7xl mx-auto px-6 pt-10 pb-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-ink-muted">{edition}</p>
        <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-ink-muted">{today}</p>
      </div>

      <div className="text-center">
        <h1 className="font-serif text-7xl font-black tracking-tight text-masthead leading-[0.9]">
          The Daily Brief
        </h1>
        <p className="mt-4 text-[12px] font-serif italic text-masthead/50 tracking-wide">
          AI-curated news summaries
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-rule flex items-center justify-center gap-8">
        {/* Theme */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink-muted">Edition</span>
          <div className="flex items-center gap-1.5">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => onThemeChange(t)}
                className={`w-4 h-4 rounded-full cursor-pointer transition-all duration-200 border-2 ${
                  theme === t
                    ? 'border-ink scale-110'
                    : 'border-transparent hover:scale-110 opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: THEME_COLORS[t].bg }}
                title={THEME_COLORS[t].label}
              />
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-rule" />

        {/* Statistics */}
        <button
          onClick={onShowStats}
          className="flex items-center gap-2.5 text-ink-muted hover:text-masthead cursor-pointer transition-colors duration-300"
        >
          <BarChart3 size={16} />
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Statistics</span>
        </button>
      </div>
    </header>
  );
}
