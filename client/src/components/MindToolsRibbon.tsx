import { X, Brain, Search } from 'lucide-react';
import { ForensicPanel } from '../features/mindgames/analysis';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MindToolsRibbon({ open, onOpenChange }: Props) {
  return (
    <>
      {!open && (
        <button
          onClick={() => onOpenChange(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40
            bg-masthead text-paper cursor-pointer
            hover:bg-ink transition-colors duration-200
            shadow-[-2px_0_8px_rgba(0,0,0,0.1)]"
          style={{ writingMode: 'vertical-rl' }}
        >
          <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-4">
            <Search size={14} className="rotate-180" />
            Mind Tools
            <Brain size={14} className="rotate-180" />
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onClick={() => onOpenChange(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 z-50 h-full w-[min(720px,90vw)] bg-paper shadow-2xl
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-rule shrink-0">
            <div className="flex items-center gap-2.5">
              <Brain size={18} className="text-masthead" />
              <h2 className="font-serif text-xl font-bold text-ink tracking-tight">Mind Tools</h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-md text-ink-muted hover:text-ink hover:bg-paper-dark transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <ForensicPanel />
          </div>
        </div>
      </div>
    </>
  );
}
