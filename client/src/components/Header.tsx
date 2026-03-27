import { BarChart3, Calendar } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
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
  const today = new Date();
  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <TooltipProvider>
    <header className="max-w-[1600px] mx-auto px-4 md:px-6 pt-4 pb-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:gap-6">
          <div className="text-center sm:text-left">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-masthead leading-[0.85]">
              The Daily Brief
            </h1>
            <p className="mt-1 text-[11px] sm:text-[12px] font-serif italic text-masthead/50 tracking-wide hidden sm:block">
              AI-curated news summaries
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-ink-muted">
            <div className="w-px h-8 bg-rule" />
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-end gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-ink-muted">
            <Calendar size={14} className="hidden sm:block" />
            <span className="text-[11px] font-sans tracking-wide">{todayFormatted}</span>
          </div>

          <div className="flex items-center gap-4">
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-sans uppercase tracking-[0.2em] text-ink-muted mr-1 hidden md:inline">Theme</span>
                <div className="flex items-center gap-2">
                  {THEMES.map((t) => (
                    <Tooltip key={t}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onThemeChange(t)}
                          className={`w-5 h-5 rounded-full cursor-pointer transition-all duration-200 border-2 ${
                            theme === t
                              ? 'border-ink scale-125'
                              : 'border-transparent hover:scale-110 opacity-50 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: THEME_COLORS[t].bg }}
                          aria-label={`Switch to ${THEME_COLORS[t].label} theme`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{THEME_COLORS[t].label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="w-px h-5 bg-rule hidden sm:block" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onShowStats}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <BarChart3 size={16} className="text-masthead" />
                    <span className="text-[11px] font-sans uppercase tracking-[0.15em] font-medium">Stats</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>LLM Statistics</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </header>
    </TooltipProvider>
  );
}