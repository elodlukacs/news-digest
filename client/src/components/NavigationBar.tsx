import { useState, useRef, useEffect } from 'react';
import { Plus, X, Settings, Trash2, Coffee, Menu, Home, ChevronRight, Film, BarChart3 } from 'lucide-react';
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
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [contextId, setContextId] = useState<number | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

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

  const handleContextMenu = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    const navRect = navRef.current?.getBoundingClientRect();
    setContextPos({
      x: e.clientX - (navRect?.left || 0),
      y: e.clientY - (navRect?.top || 0),
    });
    setContextId(id);
  };

  const closeContext = () => setContextId(null);

  const selectAndClose = (id: number) => {
    onSelect(id);
    setDrawerOpen(false);
    closeContext();
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
    <>
      {/* ═══ Desktop: Unified Masthead ═══ */}
      <div className="hidden md:block">
        <div className="max-w-[1600px] mx-auto px-6">
          {/* Top rail: edition | date | theme & stats */}
          <div className="flex items-center justify-between pt-3 pb-2">
            <p className="text-[9px] font-sans uppercase tracking-[0.3em] text-ink-muted">{edition}</p>
            <div className="flex items-center gap-4">
              <p className="text-[9px] font-sans uppercase tracking-[0.25em] text-ink-muted">{todayShort}</p>
              <div className="flex items-center gap-1.5" ref={themeRef}>
                {THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => onThemeChange(t)}
                    className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all duration-200 ${
                      theme === t ? 'ring-1 ring-ink ring-offset-1 ring-offset-paper scale-110' : 'opacity-40 hover:opacity-80 hover:scale-110'
                    }`}
                    style={{ backgroundColor: THEME_COLORS[t].bg }}
                    title={THEME_COLORS[t].label}
                    aria-label={`Switch to ${THEME_COLORS[t].label} theme`}
                  />
                ))}
              </div>
              <button
                onClick={onShowStats}
                className="text-ink-muted hover:text-ink cursor-pointer transition-colors duration-200"
                title="LLM Statistics"
              >
                <BarChart3 size={12} />
              </button>
            </div>
          </div>

          {/* Masthead */}
          <div className="text-center pt-1 pb-3">
            <h1 className="font-serif text-[42px] font-black tracking-[-0.02em] text-masthead leading-[0.95]">
              The Daily Brief
            </h1>
            <p className="mt-1 text-[9px] font-sans uppercase tracking-[0.35em] text-masthead/40 font-medium">
              AI-Curated News Summaries
            </p>
          </div>

        </div>

        {/* Section nav bar — subtle background with thin borders */}
        <nav className="bg-paper-dark border-y border-rule" ref={navRef}>
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
                  onClick={() => { onSelect(cat.id); closeContext(); }}
                  onContextMenu={(e) => handleContextMenu(e, cat.id)}
                />
              </div>
            ))}

            <NavDivider />

            {adding ? (
              <div className="flex items-center gap-1 shrink-0 px-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  placeholder="New section..."
                  className="w-28 px-2 py-0.5 text-[11px] uppercase tracking-wider font-medium border-b border-masthead bg-transparent text-ink placeholder-ink-muted focus:outline-none"
                />
                <button
                  onClick={() => { setAdding(false); setNewName(''); }}
                  className="p-0.5 text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="shrink-0 px-3 py-2.5 text-ink-muted/50 hover:text-ink cursor-pointer transition-colors"
                title="Add section"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </nav>

        {/* Desktop context menu */}
        {contextId && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeContext} />
            <div
              className="absolute z-50 bg-paper border border-ink shadow-md py-0 min-w-[160px]"
              style={{ left: contextPos.x, top: contextPos.y + 20 }}
            >
              <button
                onClick={() => { onManageFeeds(contextId); closeContext(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-[11px] uppercase tracking-wider font-medium text-ink hover:bg-ink hover:text-paper cursor-pointer transition-colors duration-150"
              >
                <Settings size={11} />
                Manage Sources
              </button>
              <div className="h-px bg-rule" />
              <button
                onClick={() => { onDelete(contextId); closeContext(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-[11px] uppercase tracking-wider font-medium text-accent hover:bg-accent hover:text-white cursor-pointer transition-colors duration-150"
              >
                <Trash2 size={11} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═══ Mobile: Top bar ═══ */}
      <nav className="md:hidden border-b-2 border-ink">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 p-1 -ml-1 text-ink cursor-pointer"
            aria-label="Open menu"
          >
            <Menu size={18} />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Index</span>
          </button>

          <h1 className="font-serif text-lg font-black text-masthead tracking-tight leading-none">
            The Daily Brief
          </h1>

          <span className="text-[10px] font-sans uppercase tracking-[0.15em] font-medium text-masthead truncate max-w-[30%] text-right">
            {currentLabel}
          </span>
        </div>
      </nav>

      {/* ═══ Mobile Drawer ═══ */}
      <div
        className={`fixed inset-0 z-40 bg-ink/50 transition-opacity duration-300 md:hidden ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-paper shadow-2xl transition-transform duration-300 ease-out md:hidden flex flex-col ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-ink">
          <h2 className="font-serif text-base font-black text-masthead tracking-tight">Index</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1 -mr-1 text-ink-muted hover:text-ink cursor-pointer transition-colors"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

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
              <p className="text-[8px] uppercase tracking-[0.3em] font-bold text-ink-muted mt-2 mb-1">Sections</p>
            </div>
          )}

          <div className="pb-2">
            {categories.map((cat) => {
              const active = cat.id === activeId;
              return (
                <div key={cat.id} className="group">
                  <button
                    onClick={() => selectAndClose(cat.id)}
                    className={`w-full flex items-center justify-between px-5 py-2.5 text-left cursor-pointer transition-colors duration-200 ${
                      active ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-dark'
                    }`}
                  >
                    <span className="text-[12px] uppercase tracking-[0.1em] font-semibold">{cat.name}</span>
                    <div className="flex items-center gap-1.5">
                      {cat.feed_count > 0 && (
                        <span className={`text-[9px] px-1.5 py-0.5 ${active ? 'text-paper/60' : 'text-ink-muted bg-paper-dark'}`}>
                          {cat.feed_count}
                        </span>
                      )}
                      <ChevronRight size={12} className={active ? 'text-paper/40' : 'text-ink-muted/30'} />
                    </div>
                  </button>

                  {active && (
                    <div className="flex items-center gap-0.5 px-5 pb-1.5 -mt-0.5 bg-ink/[0.03]">
                      <button
                        onClick={(e) => { e.stopPropagation(); onManageFeeds(cat.id); setDrawerOpen(false); }}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-medium text-ink-muted hover:text-masthead cursor-pointer transition-colors"
                      >
                        <Settings size={10} /> Sources
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(cat.id); setDrawerOpen(false); }}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-medium text-accent/60 hover:text-accent cursor-pointer transition-colors"
                      >
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
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  placeholder="Section name..."
                  className="flex-1 px-3 py-2 text-[12px] uppercase tracking-wider font-medium border-b border-ink bg-transparent text-ink placeholder-ink-muted focus:outline-none"
                />
                <button onClick={() => { setAdding(false); setNewName(''); }} className="p-1 text-ink-muted hover:text-ink cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-ink-muted hover:text-ink cursor-pointer transition-colors border border-dashed border-ink/20 hover:border-ink/50"
              >
                <Plus size={11} /> Add Section
              </button>
            )}
          </div>
        </div>

        {/* Theme switcher in drawer footer */}
        <div className="border-t border-rule px-5 py-3 bg-paper-dark flex items-center justify-between">
          <p className="text-[8px] uppercase tracking-[0.25em] font-bold text-ink-muted">Edition</p>
          <div className="flex items-center gap-2">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => onThemeChange(t)}
                className={`w-4 h-4 rounded-full cursor-pointer transition-all duration-200 border ${
                  theme === t ? 'border-ink scale-110' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
                style={{ backgroundColor: THEME_COLORS[t].bg }}
                title={THEME_COLORS[t].label}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Shared sub-components ─── */

function NavBox({ label, icon, active, onClick, onContextMenu }: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`shrink-0 px-4 py-2.5 flex items-center gap-1.5 text-[13px] tracking-wide cursor-pointer transition-all duration-200 ${
        active
          ? 'bg-masthead text-white font-semibold'
          : 'text-ink-muted font-medium hover:text-ink hover:bg-paper'
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
      className={`w-full flex items-center gap-3 px-5 py-3 text-left cursor-pointer transition-colors duration-200 ${
        active ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-dark'
      }`}
    >
      <span className={active ? 'text-paper/60' : 'text-ink-muted'}>{icon}</span>
      <span className="text-[12px] uppercase tracking-[0.1em] font-semibold">{label}</span>
    </button>
  );
}
