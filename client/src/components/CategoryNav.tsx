import { useState, useRef, useEffect } from 'react';
import { Plus, X, Settings, Trash2, Coffee, Menu, Home, ChevronRight, Film } from 'lucide-react';
import type { Category } from '../types';

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
}

export function CategoryNav({
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
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [contextId, setContextId] = useState<number | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close drawer on escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Lock body scroll when drawer open
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

  const briefingAndClose = () => {
    onBriefing();
    setDrawerOpen(false);
  };

  const releasesAndClose = () => {
    onReleases();
    setDrawerOpen(false);
  };

  const homeAndClose = () => {
    onHome();
    setDrawerOpen(false);
  };

  const isHome = !activeId && !showBriefing && !showReleases;

  return (
    <>
      {/* ─── Desktop Nav ─── */}
      <nav className="hidden md:block bg-paper-dark border-y border-rule relative" ref={navRef}>
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center gap-1 py-2.5 overflow-x-auto scrollbar-none">
            {/* Home */}
            <button
              onClick={onHome}
              className={`group relative shrink-0 px-3 py-2 font-serif text-[15px] cursor-pointer flex items-center gap-1.5 transition-colors duration-200
                ${isHome ? 'text-masthead font-bold' : 'text-ink-muted font-semibold hover:text-ink'}`}
            >
              <Home size={14} />
              Home
              <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-masthead transition-all duration-300 ease-out
                ${isHome ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-100'}`}
                style={{ transformOrigin: 'center' }}
              />
            </button>

            <div className="w-px h-4 bg-rule mx-1 shrink-0" />

            {/* Morning Briefing */}
            <button
              onClick={onBriefing}
              className={`group relative shrink-0 px-3 py-2 font-serif text-[15px] cursor-pointer flex items-center gap-1.5 transition-colors duration-200
                ${showBriefing ? 'text-masthead font-bold' : 'text-ink-muted font-semibold hover:text-ink'}`}
            >
              <Coffee size={14} />
              Briefing
              <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-masthead transition-all duration-300 ease-out
                ${showBriefing ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-100'}`}
                style={{ transformOrigin: 'center' }}
              />
            </button>

            <div className="w-px h-4 bg-rule mx-1 shrink-0" />

            {/* Releases */}
            <button
              onClick={onReleases}
              className={`group relative shrink-0 px-3 py-2 font-serif text-[15px] cursor-pointer flex items-center gap-1.5 transition-colors duration-200
                ${showReleases ? 'text-masthead font-bold' : 'text-ink-muted font-semibold hover:text-ink'}`}
            >
              <Film size={14} />
              Releases
              <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-masthead transition-all duration-300 ease-out
                ${showReleases ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-100'}`}
                style={{ transformOrigin: 'center' }}
              />
            </button>

            {categories.length > 0 && <div className="w-px h-4 bg-rule mx-1 shrink-0" />}

            {categories.map((cat, i) => {
              const active = cat.id === activeId;
              return (
                <div key={cat.id} className="flex items-center shrink-0">
                  {i > 0 && <div className="w-px h-4 bg-rule mx-1" />}
                  <button
                    onClick={() => { onSelect(cat.id); closeContext(); }}
                    onContextMenu={(e) => handleContextMenu(e, cat.id)}
                    className={`group relative px-3 py-2 font-serif text-[15px] cursor-pointer transition-colors duration-200
                      ${active ? 'text-masthead font-bold' : 'text-ink-muted font-semibold hover:text-ink'}`}
                  >
                    {cat.name}
                    <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-masthead transition-all duration-300 ease-out
                      ${active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-100'}`}
                      style={{ transformOrigin: 'center' }}
                    />
                  </button>
                </div>
              );
            })}

            <div className="w-px h-4 bg-rule mx-1 shrink-0" />

            {adding ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  placeholder="New category..."
                  className="w-36 px-3 py-1 text-sm font-serif border-b-2 border-masthead bg-transparent text-ink placeholder-ink-muted focus:outline-none"
                />
                <button
                  onClick={() => { setAdding(false); setNewName(''); }}
                  className="p-1 text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="p-2 text-ink-muted hover:text-masthead cursor-pointer transition-colors shrink-0"
                title="Add category"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Desktop context menu */}
        {contextId && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeContext} />
            <div
              className="absolute z-50 bg-paper border border-rule shadow-lg py-1 min-w-[160px]"
              style={{ left: contextPos.x, top: contextPos.y }}
            >
              <button
                onClick={() => { onManageFeeds(contextId); closeContext(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-serif text-ink hover:bg-paper-dark hover:text-masthead cursor-pointer transition-colors duration-200"
              >
                <Settings size={13} className="text-ink-muted" />
                Manage Sources
              </button>
              <div className="h-px bg-rule mx-3 my-0.5" />
              <button
                onClick={() => { onDelete(contextId); closeContext(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-serif text-accent hover:bg-red-50 cursor-pointer transition-colors"
              >
                <Trash2 size={13} />
                Delete Category
              </button>
            </div>
          </>
        )}
      </nav>

      {/* ─── Mobile Nav Bar ─── */}
      <nav className="md:hidden bg-paper-dark border-y border-rule">
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 p-2 -ml-2 text-ink cursor-pointer"
            aria-label="Open menu"
          >
            <Menu size={20} />
            <span className="text-[13px] font-serif font-bold text-ink uppercase tracking-wider">Sections</span>
          </button>

          {/* Current section label */}
          <span className="text-[13px] font-serif font-bold text-masthead truncate max-w-[50%] text-right">
            {showReleases ? 'Releases' : showBriefing ? 'Briefing' : activeId ? categories.find(c => c.id === activeId)?.name : 'Home'}
          </span>
        </div>
      </nav>

      {/* ─── Mobile Slide-in Drawer ─── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] bg-paper shadow-2xl transition-transform duration-300 ease-out md:hidden flex flex-col ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule bg-paper-dark">
          <h2 className="font-serif text-lg font-black text-masthead tracking-tight">The Daily Brief</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 -mr-2 text-ink-muted hover:text-ink cursor-pointer transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Home */}
          <button
            onClick={homeAndClose}
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer transition-colors duration-200 ${
              isHome
                ? 'bg-masthead/8 text-masthead font-bold border-l-3 border-masthead'
                : 'text-ink hover:bg-paper-dark'
            }`}
          >
            <Home size={16} className={isHome ? 'text-masthead' : 'text-ink-muted'} />
            <span className="font-serif text-[16px]">Home</span>
          </button>

          {/* Briefing */}
          <button
            onClick={briefingAndClose}
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer transition-colors duration-200 ${
              showBriefing
                ? 'bg-masthead/8 text-masthead font-bold border-l-3 border-masthead'
                : 'text-ink hover:bg-paper-dark'
            }`}
          >
            <Coffee size={16} className={showBriefing ? 'text-masthead' : 'text-ink-muted'} />
            <span className="font-serif text-[16px]">Morning Briefing</span>
          </button>

          {/* Releases */}
          <button
            onClick={releasesAndClose}
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer transition-colors duration-200 ${
              showReleases
                ? 'bg-masthead/8 text-masthead font-bold border-l-3 border-masthead'
                : 'text-ink hover:bg-paper-dark'
            }`}
          >
            <Film size={16} className={showReleases ? 'text-masthead' : 'text-ink-muted'} />
            <span className="font-serif text-[16px]">Releases</span>
          </button>

          {/* Divider */}
          {categories.length > 0 && (
            <div className="mx-5 my-2">
              <div className="h-px bg-rule" />
              <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-ink-muted mt-3 mb-1 px-0.5">Categories</p>
            </div>
          )}

          {/* Categories */}
          {categories.map((cat) => {
            const active = cat.id === activeId;
            return (
              <div key={cat.id} className="group relative">
                <button
                  onClick={() => selectAndClose(cat.id)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 text-left cursor-pointer transition-colors duration-200 ${
                    active
                      ? 'bg-masthead/8 text-masthead font-bold border-l-3 border-masthead'
                      : 'text-ink hover:bg-paper-dark'
                  }`}
                >
                  <span className="font-serif text-[16px]">{cat.name}</span>
                  <div className="flex items-center gap-1">
                    {cat.feed_count > 0 && (
                      <span className="text-[10px] text-ink-muted bg-paper-dark px-1.5 py-0.5 rounded-sm">
                        {cat.feed_count}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-ink-muted/40" />
                  </div>
                </button>

                {/* Inline actions (visible on active or long-press alternative) */}
                {active && (
                  <div className="flex items-center gap-1 px-5 pb-2 -mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onManageFeeds(cat.id); setDrawerOpen(false); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted hover:text-masthead cursor-pointer transition-colors"
                    >
                      <Settings size={11} />
                      Sources
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(cat.id); setDrawerOpen(false); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-accent/70 hover:text-accent cursor-pointer transition-colors"
                    >
                      <Trash2 size={11} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add category */}
          <div className="px-5 mt-3">
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
                  placeholder="Category name..."
                  className="flex-1 px-3 py-2.5 text-[15px] font-serif border border-rule bg-paper-dark text-ink placeholder-ink-muted focus:outline-none focus:border-masthead transition-colors"
                />
                <button
                  onClick={() => { setAdding(false); setNewName(''); }}
                  className="p-2 text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 px-3 py-3 text-ink-muted hover:text-masthead cursor-pointer transition-colors border border-dashed border-rule hover:border-masthead"
              >
                <Plus size={15} />
                <span className="text-[13px] font-serif font-medium">Add Category</span>
              </button>
            )}
          </div>
        </div>

        {/* Drawer footer */}
        <div className="border-t border-rule px-5 py-4 bg-paper-dark">
          <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-ink-muted mb-2">
            Right-click a category on desktop for more options
          </p>
        </div>
      </div>
    </>
  );
}
