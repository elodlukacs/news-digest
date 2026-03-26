import { formatDate } from '../utils/date';
import type { HistoryEntry } from '../types';

interface Props {
  dates: HistoryEntry[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function HistorySidebar({ dates, selectedDate, onSelectDate }: Props) {
  if (dates.length === 0) return null;

  return (
    <aside className="w-44 shrink-0 hidden lg:block pt-8">
      <div className="sticky top-8">
        <div className="border-b-2 border-ink pb-1.5 mb-4">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-ink">Archive</h3>
        </div>
        <div className="space-y-0.5">
          <button
            onClick={() => onSelectDate(null)}
            className={`w-full text-left px-3 py-2 text-[13px] font-serif cursor-pointer transition-colors
              ${selectedDate === null ? 'text-masthead font-bold bg-masthead/5' : 'text-ink-muted hover:text-ink'}`}
          >
            Latest
          </button>
          {dates.map((entry) => (
            <button
              key={entry.date_key}
              onClick={() => onSelectDate(entry.date_key)}
              className={`w-full text-left px-3 py-2 text-[13px] font-serif cursor-pointer transition-colors
                ${selectedDate === entry.date_key ? 'text-masthead font-bold bg-masthead/5' : 'text-ink-muted hover:text-ink'}`}
            >
              {formatDate(entry.date_key)}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
