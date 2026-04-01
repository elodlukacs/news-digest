import { X, Brain, Search } from 'lucide-react';
import { ForensicPanel } from '../features/mindgames/analysis';
import type { ParsedSection } from './SummaryView';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: ParsedSection[];
  categoryName: string;
}

export function MindToolsRibbon({ open, onOpenChange, sections, categoryName }: Props) {
  return (
    <>
      {/* Desktop: vertical ribbon on right edge */}
      <button
        onClick={() => onOpenChange(true)}
        className={`hidden md:block fixed right-0 top-1/2 -translate-y-1/2 z-40
          bg-masthead text-paper cursor-pointer
          hover:bg-ink transition-all duration-300
          shadow-[-2px_0_8px_rgba(0,0,0,0.1)]
          ${open ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{ writingMode: 'vertical-rl' }}
      >
        <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-4">
          <Search size={14} className="rotate-180" />
          Mind Tools
          <Brain size={14} className="rotate-180" />
        </span>
      </button>
      {/* Mobile: floating button at bottom-right */}
      <button
        onClick={() => onOpenChange(true)}
        className={`md:hidden fixed bottom-4 right-4 z-40
          bg-masthead text-paper cursor-pointer
          hover:bg-ink transition-all duration-300
          shadow-lg rounded-full w-12 h-12 flex items-center justify-center
          ${open ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 scale-100'}`}
      >
        <Brain size={20} />
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-300
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => onOpenChange(false)}
      />

      <div
        className={`fixed z-50 bg-paper shadow-2xl border-rule flex flex-col
          inset-x-0 bottom-0 h-[50dvh] rounded-t-2xl border-t
          md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:h-full
          md:w-[min(720px,90vw)] md:rounded-none md:border-t-0
          transition-transform duration-300 ease-out
          ${open ? 'translate-y-0 md:translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-rule" />
        </div>
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

        <div className="flex-1 min-h-0 overflow-y-auto px-0 md:px-6 py-6">
          <ForensicPanel sections={sections} categoryName={categoryName} />
        </div>
      </div>
    </>
  );
}
