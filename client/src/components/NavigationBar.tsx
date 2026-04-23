import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, X, Coffee, AlignJustify, Home, Film, Brain, Briefcase, BarChart2, Shield, MessageSquareCode, ChevronDown, Check, Zap } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { THEMES } from '../hooks/useTheme';

const FONT_PRESETS = [
  { size: 14, textClass: 'text-[10px]' },
  { size: 16, textClass: 'text-[12px]' },
  { size: 18, textClass: 'text-[15px]' },
  { size: 22, textClass: 'text-[18px]' },
] as const;
import { slugify } from '../utils/slugify';
import type { Category } from '../types';
import type { GroqModel } from '../hooks/useModels';

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

const THEME_COLORS: Record<string, { bg: string; label: string }> = {
  classic: { bg: '#8B4513', label: 'Classic' },
  broadsheet: { bg: '#1A365D', label: 'Broadsheet' },
  evening: { bg: '#C9A04E', label: 'Evening' },
  morning: { bg: '#2D6A4F', label: 'Morning' },
};

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const path = location.pathname;

  const activeCategorySlug = path.startsWith('/category/') ? path.split('/category/')[1] : null;
  const activeCategoryId = activeCategorySlug
    ? categories.find(c => slugify(c.name) === activeCategorySlug)?.id ?? null
    : null;
  const isHome = path === '/';
  const showBriefing = path === '/briefing';
  const showReleases = path === '/releases';
  const showJobs = path === '/jobs';
  const showCognitive = path.startsWith('/mindgames');
  const showPrompts = path === '/prompts';

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await onAdd(newName.trim());
      setNewName('');
      setAddingDesktop(false);
      setAddingMobile(false);
    } catch {
      // keep input open on failure
    }
  };

  const selectAndClose = (id: number) => {
    const cat = categories.find(c => c.id === id);
    if (cat) navigate(`/category/${slugify(cat.name)}`);
    setDrawerOpen(false);
  };

  const briefingAndClose = () => { navigate('/briefing'); setDrawerOpen(false); };
  const releasesAndClose = () => { navigate('/releases'); setDrawerOpen(false); };
  const jobsAndClose = () => { navigate('/jobs'); setDrawerOpen(false); };
  const cognitiveAndClose = () => { navigate('/mindgames'); setDrawerOpen(false); };
  const promptsAndClose = () => { navigate('/prompts'); setDrawerOpen(false); };
  const homeAndClose = () => { navigate('/'); setDrawerOpen(false); };

  const todayShort = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const currentLabel = showJobs ? 'Jobs' : showReleases ? 'Releases' : showBriefing ? 'Briefing' : showCognitive ? 'MindGames' : showPrompts ? 'Prompts' : activeCategoryId ? (categories.find(c => c.id === activeCategoryId)?.name) : 'Home';

  return (
    <>
      <div className="hidden md:block">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between pt-4 pb-3">
            <div className="flex items-end gap-4">
              <div>
                <h1 className="font-serif text-[38px] lg:text-[42px] font-black tracking-[-0.02em] text-masthead leading-[0.9]">
                  The Daily Brief
                </h1>
                <p className="mt-1 text-[9px] font-sans uppercase tracking-[0.35em] text-masthead/40 font-medium text-center">
                  AI-Curated News Summaries
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Model</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-sans font-medium tracking-wide bg-paper-dark rounded-md text-ink hover:bg-paper cursor-pointer transition-all duration-200 min-w-[120px] justify-between"
                    >
                      <span className="truncate max-w-[140px]">
                        {modelsLoading ? 'Loading...' : selectedLlm}
                      </span>
                      <ChevronDown size={10} className="shrink-0 text-ink-muted" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto min-w-[220px]">
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
              </div>

              <div className="w-px h-8 bg-rule" />

              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Date</span>
                <span className="text-[11px] font-sans tracking-wide text-ink-light font-medium">{todayShort}</span>
              </div>

              <div className="w-px h-8 bg-rule" />

              <div className="flex flex-col items-center gap-1">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Font</span>
                <div className="flex rounded border border-rule/60 overflow-hidden">
                  {FONT_PRESETS.map(({ size, textClass }) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onFontSizeChange(size)}
                      className={`w-6 h-[22px] flex items-center justify-center font-serif transition-colors border-r border-rule/60 last:border-r-0 ${
                        articleFontSize === size
                          ? 'bg-masthead/10 text-masthead'
                          : 'bg-paper text-ink-muted hover:bg-paper-dark hover:text-ink'
                      }`}
                      aria-label={`Font size ${size}`}
                    >
                      <span className={textClass}>A</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-8 bg-rule" />

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Theme</span>
                <div className="flex items-center gap-2">
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

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onShowStats}
                    className="flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-70 transition-opacity"
                  >
                    <span className="text-[8px] font-sans uppercase tracking-[0.2em] text-ink-muted/60 font-medium">Stats</span>
                    <Brain size={16} className="text-ink-light" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>LLM Statistics</TooltipContent>
              </Tooltip>
            </div>
          </div>

        </div>

        <nav className="bg-paper border-b border-t border-rule">
          <div className="max-w-[1600px] mx-auto px-6">
            <div className="flex items-center justify-start overflow-x-auto scrollbar-none">
              <NavBox label="Home" icon={<Home size={14} />} active={isHome} onClick={() => navigate('/')} />
              <NavDivider />

              {categories.map((cat) => (
                <NavBox
                  key={cat.id}
                  label={cat.name}
                  active={cat.id === activeCategoryId}
                  onClick={() => navigate(`/category/${slugify(cat.name)}`)}
                />
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
                    className="w-28 px-2 py-0.5 text-[11px] uppercase tracking-wider font-medium border-b border-masthead bg-transparent text-ink placeholder-ink-muted focus:outline-none h-auto"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setAddingDesktop(false); setNewName(''); }} className="h-6 w-6">
                    <X size={11} />
                  </Button>
                </form>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setAddingDesktop(true)} className="h-6 w-6 text-ink-muted/50">
                      <Plus size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add section</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </nav>

        <nav className="bg-paper-dark border-b border-rule">
          <div className="max-w-[1600px] mx-auto px-6">
            <div className="flex items-center justify-start gap-1">
              <NavBox label="Briefing" icon={<Coffee size={13} />} active={showBriefing} onClick={() => navigate('/briefing')} compact />
              <NavDivider />
              <NavBox label="Releases" icon={<Film size={13} />} active={showReleases} onClick={() => navigate('/releases')} compact />
              <NavDivider />
              <NavBox label="Jobs" icon={<Briefcase size={13} />} active={showJobs} onClick={() => navigate('/jobs')} compact />
              <NavDivider />
              <NavBox label="MindGames" icon={<Shield size={13} />} active={showCognitive} onClick={() => navigate('/mindgames')} compact />
              <NavDivider />
              <NavBox label="Prompts" icon={<MessageSquareCode size={13} />} active={showPrompts} onClick={() => navigate('/prompts')} compact />
              <NavDivider />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onShowStats}
                    className="shrink-0 px-3 py-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide cursor-pointer transition-all duration-200 text-ink-muted hover:text-ink"
                  >
                    <BarChart2 size={13} />
                    Stats
                  </button>
                </TooltipTrigger>
                <TooltipContent>LLM Usage Statistics</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </nav>

      </div>

      <nav className="md:hidden border-b-2 border-ink">
        <div className="flex items-center justify-between px-4 py-2">
          <button type="button" onClick={() => setDrawerOpen(true)} className="-ml-1 p-1 cursor-pointer" aria-label="Open menu">
            <AlignJustify size={26} strokeWidth={2.2} className="text-ink" />
          </button>

          <h1 className="font-serif text-lg font-black text-masthead tracking-tight leading-none">
            The Daily Brief
          </h1>

          <span className="text-[10px] font-sans uppercase tracking-[0.15em] font-medium text-masthead truncate max-w-[30%] text-right">
            {currentLabel}
          </span>
        </div>
      </nav>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0 gap-0 flex flex-col border-r-0">
          <SheetHeader className="px-5 py-3">
            <SheetTitle className="font-serif text-base font-black text-masthead">Index</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="py-1">
              <DrawerItem label="Home" icon={<Zap size={14} />} active={isHome} onClick={homeAndClose} />
              <DrawerItem label="Morning Briefing" icon={<Coffee size={14} />} active={showBriefing} onClick={briefingAndClose} />
              <DrawerItem label="Releases" icon={<Film size={14} />} active={showReleases} onClick={releasesAndClose} />
              <DrawerItem label="Jobs" icon={<Briefcase size={14} />} active={showJobs} onClick={jobsAndClose} />
              <DrawerItem label="MindGames" icon={<Shield size={14} />} active={showCognitive} onClick={cognitiveAndClose} />
              <DrawerItem label="Prompts" icon={<MessageSquareCode size={14} />} active={showPrompts} onClick={promptsAndClose} />
            </div>

            {categories.length > 0 && (
              <div className="px-5 py-2">
                <div className="h-px bg-ink/20" />
                <p className="text-[8px] uppercase tracking-[0.3em] font-bold text-ink-muted mt-2 mb-1 font-serif">Sections</p>
              </div>
            )}

            <div className="pb-2">
              {categories.map((cat) => {
                const active = cat.id === activeCategoryId;
                return (
                  <div key={cat.id} className="group">
                    <button
                      onClick={() => selectAndClose(cat.id)}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors duration-200 ${
                        active ? 'bg-masthead text-white' : 'text-ink hover:bg-paper-dark'
                      }`}
                    >
                      <span className={`text-[12px] uppercase font-semibold font-serif ${active ? 'text-white' : 'text-ink'}`}>{cat.name}</span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        {cat.feed_count > 0 && (
                          <span className={`text-[9px] px-1.5 py-0.5 ${active ? 'text-white/60' : 'text-ink-muted bg-paper-dark'}`}>
                            {cat.feed_count}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="px-5 mt-1 pb-4">
              {addingMobile ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
                  className="flex items-center gap-2"
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
                    className="flex-1 px-3 py-2 text-[12px] uppercase tracking-wider font-medium border-b border-ink bg-transparent text-ink placeholder-ink-muted focus:outline-none h-auto"
                  />
                  <Button type="submit" variant="ghost" size="icon" disabled={!newName.trim()} className="h-7 w-7 text-ink" aria-label="Save section">
                    <Check size={14} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setAddingMobile(false); setNewName(''); }} className="h-7 w-7" aria-label="Cancel">
                    <X size={14} />
                  </Button>
                </form>
              ) : (
                <Button variant="outline" onClick={() => setAddingMobile(true)} className="w-full border-dashed border-ink/20 hover:border-ink/50 gap-1.5 py-2 text-[10px] uppercase tracking-[0.2em] font-semibold">
                  <Plus size={11} /> Add Section
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-rule px-5 py-4 bg-paper-dark space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Model</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-sans font-medium bg-paper rounded-md text-ink cursor-pointer transition-all duration-200 min-w-[120px] justify-between"
                  >
                    <span className="truncate max-w-[140px]">
                      {modelsLoading ? 'Loading...' : selectedLlm}
                    </span>
                    <ChevronDown size={10} className="shrink-0 text-ink-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto min-w-[200px]">
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
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Theme</p>
              <div className="flex items-center gap-2.5">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onThemeChange(t)}
                    className={`w-5 h-5 rounded-full cursor-pointer transition-all duration-200 border p-0 ${
                      theme === t ? 'border-ink scale-110' : 'border-transparent opacity-50'
                    }`}
                    style={{ backgroundColor: THEME_COLORS[t].bg }}
                    aria-label={THEME_COLORS[t].label}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Font</p>
              <div className="flex rounded border border-rule/60 overflow-hidden">
                {FONT_PRESETS.map(({ size, textClass }) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onFontSizeChange(size)}
                    className={`w-9 h-8 flex items-center justify-center font-serif transition-colors border-r border-rule/60 last:border-r-0 ${
                      articleFontSize === size
                        ? 'bg-masthead/10 text-masthead'
                        : 'bg-paper text-ink-muted hover:bg-paper-dark hover:text-ink'
                    }`}
                    aria-label={`Font size ${size}`}
                  >
                    <span className={textClass}>A</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 pb-6">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Stats</p>
              <button
                type="button"
                onClick={() => { onShowStats(); setDrawerOpen(false); }}
                className="flex items-center gap-2 text-[13px] font-medium text-ink-light hover:text-masthead transition-colors"
              >
                <Brain size={18} />
                <span>LLM Usage</span>
              </button>
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

function NavBox({ label, icon, active, onClick, compact }: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 cursor-pointer transition-all duration-200 ${
        compact ? 'px-3 py-2 text-[11px] font-medium' : 'px-4 py-2.5 text-[13px] tracking-wide font-medium'
      } ${
        active
          ? 'bg-masthead text-white font-semibold'
          : 'text-ink-muted hover:bg-paper-dark hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function NavDivider() {
  return <div className="w-px h-4 bg-rule shrink-0 mx-0.5" />;
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
      <span className="text-[12px] uppercase font-semibold font-serif">{label}</span>
    </button>
  );
}
