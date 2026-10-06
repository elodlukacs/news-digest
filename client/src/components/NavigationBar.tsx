import { useState, useEffect, useRef, useCallback } from 'react';
import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { Link, NavLink, matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  X,
  Coffee,
  AlignJustify,
  Home,
  Film,
  Brain,
  Briefcase,
  Shield,
  MessageSquareCode,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Minus,
  Compass,
  Shuffle,
  ScrollText,
} from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { THEMES } from '../hooks/useTheme';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSwipeToOpen } from '../hooks/useSwipeToOpen';
import { slugify } from '../utils/slugify';
import type { Category } from '../types';
import type { GroqModel } from '../hooks/useModels';

const FONT_SIZE_MIN = 14;
const FONT_SIZE_MAX = 22;
const FONT_SIZE_STEP = 2;
// Matches the sheet's close animation (data-[state=closed]:duration-200 below).
const DRAWER_CLOSE_MS = 200;

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** Only an exact match is active (Home would otherwise match every route). */
  end?: boolean;
}

// Every destination, once. The desktop tool bar shows all but Home (Home leads
// the category bar); the mobile drawer shows all of them.
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/briefing', label: 'Briefing', icon: Coffee },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/break', label: 'Break', icon: Shuffle },
  { to: '/releases', label: 'Releases', icon: Film },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/mindgames', label: 'MindGames', icon: Shield },
  { to: '/prompts', label: 'Prompts', icon: MessageSquareCode },
  { to: '/logs', label: 'Logs', icon: ScrollText },
];

const THEME_COLORS: Record<string, { bg: string; label: string }> = {
  classic: { bg: '#8B4513', label: 'Classic' },
  broadsheet: { bg: '#1A365D', label: 'Broadsheet' },
  evening: { bg: '#C9A04E', label: 'Evening' },
  morning: { bg: '#2D6A4F', label: 'Morning' },
};

const categoryPath = (cat: Category) => `/category/${slugify(cat.name)}`;

/** Plain left click without modifiers — anything else (new tab, etc.) is left to the browser. */
const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

interface Props {
  categories: Category[];
  onAdd: (name: string) => Promise<void>;
  theme: string;
  onThemeChange: (theme: string) => void;
  onShowStats: () => void;
  selectedLlm: string;
  onLlmChange: (id: string) => void;
  models: GroqModel[];
  modelsLoading: boolean;
  articleFontSize: number;
  onFontSizeChange: (size: number) => void;
}

