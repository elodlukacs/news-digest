import { useState } from 'react';
import { Plus, X, Settings, Trash2, Coffee, Menu, Home, ChevronRight, Film } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      <nav className="hidden md:block bg-secondary border-y border-border">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center gap-1 py-2.5 overflow-x-auto scrollbar-none">
            {/* Home */}
            <Button
              variant="ghost"
              onClick={onHome}
              className={`group relative shrink-0 px-3 py-2 font-serif text-[15px] cursor-pointer flex items-center gap-1.5 transition-colors duration-200 h-auto ${
                isHome ? 'text-ring font-bold' : 'text-muted-foreground font-semibold hover:text-foreground'
              }`}
            >
              <Home size={14} />
              Home
              <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-ring transition-all duration-300 ease-out
                ${isHome ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-100'}`}
                style={{ transformOrigin: 'center' }}
              />
            </Button>

            <div className="w-px h-4 bg-border mx-1 shrink-0" />

            {/* Morning Briefing */}
            <Button
              variant="ghost"
              onClick={onBriefing}
              className={`group relative shrink-0 px-3 py-2 font-serif text-[15px] cursor-pointer flex items-center gap-1.5 transition-colors duration-200 h-auto ${
                showBriefing ? 'text-ring font-bold' : 'text-muted-foreground font-semibold hover:text-foreground'
              }`}
            >
              <Coffee size={14} />
              Briefing
              <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-ring transition-all duration-300 ease-out
                ${showBriefing ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-100'}`}
                style={{ transformOrigin: 'center' }}
              />
            </Button>

            <div className="w-px h-4 bg-border mx-1 shrink-0" />

            {/* Releases */}
            <Button
              variant="ghost"
              onClick={onReleases}
              className={`group relative shrink-0 px-3 py-2 font-serif text-[15px] cursor-pointer flex items-center gap-1.5 transition-colors duration-200 h-auto ${
                showReleases ? 'text-ring font-bold' : 'text-muted-foreground font-semibold hover:text-foreground'
              }`}
            >
              <Film size={14} />
              Releases
              <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-ring transition-all duration-300 ease-out
                ${showReleases ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-100'}`}
                style={{ transformOrigin: 'center' }}
              />
            </Button>

            {categories.length > 0 && <div className="w-px h-4 bg-border mx-1 shrink-0" />}

            {categories.map((cat, i) => {
              const active = cat.id === activeId;
              return (
                <div key={cat.id} className="flex items-center shrink-0">
                  {i > 0 && <div className="w-px h-4 bg-border mx-1" />}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div>
                        <Button
                          variant="ghost"
                          onClick={() => { onSelect(cat.id); }}
                          className={`group relative px-3 py-2 font-serif text-[15px] cursor-pointer transition-colors duration-200 h-auto ${
                            active ? 'text-ring font-bold' : 'text-muted-foreground font-semibold hover:text-foreground'
                          }`}
                        >
                          {cat.name}
                          <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-ring transition-all duration-300 ease-out
                            ${active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-100'}`}
                            style={{ transformOrigin: 'center' }}
                          />
                        </Button>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => { onManageFeeds(cat.id); }}>
                        <Settings size={13} className="text-muted-foreground" />
                        Manage Sources
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { onDelete(cat.id); }} className="text-destructive hover:text-destructive focus:text-destructive">
                        <Trash2 size={13} />
                        Delete Category
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}

            <div className="w-px h-4 bg-border mx-1 shrink-0" />

            {adding ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  placeholder="New category..."
                  className="w-36 font-serif border-b-2 border-ring bg-transparent"
                />
                <Button variant="ghost" size="icon" onClick={() => { setAdding(false); setNewName(''); }} className="h-7 w-7">
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setAdding(true)} title="Add category" className="h-7 w-7 text-muted-foreground hover:text-ring">
                <Plus size={14} />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Mobile Nav Bar ─── */}
      <nav className="md:hidden bg-secondary border-y border-border">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Button variant="ghost" onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 -ml-2" aria-label="Open menu">
            <Menu size={20} />
            <span className="text-[13px] font-serif font-bold uppercase tracking-wider">Sections</span>
          </Button>

          <span className="text-[13px] font-serif font-bold text-ring truncate max-w-[50%] text-right">
            {showReleases ? 'Releases' : showBriefing ? 'Briefing' : activeId ? categories.find(c => c.id === activeId)?.name : 'Home'}
          </span>
        </div>
      </nav>

      {/* ─── Mobile Drawer (ShadCN Sheet) ─── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[300px] max-w-[85vw] p-0 gap-0 flex flex-col">
          <SheetHeader className="px-5 py-4 border-b border-border bg-secondary">
            <SheetTitle className="font-serif text-lg font-black text-ring tracking-tight">The Daily Brief</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {/* Home */}
            <Button
              variant="ghost"
              onClick={homeAndClose}
              className={`w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer transition-colors duration-200 justify-start ${
                isHome
                  ? 'bg-ring/8 text-ring font-bold border-l-3 border-ring'
                  : 'hover:bg-secondary'
              }`}
            >
              <Home size={16} className={isHome ? 'text-ring' : 'text-muted-foreground'} />
              <span className="font-serif text-[16px]">Home</span>
            </Button>

            {/* Briefing */}
            <Button
              variant="ghost"
              onClick={briefingAndClose}
              className={`w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer transition-colors duration-200 justify-start ${
                showBriefing
                  ? 'bg-ring/8 text-ring font-bold border-l-3 border-ring'
                  : 'hover:bg-secondary'
              }`}
            >
              <Coffee size={16} className={showBriefing ? 'text-ring' : 'text-muted-foreground'} />
              <span className="font-serif text-[16px]">Morning Briefing</span>
            </Button>

            {/* Releases */}
            <Button
              variant="ghost"
              onClick={releasesAndClose}
              className={`w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer transition-colors duration-200 justify-start ${
                showReleases
                  ? 'bg-ring/8 text-ring font-bold border-l-3 border-ring'
                  : 'hover:bg-secondary'
              }`}
            >
              <Film size={16} className={showReleases ? 'text-ring' : 'text-muted-foreground'} />
              <span className="font-serif text-[16px]">Releases</span>
            </Button>

            {/* Divider */}
            {categories.length > 0 && (
              <div className="mx-5 my-2">
                <div className="h-px bg-border" />
                <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted-foreground mt-3 mb-1 px-0.5">Categories</p>
              </div>
            )}

            {/* Categories */}
            {categories.map((cat) => {
              const active = cat.id === activeId;
              return (
                <div key={cat.id} className="group relative">
                  <Button
                    variant="ghost"
                    onClick={() => selectAndClose(cat.id)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 text-left cursor-pointer transition-colors duration-200 justify-start ${
                      active
                        ? 'bg-ring/8 text-ring font-bold border-l-3 border-ring'
                        : 'hover:bg-secondary'
                    }`}
                  >
                    <span className="font-serif text-[16px]">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      {cat.feed_count > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-sm">
                          {cat.feed_count}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-muted-foreground/40" />
                    </div>
                  </Button>

                  {active && (
                    <div className="flex items-center gap-1 px-5 pb-2 -mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onManageFeeds(cat.id); setDrawerOpen(false); }}
                        className="gap-1.5 text-[11px]"
                      >
                        <Settings size={11} />
                        Sources
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onDelete(cat.id); setDrawerOpen(false); }}
                        className="gap-1.5 text-[11px] text-destructive/70 hover:text-destructive"
                      >
                        <Trash2 size={11} />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add category */}
            <div className="px-5 mt-3">
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
                    placeholder="Category name..."
                    className="flex-1 font-serif"
                  />
                  <Button variant="ghost" size="icon" onClick={() => { setAdding(false); setNewName(''); }} className="h-7 w-7">
                    <X size={16} />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setAdding(true)} className="w-full border-dashed gap-2 py-3">
                  <Plus size={15} />
                  <span className="text-[13px] font-serif font-medium">Add Category</span>
                </Button>
              )}
            </div>
          </div>

          {/* Drawer footer */}
          <div className="border-t border-border px-5 py-4 bg-secondary">
            <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2">
              Right-click a category on desktop for more options
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
