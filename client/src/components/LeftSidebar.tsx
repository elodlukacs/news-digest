import { ExternalLink } from 'lucide-react';
import { formatDate } from '../utils/date';
import { WidgetHeader } from './SharedWidgets';
import type { HackerNewsItem, HistoryEntry } from '../types';

interface Props {
  hackerNews: HackerNewsItem[];
  dates: HistoryEntry[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  showHistory: boolean;
}

export function LeftSidebar({ hackerNews, dates, selectedDate, onSelectDate, showHistory }: Props) {
  return (
    <aside className="w-60 shrink-0 hidden lg:block pt-8 font-widget">
      <div className="sticky top-8 space-y-8">
        {/* Archive / History */}
        {showHistory && dates.length > 0 && (
          <section>
            <WidgetHeader title="Archive" />
            <div className="pt-4 space-y-0.5">
              <button
                onClick={() => onSelectDate(null)}
                className={`w-full text-left px-3 py-2 text-[13px] cursor-pointer transition-colors
                  ${selectedDate === null ? 'text-masthead font-bold bg-masthead/5' : 'text-ink-muted hover:text-ink'}`}
              >
                Latest
              </button>
              {dates.map((entry) => (
                <button
                  key={entry.date_key}
                  onClick={() => onSelectDate(entry.date_key)}
                  className={`w-full text-left px-3 py-2 text-[13px] cursor-pointer transition-colors
                    ${selectedDate === entry.date_key ? 'text-masthead font-bold bg-masthead/5' : 'text-ink-muted hover:text-ink'}`}
                >
                  {formatDate(entry.date_key)}
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
