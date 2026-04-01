import { formatDate } from '../utils/date';
import { WidgetHeader } from './SharedWidgets';
import type { HistoryEntry } from '../types';

interface Props {
  hackerNews?: unknown[];
  dates: HistoryEntry[];
  selectedSnapshotId: number | null;
  onSelectSnapshot: (id: number | null) => void;
  showHistory: boolean;
}

export function LeftSidebar({ dates, selectedSnapshotId, onSelectSnapshot, showHistory }: Props) {
  return (
    <aside className="w-44 shrink-0 hidden lg:block pt-8 font-widget">
      <div className="sticky top-8 space-y-8">
        {showHistory && dates.length > 0 && (
          <section>
            <WidgetHeader title="Archive" />
            <div className="pt-4 space-y-0.5">
              <button
                onClick={() => onSelectSnapshot(null)}
                className={`w-full flex items-center px-3 py-2 cursor-pointer transition-colors ${
                  selectedSnapshotId === null ? 'text-masthead font-bold' : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
                }`}
              >
                Latest
              </button>
              {dates.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onSelectSnapshot(entry.id)}
                  className={`w-full flex items-center px-3 py-2 cursor-pointer transition-colors ${
                    selectedSnapshotId === entry.id ? 'text-masthead font-bold' : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
                  }`}
                >
                  <span className="text-[13px]">{formatDate(entry.date_key)}</span>
                  {entry.generated_at && (
                    <span className="text-[10px] ml-1.5 opacity-60">
                      {new Date(entry.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
