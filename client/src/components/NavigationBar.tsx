import { useState, useRef } from 'react';
import { Plus, X, Settings, Trash2, Coffee, Menu, Home, Film, BarChart3 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
import type { Category } from '../types';
import type { Theme } from '../hooks/useTheme';
import { THEMES } from '../hooks/useTheme';

const THEME_COLORS: Record<string, { bg: string; label: string }> = {
  classic: { bg: '#8B4513', label: 'Classic' },
  broadsheet: { bg: '#1A365D', label: 'Broadsheet' },
  evening: { bg: '#C9A04E', label: 'Evening' },
  morning: { bg: '#2D6A4F', label: 'Morning' },
};

interface Props {
  categories: Category[];
  activeId: number | null;
  showBriefing: boolean;
  showReleases: boolean;
  onSelect: (id: number) => void;
  onBriefing: () => void;
  onReleases: () => void;
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onManageFeeds: (id: number) => void;
  onHome: () => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onShowStats: () => void;
  selectedLlm: string;
  onLlmChange: (llm: string) => void;
}

export function NavigationBar({
  categories,
  activeId,
  showBriefing,
  showReleases,
  onSelect,
  onBriefing,
  onReleases,
  onAdd,
  onDelete,
  onManageFeeds,
  onHome,
  theme,
  onThemeChange,
  onShowStats,
  selectedLlm,
  onLlmChange,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  const LLM_OPTIONS = [
    { id: 'llama', label: 'LLama', disabled: false },
    { id: 'minimax', label: 'MiniMax2.7', disabled: false },
    { id: 'local', label: 'Local', disabled: true },
  ];

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await onAdd(newName.trim());
      setNewName('');
      setAdding(false);
    } catch {
      // keep input open on failure
    }
  };

  const selectAndClose = (id: number) => {
    onSelect(id);
    setDrawerOpen(false);
  };

  const briefingAndClose = () => { onBriefing(); setDrawerOpen(false); };
  const releasesAndClose = () => { onReleases(); setDrawerOpen(false); };
  const homeAndClose = () => { onHome(); setDrawerOpen(false); };

  const isHome = !activeId && !showBriefing && !showReleases;

  const todayShort = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.ceil((now.getTime() - startOfYear.getTime()) / 86400000);
  const edition = `Vol. ${now.getFullYear() - 2024 + 1}, No. ${dayOfYear}`;

  const currentLabel = showReleases ? 'Releases' : showBriefing ? 'Briefing' : activeId ? categories.find(c => c.id === activeId)?.name : 'Home';

  return (
    <TooltipProvider>
      {/* ═══ Desktop: Unified Masthead ═══ */}
      <div className="hidden md:block">
        <div className="max-w-[1600px] mx-auto px-6">
          {/* Masthead: title left, tools right */}
          <div className="flex items-center justify-between pt-4 pb-3">
            {/* Left: Title block */}
            <div className="flex items-end gap-4">
              <div>
                <h1 className="font-serif text-[38px] lg:text-[42px] font-black tracking-[-0.02em] text-masthead leading-[0.9]">
                  The Daily Brief
                </h1>
                <p className="mt-1 text-[9px] font-sans uppercase tracking-[0.35em] text-masthead/40 font-medium">
                  AI-Curated News Summaries
                </p>
              </div>
              <p className="text-[9px] font-sans uppercase tracking-[0.25em] text-ink-muted pb-1 hidden lg:block">{edition}</p>
            </div>

            {/* Right: Tools area */}
            <div className="flex items-center gap-5">
              {/* LLM Selection */}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Model</span>
                <div className="flex items-center gap-0.5 bg-paper-dark rounded-md p-0.5">
                  {LLM_OPTIONS.map((opt) => (
                    <Tooltip key={opt.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => !opt.disabled && onLlmChange(opt.id)}
                          className={`px-2 py-1 text-[10px] font-sans font-medium tracking-wide rounded transition-all duration-200 ${
                            opt.disabled
                              ? 'text-ink-muted/30 cursor-not-allowed'
                              : selectedLlm === opt.id
                                ? 'bg-masthead text-white shadow-sm'
                                : 'text-ink-muted hover:text-ink hover:bg-paper cursor-pointer'
                          }`}
                        >
                          {opt.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{opt.disabled ? 'Coming soon' : opt.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="w-px h-8 bg-rule" />

              {/* Date */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Date</span>
                <span className="text-[11px] font-sans tracking-wide text-ink-light font-medium">{todayShort}</span>
              </div>

              <div className="w-px h-8 bg-rule" />

              {/* Theme */}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Theme</span>
                <div className="flex items-center gap-2" ref={themeRef}>
                  {THEMES.map((t) => (
                    <Tooltip key={t}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onThemeChange(t)}
                          className={`w-3 h-3 rounded-full cursor-pointer transition-all duration-200 p-0 ${
                            theme === t ? 'ring-1.5 ring-ink ring-offset-1 ring-offset-paper scale-125' : 'opacity-40 hover:opacity-90 hover:scale-110'
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

              <div className="w-px h-8 bg-rule" />

              {/* Stats */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onShowStats}
                    className="flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-70 transition-opacity"
                  >
                    <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Stats</span>
                    <BarChart3 size={16} className="text-ink-light" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>LLM Statistics</TooltipContent>
              </Tooltip>
            </div>
          </div>

        </div>

        {/* Section nav bar */}
        <nav className="bg-paper-dark border-y border-rule">
          <div className="max-w-[1600px] mx-auto px-6 flex items-center overflow-x-auto scrollbar-none">
            <NavBox label="Home" icon={<Home size={15} />} active={isHome} onClick={onHome} />
            <NavDivider />
            <NavBox label="Briefing" icon={<Coffee size={15} />} active={showBriefing} onClick={onBriefing} />
            <NavDivider />
            <NavBox label="Releases" icon={<Film size={15} />} active={showReleases} onClick={onReleases} />

            {categories.length > 0 && <NavDivider />}

            {categories.map((cat, i) => (
              <div key={cat.id} className="flex items-center shrink-0">
                {i > 0 && <NavDivider />}
                <NavBox
                  label={cat.name}
                  active={cat.id === activeId}
                  onClick={() => { onSelect(cat.id); }}
                />
              </div>
            ))}

            <NavDivider />

            {adding ? (
              <div className="flex items-center gap-1 shrink-0 px-2">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  placeholder="New section..."
                  className="w-28 px-2 py-0.5 text-[11px] uppercase tracking-wider font-medium border-b border-masthead bg-transparent text-ink placeholder-ink-muted focus:outline-none h-auto"
                />
                <Button variant="ghost" size="icon" onClick={() => { setAdding(false); setNewName(''); }} className="h-6 w-6">
                  <X size={11} />
                </Button>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setAdding(true)} className="h-6 w-6 text-ink-muted/50">
                    <Plus size={12} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add section</TooltipContent>
              </Tooltip>
            )}
          </div>
        </nav>

      </div>

      {/* ═══ Mobile: Top bar ═══ */}
      <nav className="md:hidden border-b-2 border-ink">
        <div className="flex items-center justify-between px-4 py-2">
          <Button variant="ghost" onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 -ml-1" aria-label="Open menu">
            <Menu size={18} />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Index</span>
          </Button>

          <h1 className="font-serif text-lg font-black text-masthead tracking-tight leading-none">
            The Daily Brief
          </h1>

          <span className="text-[10px] font-sans uppercase tracking-[0.15em] font-medium text-masthead truncate max-w-[30%] text-right">
            {currentLabel}
          </span>
        </div>
      </nav>

      {/* ═══ Mobile Drawer (ShadCN Sheet) ═══ */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0 gap-0 flex flex-col">
          <SheetHeader className="px-5 py-3 border-b-2 border-ink">
            <SheetTitle className="font-serif text-base font-black text-masthead tracking-tight">Index</SheetTitle>
          </SheetHeader>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto">
            <div className="py-1">
              <DrawerItem label="Home" icon={<Home size={14} />} active={isHome} onClick={homeAndClose} />
              <DrawerItem label="Morning Briefing" icon={<Coffee size={14} />} active={showBriefing} onClick={briefingAndClose} />
              <DrawerItem label="Releases" icon={<Film size={14} />} active={showReleases} onClick={releasesAndClose} />
            </div>

            {categories.length > 0 && (
              <div className="px-5 py-2">
                <div className="h-px bg-ink/20" />
                <p className="text-[8px] uppercase tracking-[0.3em] font-bold text-ink-muted mt-2 mb-1 font-serif">Sections</p>
              </div>
            )}

            <div className="pb-2">
              {categories.map((cat) => {
                const active = cat.id === activeId;
                return (
                  <div key={cat.id} className="group">
                    <button
                      onClick={() => selectAndClose(cat.id)}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors duration-200 ${
                        active ? 'bg-masthead text-white' : 'text-ink hover:bg-paper-dark'
                      }`}
                    >
                      <span className={`text-[12px] uppercase tracking-[0.1em] font-semibold font-serif ${active ? 'text-white' : 'text-ink'}`}>{cat.name}</span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        {cat.feed_count > 0 && (
                          <span className={`text-[9px] px-1.5 py-0.5 ${active ? 'text-white/60' : 'text-ink-muted bg-paper-dark'}`}>
                            {cat.feed_count}
                          </span>
                        )}
                      </div>
                    </button>

                    {active && (
                      <div className="flex items-center gap-0.5 px-5 pb-1.5 -mt-0.5 bg-paper-dark/50">
                        <button onClick={(e) => { e.stopPropagation(); onManageFeeds(cat.id); setDrawerOpen(false); }} className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-ink-muted hover:text-masthead h-auto px-2 py-1">
                          <Settings size={10} /> Sources
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(cat.id); setDrawerOpen(false); onHome(); }} className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-accent/60 hover:text-accent h-auto px-2 py-1">
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add */}
            <div className="px-5 mt-1 pb-4">
              {adding ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAdd();
                      if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                    }}
                    placeholder="Section name..."
                    className="flex-1 px-3 py-2 text-[12px] uppercase tracking-wider font-medium border-b border-ink bg-transparent text-ink placeholder-ink-muted focus:outline-none h-auto"
                  />
                  <Button variant="ghost" size="icon" onClick={() => { setAdding(false); setNewName(''); }} className="h-7 w-7">
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setAdding(true)} className="w-full border-dashed border-ink/20 hover:border-ink/50 gap-1.5 py-2 text-[10px] uppercase tracking-[0.2em] font-semibold">
                  <Plus size={11} /> Add Section
                </Button>
              )}
            </div>
          </div>

          {/* Theme switcher in drawer footer */}
          <div className="border-t border-rule px-5 py-3 bg-paper-dark flex items-center justify-between">
            <p className="text-[8px] uppercase tracking-[0.25em] font-bold text-ink-muted">Edition</p>
            <div className="flex items-center gap-2">
              {THEMES.map((t) => (
                <Tooltip key={t}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onThemeChange(t)}
                      className={`w-4 h-4 rounded-full cursor-pointer transition-all duration-200 border p-0 ${
                        theme === t ? 'border-ink scale-110' : 'border-transparent opacity-50 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: THEME_COLORS[t].bg }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{THEME_COLORS[t].label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

/* ─── Shared sub-components ─── */

function NavBox({ label, icon, active, onClick }: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-2.5 flex items-center gap-1.5 text-[13px] tracking-wide cursor-pointer transition-all duration-200 ${
        active
          ? 'bg-masthead text-white font-semibold'
          : 'text-ink-muted font-medium hover:bg-paper-dark hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function NavDivider() {
  return <div className="w-px h-4 bg-rule shrink-0" />;
}

function DrawerItem({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors duration-200 ${
        active ? 'bg-masthead text-white' : 'text-ink hover:bg-paper-dark'
      }`}
    >
      <span className={active ? 'text-white/60' : 'text-ink-muted'}>{icon}</span>
      <span className={`text-[12px] uppercase tracking-[0.1em] font-semibold font-serif`}>{label}</span>
    </button>
  );
}
