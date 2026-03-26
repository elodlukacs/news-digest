import { formatDate } from '../utils/date';
import type { HistoryEntry } from '../types';

interface Props {
  dates: HistoryEntry[];
  selectedSnapshotId: number | null;
  onSelectSnapshot: (id: number | null) => void;
}

export function HistorySidebar({ dates, selectedSnapshotId, onSelectSnapshot }: Props) {
  if (dates.length === 0) return null;

  return (
    <aside className="w-44 shrink-0 hidden lg:block pt-8">
      <div className="sticky top-8">
        <div className="border-b-2 border-ink pb-1.5 mb-4">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-ink">Archive</h3>
        </div>
        <div className="space-y-0.5">
          <button
            onClick={() => onSelectSnapshot(null)}
            className={`w-full flex items-center px-3 py-2 text-[13px] font-serif cursor-pointer transition-colors ${
              selectedSnapshotId === null ? 'text-masthead font-bold' : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
            }`}
          >
            Latest
          </button>
          {dates.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelectSnapshot(entry.id)}
              className={`w-full flex items-center px-3 py-2 text-[13px] font-serif cursor-pointer transition-colors ${
                selectedSnapshotId === entry.id ? 'text-masthead font-bold' : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
              }`}
            >
              {formatDate(entry.date_key)}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