export function NavigationBar({
  categories,
  onAdd,
  theme,
  onThemeChange,
  onShowStats,
  selectedLlm,
  onLlmChange,
  models,
  modelsLoading,
  articleFontSize,
  onFontSizeChange,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [addingDesktop, setAddingDesktop] = useState(false);
  const [addingMobile, setAddingMobile] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  // Quick right flick from mid-screen opens the menu; the screen edges stay iOS's.
  useSwipeToOpen({ onOpen: openDrawer, enabled: isMobile && !drawerOpen });

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setAddingMobile(false);
    setNewName('');
  }, []);

  // Any route change closes the drawer — including Back/Forward and Safari's
  // edge swipe, which no menu item's click handler sees. (State adjusted during
  // render rather than in an effect, so the open drawer never paints on the new page.)
  const [routeKey, setRouteKey] = useState(location.key);
  if (routeKey !== location.key) {
    setRouteKey(location.key);
    setDrawerOpen(false);
    setAddingMobile(false);
    setNewName('');
  }

  useEffect(() => () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
  }, []);

  /**
   * Close first, navigate once the close animation is done. Navigating with
   * the drawer still on screen made Safari's back-swipe preview (a snapshot
   * taken at navigation time) show the menu open.
   */
  const navigateFromDrawer = useCallback((e: MouseEvent, to: string) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    closeDrawer();
    // Already there: just close, don't stack a duplicate history entry.
    if (to === location.pathname && !location.search) return;
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    navTimerRef.current = setTimeout(() => navigate(to), DRAWER_CLOSE_MS);
  }, [closeDrawer, navigate, location.pathname, location.search]);

  const activeCategory = (() => {
    const match = matchPath('/category/:slug', location.pathname);
    if (!match) return null;
    return categories.find((c) => slugify(c.name) === match.params.slug) ?? null;
  })();

  // Label in the mobile header. Unknown routes and an unknown or still-loading
  // category show nothing rather than a misleading "Home".
  const currentLabel = (() => {
    if (matchPath('/category/:slug', location.pathname)) return activeCategory?.name ?? '';
    const item = NAV_ITEMS.find((i) => matchPath({ path: i.to, end: i.end ?? false }, location.pathname));
    return item?.label ?? '';
  })();

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(name);
      setNewName('');
      setAddingDesktop(false);
      setAddingMobile(false);
    } catch (err) {
      // Keep the input open with the name so it can be retried.
      console.error('Failed to add section:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(el);
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateScrollButtons);
    };
  }, [categories, updateScrollButtons]);

  // Bring the active category into view in the scrolling bar, e.g. after
  // navigating to it from a link elsewhere on the page.
  useEffect(() => {
    const active = scrollRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [location.pathname, categories]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' });
  };

  const todayShort = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <div className="hidden md:block">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div className="flex items-end gap-4">
              {/* Not a heading: every page has its own h1. */}
              <Link to="/" className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead">
                <span className="block whitespace-nowrap font-serif text-[30px] lg:text-[38px] xl:text-[42px] font-black tracking-[-0.02em] text-masthead leading-[0.9]">
                  The Daily Brief
                </span>
                <span className="block mt-1 text-[9px] font-sans uppercase tracking-[0.35em] text-masthead/40 font-medium text-center">
                  AI-Curated News Summaries
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-3 lg:gap-5">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Model</span>
                <ModelPicker
                  models={models}
                  modelsLoading={modelsLoading}
                  selectedLlm={selectedLlm}
                  onLlmChange={onLlmChange}
                  triggerClassName="px-2.5 py-1 hover:bg-paper"
                  contentClassName="max-h-[400px] min-w-[220px]"
                />
              </div>

              <div className="w-px h-8 bg-rule" />

              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Date</span>
                <span className="whitespace-nowrap text-[11px] font-sans tracking-wide text-ink-light font-medium">{todayShort}</span>
              </div>

              <div className="w-px h-8 bg-rule" />

              <div className="flex flex-col items-center gap-1">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Font</span>
                <FontStepper size={articleFontSize} onChange={onFontSizeChange} variant="compact" />
              </div>

              <div className="w-px h-8 bg-rule" />

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Theme</span>
                <ThemeDots theme={theme} onChange={onThemeChange} variant="compact" />
              </div>

              <div className="w-px h-8 bg-rule" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onShowStats}
                    className="flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-70 transition-opacity rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead"
                  >
                    <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Stats</span>
                    <Brain size={16} className="text-ink-light" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>LLM usage statistics</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <nav aria-label="Sections" className="bg-paper border-b border-t border-rule">
          <div className="max-w-[1600px] mx-auto px-6">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => scroll('left')}
                className={`shrink-0 px-1.5 py-2.5 cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-masthead focus-visible:ring-offset-1 ${
                  canScrollLeft ? 'text-ink-muted/70 hover:text-ink hover:bg-paper-dark' : 'invisible opacity-0'
                }`}
                aria-label="Scroll categories left"
                disabled={!canScrollLeft}
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </button>
              <div
                ref={scrollRef}
                className="flex items-center flex-1 overflow-x-auto scrollbar-none scroll-smooth min-w-0"
              >
                <NavBox to="/" end label="Home" icon={<Home size={14} />} />
                <NavDivider />

                {categories.map((cat) => (
                  <NavBox key={cat.id} to={categoryPath(cat)} label={cat.name} />
                ))}

                {addingDesktop ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
                    className="flex items-center gap-1 shrink-0 px-2"
                  >
                    <Input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') { setAddingDesktop(false); setNewName(''); }
                      }}
                      enterKeyHint="done"
                      placeholder="New section..."
                      disabled={submitting}
                      className="w-28 px-2 py-0.5 text-[11px] uppercase tracking-wider font-medium border-b border-masthead bg-transparent text-ink placeholder-ink-muted focus:outline-none h-auto"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setAddingDesktop(false); setNewName(''); }} className="h-6 w-6" aria-label="Cancel">
                      <X size={11} />
                    </Button>
                  </form>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setAddingDesktop(true)} className="h-6 w-6 text-ink-muted/50" aria-label="Add section">
                        <Plus size={12} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add section</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <button
                type="button"
                onClick={() => scroll('right')}
                className={`shrink-0 px-1.5 py-2.5 cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-masthead focus-visible:ring-offset-1 ${
                  canScrollRight ? 'text-ink-muted/70 hover:text-ink hover:bg-paper-dark' : 'invisible opacity-0'
                }`}
                aria-label="Scroll categories right"
                disabled={!canScrollRight}
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </nav>

        <nav aria-label="Tools" className="bg-paper-dark border-b border-rule">
          {/* Scrolls instead of overflowing on narrow tablets (iPad portrait). */}
          <div className="max-w-[1600px] mx-auto px-6 flex items-center gap-1 overflow-x-auto scrollbar-none">
            {NAV_ITEMS.filter((i) => i.to !== '/').map((item, idx) => (
              <div key={item.to} className="flex items-center shrink-0">
                {idx > 0 && <NavDivider />}
                <NavBox to={item.to} end={item.end} label={item.label} icon={<item.icon size={13} />} compact />
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* viewport-fit=cover draws the page under the iPhone status bar, which
          iOS blurs; the inset pushes the header below it so the menu button
          is fully tappable. */}
      <header className="md:hidden border-b-2 border-ink pt-[env(safe-area-inset-top)]">
        {/* Equal side columns keep the title centred whatever the label length. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-0.5">
          <button
            type="button"
            onClick={openDrawer}
            className="justify-self-start h-11 w-11 flex items-center justify-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <AlignJustify size={26} strokeWidth={2.2} className="text-ink" />
          </button>

          <Link to="/" className="font-serif text-lg font-black text-masthead tracking-tight leading-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead">
            The Daily Brief
          </Link>

          <span className="justify-self-end min-w-0 max-w-full pr-2 text-[10px] font-sans uppercase tracking-[0.15em] font-medium text-masthead truncate text-right">
            {currentLabel}
          </span>
        </div>
      </header>

      <Sheet open={drawerOpen} onOpenChange={(open) => (open ? openDrawer() : closeDrawer())}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="w-[280px] max-w-[85vw] p-0 gap-0 flex flex-col border-r-0 pb-[env(safe-area-inset-bottom)] data-[state=closed]:duration-200"
          closeClassName="top-[calc(0.5rem+env(safe-area-inset-top))] h-11 w-11"
        >
          <SheetHeader className="px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <SheetTitle className="font-serif text-base font-black text-masthead">Index</SheetTitle>
          </SheetHeader>

          {/* One scroll area for the list and the settings below it, so a
              short (landscape) screen can still reach every item. */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
            <nav aria-label="Main" className="py-1">
              {NAV_ITEMS.map((item) => (
                <DrawerLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  label={item.label}
                  icon={<item.icon size={14} />}
                  onNavigate={navigateFromDrawer}
                />
              ))}
            </nav>

            {categories.length > 0 && (
              <div className="px-5 py-2">
                <div className="h-px bg-ink/20" />
                <p className="text-[8px] uppercase tracking-[0.3em] font-bold text-ink-muted mt-2 mb-1 font-serif">Sections</p>
              </div>
            )}

            <nav aria-label="Sections" className="pb-2">
              {categories.map((cat) => (
                <DrawerLink
                  key={cat.id}
                  to={categoryPath(cat)}
                  label={cat.name}
                  badge={cat.feed_count > 0 ? cat.feed_count : undefined}
                  onNavigate={navigateFromDrawer}
                />
              ))}
            </nav>

            <div className="px-5 mt-1 pb-4">
              {addingMobile ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
                  className="flex items-center gap-1"
                >
                  <Input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setAddingMobile(false); setNewName(''); }
                    }}
                    enterKeyHint="done"
                    placeholder="Section name..."
                    disabled={submitting}
                    className="flex-1 px-3 py-2 text-[12px] uppercase tracking-wider font-medium border-b border-ink bg-transparent text-ink placeholder-ink-muted focus:outline-none h-auto"
                  />
                  <Button type="submit" variant="ghost" size="icon" disabled={!newName.trim() || submitting} className="h-11 w-11 text-ink" aria-label="Save section">
                    <Check size={16} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setAddingMobile(false); setNewName(''); }} className="h-11 w-11" aria-label="Cancel">
                    <X size={16} />
                  </Button>
                </form>
              ) : (
                <Button variant="outline" onClick={() => setAddingMobile(true)} className="w-full min-h-11 border-dashed border-ink/20 hover:border-ink/50 gap-1.5 py-2 text-[10px] uppercase tracking-[0.2em] font-semibold">
                  <Plus size={11} /> Add Section
                </Button>
              )}
            </div>

            <div className="mt-auto border-t border-rule px-5 py-3 bg-paper-dark space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Model</p>
                <ModelPicker
                  models={models}
                  modelsLoading={modelsLoading}
                  selectedLlm={selectedLlm}
                  onLlmChange={onLlmChange}
                  triggerClassName="min-h-11 px-3 bg-paper"
                  contentClassName="max-h-[300px] min-w-[200px]"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Theme</p>
                <ThemeDots theme={theme} onChange={onThemeChange} variant="touch" />
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Font</p>
                <FontStepper size={articleFontSize} onChange={onFontSizeChange} variant="touch" />
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Stats</p>
                <button
                  type="button"
                  onClick={() => { onShowStats(); closeDrawer(); }}
                  className="min-h-11 -mr-2 px-2 flex items-center gap-2 rounded-md text-[13px] font-medium text-ink-light hover:text-masthead transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead"
                >
                  <Brain size={18} />
                  <span>LLM usage</span>
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function formatTokens(n: number): string {
  if (n >= 1024) return `${Math.round(n / 1024)}k`;
  return String(n);
}

