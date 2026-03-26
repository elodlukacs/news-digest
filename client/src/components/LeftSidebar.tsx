import { ExternalLink } from 'lucide-react';
import { formatDate } from '../utils/date';
import { WidgetHeader } from './SharedWidgets';
import type { HackerNewsItem, HistoryEntry } from '../types';

interface Props {
  hackerNews: HackerNewsItem[];
  dates: HistoryEntry[];
  selectedSnapshotId: number | null;
  onSelectSnapshot: (id: number | null) => void;
  showHistory: boolean;
}

export function LeftSidebar({ hackerNews, dates, selectedSnapshotId, onSelectSnapshot, showHistory }: Props) {
  return (
    <aside className="w-60 shrink-0 hidden lg:block pt-8 font-widget">
      <div className="sticky top-8 space-y-8">
        {/* Archive / History */}
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

        {/* Hacker News */}
        {hackerNews.length > 0 && (
          <section>
            <WidgetHeader title="Hacker News" />
            <div className="pt-4 space-y-3">
              {hackerNews.slice(0, 8).map((item, i) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group cursor-pointer"
                >
                  <p className="text-[13px] leading-snug text-ink group-hover:text-ink-muted transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-ink-muted mt-0.5 flex items-center gap-1">
                    {item.score} points
                    <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  {i < Math.min(hackerNews.length, 8) - 1 && <div className="mt-3" />}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
