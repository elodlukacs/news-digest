import { useState } from 'react';
import { ExternalLink, Film, Tv, X, Star, Clock, Play, Users } from 'lucide-react';
import type { HackerNewsItem, HistoryEntry, UpcomingRelease } from '../types';

interface ReleaseDetail {
  id: number;
  title: string;
  tagline: string | null;
  overview: string;
  date: string;
  type: string;
  rating: number | null;
  votes: number;
  runtime: number | null;
  genres: string[];
  cast: string[];
  directors: string[];
  poster: string | null;
  backdrop: string | null;
  trailer: string | null;
  seasons: number | null;
  episodes: number | null;
  status: string | null;
}

interface Props {
  hackerNews: HackerNewsItem[];
  releases: UpcomingRelease[];
  dates: HistoryEntry[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  showHistory: boolean;
}

function WidgetHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-rule bg-masthead/5 -mx-3 px-3 py-2 mb-1 flex items-center gap-2">
      <span className="w-1 h-3.5 bg-masthead rounded-full" />
      <h3 className="text-[12px] uppercase tracking-[0.15em] font-bold text-ink">{title}</h3>
    </div>
  );
}

function formatDate(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateKey === today.toISOString().split('T')[0]) return 'Today';
  if (dateKey === yesterday.toISOString().split('T')[0]) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatReleaseDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function ReleaseModal({ detail, onClose }: { detail: ReleaseDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-paper border border-rule shadow-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Backdrop */}
        {detail.backdrop && (
          <div className="relative h-44 overflow-hidden">
            <img src={detail.backdrop} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/40 to-transparent" />
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-paper/80 text-ink hover:text-ink cursor-pointer transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        <div className={`px-6 ${detail.backdrop ? '-mt-16 relative' : 'pt-5'}`}>
          {/* Header */}
          <div className="flex gap-4">
            {detail.poster && (
              <img src={detail.poster} alt={detail.title} className="w-24 h-36 object-cover shrink-0 border border-rule shadow-md" />
            )}
            <div className="pt-2">
              {!detail.backdrop && (
                <button onClick={onClose} className="absolute top-4 right-4 p-1 text-ink-muted hover:text-ink cursor-pointer transition-colors">
                  <X size={16} />
                </button>
              )}
              <div className="flex items-center gap-2 mb-1">
                {detail.type === 'movie' ? <Film size={12} className="text-masthead" /> : <Tv size={12} className="text-masthead" />}
                <span className="text-[10px] uppercase tracking-wider text-ink-muted font-medium">
                  {detail.type === 'movie' ? 'Movie' : 'TV Series'}
                </span>
              </div>
              <h3 className="font-serif text-xl font-bold text-ink leading-tight">{detail.title}</h3>
              {detail.tagline && (
                <p className="text-[12px] italic text-ink-muted mt-1">{detail.tagline}</p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {detail.rating !== null && detail.rating > 0 && (
                  <span className="flex items-center gap-1 text-[12px] font-medium text-masthead">
                    <Star size={11} /> {detail.rating.toFixed(1)}
                    <span className="text-ink-muted font-normal">({detail.votes.toLocaleString()})</span>
                  </span>
                )}
                {detail.runtime && (
                  <span className="flex items-center gap-1 text-[12px] text-ink-muted">
                    <Clock size={11} /> {detail.runtime} min
                  </span>
                )}
                <span className="text-[12px] text-ink-muted">{formatReleaseDate(detail.date)}</span>
              </div>
            </div>
          </div>

          {/* Genres */}
          {detail.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {detail.genres.map(g => (
                <span key={g} className="px-2 py-0.5 text-[10px] font-medium bg-paper-dark border border-rule text-ink-muted">{g}</span>
              ))}
            </div>
          )}

          {/* Overview */}
          {detail.overview && (
            <p className="text-[13px] text-ink leading-relaxed mt-4">{detail.overview}</p>
          )}

          {/* TV info */}
          {detail.seasons && (
            <div className="flex items-center gap-3 mt-3 text-[12px] text-ink-muted">
              {detail.seasons && <span>{detail.seasons} season{detail.seasons > 1 ? 's' : ''}</span>}
              {detail.episodes && <span>{detail.episodes} episodes</span>}
              {detail.status && <span className="text-masthead font-medium">{detail.status}</span>}
            </div>
          )}

          {/* Cast & Directors */}
          <div className="mt-4 space-y-3 pb-6">
            {detail.directors.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-ink-muted mb-1">
                  {detail.type === 'movie' ? 'Director' : 'Created by'}
                </p>
                <p className="text-[13px] text-ink">{detail.directors.join(', ')}</p>
              </div>
            )}
            {detail.cast.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-ink-muted mb-1 flex items-center gap-1">
                  <Users size={10} /> Cast
                </p>
                <p className="text-[13px] text-ink">{detail.cast.join(', ')}</p>
              </div>
            )}
            {detail.trailer && (
              <a
                href={detail.trailer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] font-medium cursor-pointer transition-all duration-200 border border-masthead text-masthead hover:bg-masthead hover:text-paper"
              >
                <Play size={12} /> Watch Trailer
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeftSidebar({ hackerNews, releases, dates, selectedDate, onSelectDate, showHistory }: Props) {
  const [detail, setDetail] = useState<ReleaseDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const openDetail = async (r: UpcomingRelease) => {
    const key = `${r.type}-${r.id}`;
    setLoadingId(key);
    try {
      const resp = await fetch(`/api/widgets/releases/${r.type}/${r.id}`);
      const data = await resp.json();
      if (!data.error) setDetail(data);
    } catch {
      // silent
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <aside className="w-60 shrink-0 hidden lg:block pt-8 font-widget">
      <div className="sticky top-8 space-y-8">
        {/* Upcoming Releases */}
        {releases.length > 0 && (
          <section>
            <WidgetHeader title="This Week" />
            <div className="pt-3 space-y-3">
              {releases.map((r, i) => {
                const key = `${r.type}-${r.id}`;
                return (
                  <div key={key}>
                    <button
                      onClick={() => openDetail(r)}
                      className="w-full text-left flex gap-2.5 -mx-2 px-2 py-1.5 rounded cursor-pointer transition-all duration-200 hover:bg-masthead/5 group"
                    >
                      {r.poster ? (
                        <img
                          src={r.poster}
                          alt={r.title}
                          className="w-10 h-14 object-cover shrink-0 bg-paper-dark transition-opacity duration-200 group-hover:opacity-80"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-paper-dark border border-rule flex items-center justify-center shrink-0">
                          {r.type === 'movie' ? <Film size={14} className="text-ink-muted" /> : <Tv size={14} className="text-ink-muted" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink leading-snug truncate group-hover:text-masthead transition-colors duration-200">
                          {loadingId === key ? '...' : r.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {r.type === 'movie' ? (
                            <Film size={9} className="text-ink-muted shrink-0" />
                          ) : (
                            <Tv size={9} className="text-ink-muted shrink-0" />
                          )}
                          <span className="text-[10px] text-ink-muted">{formatReleaseDate(r.date)}</span>
                          {r.rating !== null && r.rating > 0 && (
                            <span className="text-[10px] text-masthead font-medium">{r.rating.toFixed(1)}</span>
                          )}
                        </div>
                        {r.overview && (
                          <p className="text-[11px] text-ink-muted leading-snug mt-1 line-clamp-2">{r.overview}</p>
                        )}
                      </div>
                    </button>
                    {i < releases.length - 1 && <div className="h-px bg-rule-light mt-1.5" />}
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
                  {i < Math.min(hackerNews.length, 8) - 1 && <div className="h-px bg-rule-light mt-3" />}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {detail && <ReleaseModal detail={detail} onClose={() => setDetail(null)} />}
    </aside>
  );
}
