import { useState, useRef } from 'react';
import { Plus, X, Settings, Trash2, Coffee } from 'lucide-react';
import type { Category } from '../types';

interface Props {
  categories: Category[];
  activeId: number | null;
  showBriefing: boolean;
  onSelect: (id: number) => void;
  onBriefing: () => void;
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onManageFeeds: (id: number) => void;
}

export function CategoryNav({
  categories,
  activeId,
  showBriefing,
  onSelect,
  onBriefing,
  onAdd,
  onDelete,
  onManageFeeds,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [contextId, setContextId] = useState<number | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const navRef = useRef<HTMLDivElement>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAdd(newName.trim());
    setNewName('');
    setAdding(false);
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

  return (
    <nav className="bg-paper-dark border-y border-rule relative" ref={navRef}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-center gap-1 py-3 flex-wrap">
          {/* Morning Briefing */}
          <button
            onClick={onBriefing}
            className={`group relative px-3 py-2 font-serif text-xl cursor-pointer flex items-center gap-2 transition-colors duration-300
              ${showBriefing
                ? 'text-masthead font-black'
                : 'text-ink-muted font-bold hover:text-ink'}`}
          >
            <Coffee size={18} />
            Briefing
            <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-masthead transition-all duration-300 ease-out
              ${showBriefing ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-60 group-hover:scale-x-100'}`}
              style={{ transformOrigin: 'center' }}
            />
          </button>

          {categories.length > 0 && <div className="w-px h-5 bg-rule mx-3" />}

          {categories.map((cat, i) => {
            const active = cat.id === activeId;
            return (
              <div key={cat.id} className="flex items-center">
                {i > 0 && <div className="w-px h-5 bg-rule mx-3" />}
                <button
                  onClick={() => {
                    onSelect(cat.id);
                    closeContext();
                  }}
                  onContextMenu={(e) => handleContextMenu(e, cat.id)}
                  className={`group relative px-3 py-2 font-serif text-xl cursor-pointer transition-colors duration-300
                    ${active ? 'text-masthead font-black' : 'text-ink-muted font-bold hover:text-ink'}`}
                >
                  {cat.name}
                  <span className={`absolute bottom-0 left-3 right-3 h-[2px] bg-masthead transition-all duration-300 ease-out
                    ${active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-60 group-hover:scale-x-100'}`}
                    style={{ transformOrigin: 'center' }}
                  />
                </button>
              </div>
            );
          })}

          {categories.length > 0 && <div className="w-px h-5 bg-rule mx-3" />}

          {adding ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') {
                    setAdding(false);
                    setNewName('');
                  }
                }}
                placeholder="New category..."
                className="w-36 px-3 py-1 text-sm font-serif border-b-2 border-masthead bg-transparent text-ink placeholder-ink-muted focus:outline-none"
              />
              <button
                onClick={() => {
                  setAdding(false);
                  setNewName('');
                }}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="p-2 text-ink-muted hover:text-masthead cursor-pointer transition-colors"
              title="Add category"
            >
              <Plus size={15} />
            </button>
          )}
        </div>
      </div>

      {contextId && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContext} />
          <div
            className="absolute z-50 bg-paper border border-rule shadow-lg py-1 min-w-[160px]"
            style={{ left: contextPos.x, top: contextPos.y }}
          >
            <button
              onClick={() => {
                onManageFeeds(contextId);
                closeContext();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-serif text-ink hover:bg-paper-dark hover:text-masthead cursor-pointer transition-colors duration-200"
            >
              <Settings size={13} className="text-ink-muted" />
              Manage Sources
            </button>
            <div className="h-px bg-rule mx-3 my-0.5" />
            <button
              onClick={() => {
                onDelete(contextId);
                closeContext();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-serif text-accent hover:bg-red-50 cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              Delete Category
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