function groupModels(models: GroqModel[]): { owner: string; models: GroqModel[] }[] {
  const groups = new Map<string, GroqModel[]>();
  for (const m of models) {
    const key = m.provider || m.owned_by;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }
  return Array.from(groups.entries()).map(([owner, models]) => ({ owner, models }));
}

function ModelPicker({ models, modelsLoading, selectedLlm, onLlmChange, triggerClassName, contentClassName }: {
  models: GroqModel[];
  modelsLoading: boolean;
  selectedLlm: string;
  onLlmChange: (id: string) => void;
  triggerClassName: string;
  contentClassName: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Model: ${modelsLoading ? 'loading' : selectedLlm}`}
          className={`flex items-center gap-1.5 text-[10px] font-sans font-medium tracking-wide bg-paper-dark rounded-md text-ink cursor-pointer transition-all duration-200 min-w-[120px] justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead ${triggerClassName}`}
        >
          <span className="truncate max-w-[140px]">
            {modelsLoading ? 'Loading...' : selectedLlm}
          </span>
          <ChevronDown size={10} className="shrink-0 text-ink-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`overflow-y-auto ${contentClassName}`}>
        {groupModels(models).map((group) => (
          <div key={group.owner}>
            <div className="px-3 py-1.5 text-[9px] font-sans uppercase tracking-[0.15em] font-bold text-ink-muted/60 sticky top-0 bg-paper">
              {group.owner}
            </div>
            {group.models.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => onLlmChange(m.id)}
                className="text-[11px] font-sans gap-2 flex-col items-start py-1.5"
              >
                <div className="flex items-center gap-2 w-full">
                  <Check size={12} className={selectedLlm === m.id ? 'opacity-100' : 'opacity-0'} />
                  <span className="truncate flex-1">{m.id}</span>
                </div>
                <div className="ml-5 flex items-center gap-2 text-[9px] text-ink-muted/70 font-medium">
                  <span>{formatTokens(m.context_window)} ctx</span>
                  <span>·</span>
                  <span>{formatTokens(m.max_completion_tokens)} out</span>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** `compact` for the desktop masthead; `touch` gives 44px targets in the drawer. */
function ThemeDots({ theme, onChange, variant }: { theme: string; onChange: (t: string) => void; variant: 'compact' | 'touch' }) {
  const touch = variant === 'touch';
  return (
    <div className={`flex items-center ${touch ? '-mr-2.5' : 'gap-2'}`}>
      {THEMES.map((t) => {
        const active = theme === t;
        const dot = (
          <button
            type="button"
            onClick={() => onChange(t)}
            aria-label={`${THEME_COLORS[t].label} theme`}
            aria-pressed={active}
            className={`cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead ${
              touch ? 'h-11 w-11 flex items-center justify-center' : ''
            }`}
          >
            <span
              aria-hidden
              className={`block rounded-full transition-all duration-200 ${
                touch
                  ? `w-5 h-5 border ${active ? 'border-ink scale-110' : 'border-transparent opacity-50'}`
                  : `w-3 h-3 ${active ? 'ring-1.5 ring-ink ring-offset-1 ring-offset-paper scale-125' : 'opacity-40 hover:opacity-90 hover:scale-110'}`
              }`}
              style={{ backgroundColor: THEME_COLORS[t].bg }}
            />
          </button>
        );
        if (touch) return <span key={t}>{dot}</span>;
        return (
          <Tooltip key={t}>
            <TooltipTrigger asChild>{dot}</TooltipTrigger>
            <TooltipContent>{THEME_COLORS[t].label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function FontStepper({ size, onChange, variant }: { size: number; onChange: (size: number) => void; variant: 'compact' | 'touch' }) {
  const touch = variant === 'touch';
  const button = touch
    ? 'h-11 w-11 rounded-md border border-rule/60 bg-paper'
    : 'w-6 h-[22px] bg-paper';
  const buttonBase = `flex items-center justify-center text-ink-muted hover:bg-paper-dark hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead ${button}`;
  return (
    <div className={touch ? 'flex items-center gap-2' : 'flex items-stretch rounded border border-rule/60 overflow-hidden'}>
      <button
        type="button"
        onClick={() => onChange(size - FONT_SIZE_STEP)}
        disabled={size <= FONT_SIZE_MIN}
        className={`${buttonBase} ${touch ? '' : 'border-r border-rule/60'}`}
        aria-label="Decrease font size"
      >
        <Minus size={touch ? 14 : 10} strokeWidth={2.5} />
      </button>
      <span
        aria-live="polite"
        aria-label={`Font size ${size} pixels`}
        className={touch
          ? 'min-w-[3.25rem] text-center text-sm font-mono font-bold text-ink-light select-none tabular-nums'
          : 'w-5 h-[22px] flex items-center justify-center bg-paper-dark text-[10px] font-mono font-bold text-ink-light select-none'}
      >
        {touch ? `${size}px` : size}
      </span>
      <button
        type="button"
        onClick={() => onChange(size + FONT_SIZE_STEP)}
        disabled={size >= FONT_SIZE_MAX}
        className={`${buttonBase} ${touch ? '' : 'border-l border-rule/60'}`}
        aria-label="Increase font size"
      >
        <Plus size={touch ? 14 : 10} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function NavBox({ to, end, label, icon, compact }: {
  to: string;
  end?: boolean;
  label: string;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `shrink-0 flex items-center gap-1.5 cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-masthead ${
        compact ? 'px-3 py-2 text-[11px] font-medium' : 'px-4 py-2.5 text-[13px] tracking-wide font-medium'
      } ${
        isActive
          ? 'bg-masthead text-white font-semibold'
          : 'text-ink-muted hover:bg-paper-dark hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </NavLink>
  );
}

function NavDivider() {
  return <div className="w-px h-4 bg-rule shrink-0 mx-0.5" />;
}

function DrawerLink({ to, end, label, icon, badge, onNavigate }: {
  to: string;
  end?: boolean;
  label: string;
  icon?: ReactNode;
  badge?: number;
  onNavigate: (e: MouseEvent, to: string) => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={(e) => onNavigate(e, to)}
      className={({ isActive }) => `w-full min-h-11 flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-masthead ${
        isActive ? 'bg-masthead text-white' : 'text-ink hover:bg-paper-dark'
      }`}
    >
      {({ isActive }) => (
        <>
          {icon && <span className={isActive ? 'text-white/60' : 'text-ink-muted'}>{icon}</span>}
          <span className="text-[12px] uppercase font-semibold font-serif">{label}</span>
          {badge !== undefined && (
            <span className={`ml-auto text-[9px] px-1.5 py-0.5 ${isActive ? 'text-white/60' : 'text-ink-muted bg-paper-dark'}`}>
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
