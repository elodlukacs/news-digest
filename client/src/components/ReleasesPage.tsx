import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Film, Tv, Star, Clock, X, ExternalLink, Play, Calendar, Search } from 'lucide-react';
import { API_BASE } from '../config';
import { formatShortDate } from '../utils/date';
import type { UpcomingRelease, ReleaseDetail } from '../types';

interface Props {
  releases: UpcomingRelease[];
}

function formatFullDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}


export function ReleasesPage({ releases: defaultReleases }: Props) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRelease, setSelectedRelease] = useState<{ type: string; id: number } | null>(null);
  const [detail, setDetail] = useState<ReleaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Releases fetched by date range (null = use default prop)
  const [fetchedReleases, setFetchedReleases] = useState<UpcomingRelease[] | null>(null);
  const [fetchingReleases, setFetchingReleases] = useState(false);

  // Fetch new releases when date range changes
  useEffect(() => {
    if (!dateFrom && !dateTo) {
      setFetchedReleases(null);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);

    setFetchingReleases(true);
    fetch(`${API_BASE}/widgets/releases?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { setFetchedReleases(data); setFetchingReleases(false); })
      .catch(err => { if (err.name !== 'AbortError') setFetchingReleases(false); });

    return () => controller.abort();
  }, [dateFrom, dateTo]);

  // Use fetched releases if we have a date filter, otherwise use default prop
  const releases = fetchedReleases ?? defaultReleases;

  // Client-side filter for type + search only
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return releases.filter(r => {
      if (!r.date) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [releases, typeFilter, searchQuery]);

  // Fetch detail
  const fetchDetail = useCallback(async (type: string, id: number) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`${API_BASE}/widgets/releases/${type}/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setDetail(data);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleCardClick = (release: UpcomingRelease) => {
    setSelectedRelease({ type: release.type, id: release.id });
    fetchDetail(release.type, release.id);
    requestAnimationFrame(() => setPanelVisible(true));
  };

  const handleCloseDetail = useCallback(() => {
    setPanelVisible(false);
    closeTimerRef.current = setTimeout(() => {
      setSelectedRelease(null);
      setDetail(null);
    }, 250);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Body scroll lock when detail panel open
  useEffect(() => {
    if (selectedRelease) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedRelease]);

  // Escape key to close detail
  useEffect(() => {
    if (!selectedRelease) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCloseDetail(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRelease, handleCloseDetail]);

  // Date range for subtitle
  const datedReleases = releases.filter(r => r.date);
  const dateRange = datedReleases.length > 0
    ? `${formatShortDate(datedReleases[0].date)} - ${formatShortDate(datedReleases[datedReleases.length - 1].date)}`
    : '';

  return (
    <div className="py-6">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-[10px] uppercase tracking-[0.3em] font-semibold text-masthead/60 mb-2">
          This Week in Entertainment
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink">
          Upcoming Releases
        </h1>
        {dateRange && (
          <p className="text-sm text-ink-muted mt-1.5 flex items-center justify-center gap-1.5">
            <Calendar size={13} />
            {dateRange}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="bg-paper-dark px-5 py-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Type filter */}
          <div className="flex items-center">
            {(['all', 'movie', 'tv'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold cursor-pointer transition-all duration-200 ${
                  typeFilter === t
                    ? 'bg-masthead text-white'
                    : 'text-ink-muted hover:text-ink hover:bg-paper'
                }`}
              >
                {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV Shows'}
              </button>
            ))}
          </div>

          {/* Date range */}
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onClear={() => { setDateFrom(null); setDateTo(null); }}
          />

          <div className="flex-1 min-w-0" />

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search titles..."
              className="pl-8 pr-3 py-1.5 text-sm bg-paper text-ink placeholder-ink-muted focus:outline-none focus:ring-1 focus:ring-masthead/30 transition-all w-48"
            />
          </div>

          {/* Result count */}
          <span className="text-[11px] text-ink-muted font-medium shrink-0">
            {filtered.length}/{releases.length}
          </span>
        </div>
      </div>

      {/* Grid */}
      {fetchingReleases ? (
        <div className="py-16 text-center">
          <div className="inline-block w-5 h-5 border-2 border-masthead border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-ink-muted">Loading releases...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Film size={32} className="mx-auto text-ink-muted mb-3" />
          <p className="font-serif text-lg text-ink-muted italic">No releases match your filters</p>
          <p className="text-sm text-ink-muted mt-1">Try adjusting the type or date filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {filtered.map(r => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleCardClick(r)}
              className="group text-left cursor-pointer transition-all duration-200 bg-paper-dark hover:bg-paper-dark/80 p-0 overflow-hidden"
            >
              {r.poster ? (
                <img
                  src={r.poster}
                  alt={r.title}
                  loading="lazy"
                  className="w-full aspect-[2/3] object-cover bg-paper-dark"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-paper-dark flex items-center justify-center">
                  {r.type === 'movie' ? <Film size={28} className="text-ink-muted" /> : <Tv size={28} className="text-ink-muted" />}
                </div>
              )}
              <div className="p-2.5">
                <p className="font-serif text-sm font-bold text-ink leading-snug line-clamp-2 group-hover:text-masthead transition-colors duration-200">
                  {r.title}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className={`text-[10px] uppercase tracking-[0.2em] font-bold px-1.5 py-0.5 ${
                    r.type === 'movie' ? 'text-masthead bg-masthead/10' : 'text-ink-muted bg-paper-dark'
                  }`}>
                    {r.type === 'movie' ? 'Film' : 'TV'}
                  </span>
                  <span className="text-[10px] text-ink-muted flex items-center gap-0.5">
                    <Clock size={9} />
                    {formatShortDate(r.date)}
                  </span>
                  {r.rating !== null && r.rating > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-masthead font-medium">
                      <Star size={9} /> {r.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selectedRelease && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-ink/30 backdrop-blur-sm transition-opacity duration-250 ${panelVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleCloseDetail}
          />

          {/* Panel */}
          <div
            className={`
              relative z-10 bg-paper flex flex-col
              w-full h-full md:h-full md:w-full md:max-w-lg
              transition-transform duration-250 ease-out
              ${panelVisible ? 'translate-x-0' : 'translate-x-full'}
            `}
          >
            {/* Close button */}
            <button
              onClick={handleCloseDetail}
              className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center bg-ink/50 hover:bg-ink/70 text-white rounded-full cursor-pointer transition-colors duration-200"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="py-32 text-center">
                  <div className="inline-block w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-ink-muted font-light">Loading details...</p>
                </div>
              ) : detail ? (
                <>
                  {/* Backdrop image */}
                  {detail.backdrop && (
                    <div className="relative w-full h-48 md:h-56 overflow-hidden">
                      <img
                        src={detail.backdrop}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/30 to-transparent" />
                    </div>
                  )}

                  <div className={`px-5 pb-8 ${detail.backdrop ? '-mt-16 relative z-10' : 'pt-14'}`}>
                    {/* Poster + title row */}
                    <div className="flex gap-4 mb-4">
                      {detail.poster ? (
                        <img
                          src={detail.poster}
                          alt={detail.title}
                          className="w-24 md:w-28 h-auto object-cover border border-rule shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-24 md:w-28 aspect-[2/3] bg-paper-dark border border-rule flex items-center justify-center shrink-0">
                          {detail.type === 'movie' ? <Film size={24} className="text-ink-muted" /> : <Tv size={24} className="text-ink-muted" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 pt-2">
                        <h2 className="font-serif text-xl md:text-2xl font-black text-ink leading-tight">
                          {detail.title}
                        </h2>
                        {detail.tagline && (
                          <p className="text-sm text-ink-muted italic mt-1">{detail.tagline}</p>
                        )}

                        {/* Genres */}
                        {detail.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {detail.genres.map(g => (
                              <span key={g} className="text-[10px] uppercase tracking-[0.15em] font-semibold px-2 py-0.5 bg-paper-dark text-ink-muted">
                                {g}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 py-3 bg-paper-dark -mx-5 px-5 text-sm text-ink-muted">
                      <span className={`text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 ${
                        detail.type === 'movie' ? 'text-masthead bg-masthead/10' : 'text-ink-muted bg-paper-dark'
                      }`}>
                        {detail.type === 'movie' ? 'Movie' : 'TV Show'}
                      </span>

                      {detail.rating !== null && detail.rating > 0 && (
                        <span className="flex items-center gap-1 text-masthead font-medium">
                          <Star size={13} /> {detail.rating.toFixed(1)}
                          {detail.votes > 0 && (
                            <span className="text-ink-muted font-normal text-xs">({detail.votes.toLocaleString()})</span>
                          )}
                        </span>
                      )}

                      {detail.runtime && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {detail.runtime} min
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {formatShortDate(detail.date)}
                      </span>

                      {detail.status && (
                        <span className="text-xs">{detail.status}</span>
                      )}
                    </div>

                    {/* TV info */}
                    {detail.type === 'tv' && (detail.seasons || detail.episodes) && (
                      <div className="flex items-center gap-4 py-2 text-sm text-ink-muted">
                        {detail.seasons && <span>{detail.seasons} Season{detail.seasons > 1 ? 's' : ''}</span>}
                        {detail.episodes && <span>{detail.episodes} Episode{detail.episodes > 1 ? 's' : ''}</span>}
                      </div>
                    )}

                    {/* Overview */}
                    {detail.overview && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 bg-paper-dark -mx-5 px-5 py-2 mb-2">
                          <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink">Synopsis</h3>
                        </div>
                        <p className="text-sm leading-relaxed text-ink-light font-[family-name:var(--font-body)]">
                          {detail.overview}
                        </p>
                      </div>
                    )}

                    {/* Cast */}
                    {detail.cast.length > 0 && (
                      <div className="mt-5">
                        <div className="flex items-center gap-2 bg-paper-dark -mx-5 px-5 py-2 mb-2">
                          <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink">Cast</h3>
                        </div>
                        <p className="text-sm text-ink-light">{detail.cast.join(', ')}</p>
                      </div>
                    )}

                    {/* Directors / Creators */}
                    {detail.directors.length > 0 && (
                      <div className="mt-5">
                        <div className="flex items-center gap-2 bg-paper-dark -mx-5 px-5 py-2 mb-2">
                          <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink">
                            {detail.type === 'movie' ? 'Director' : 'Created By'}
                          </h3>
                        </div>
                        <p className="text-sm text-ink-light">{detail.directors.join(', ')}</p>
                      </div>
                    )}

                    {/* Trailer */}
                    {detail.trailer && (
                      <div className="mt-5">
                        <a
                          href={detail.trailer}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-[0.15em] font-semibold cursor-pointer transition-all duration-200 bg-masthead text-white hover:bg-masthead/80"
                        >
                          <Play size={14} />
                          Watch Trailer
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}

                    {/* Release date */}
                    <div className="mt-6 pt-4">
                      <p className="text-xs text-ink-muted">
                        Release date: {formatFullDate(detail.date)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-32 text-center">
                  <p className="text-sm text-ink-muted">Failed to load details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DateRangeFilter({ dateFrom, dateTo, onDateFromChange, onDateToChange, onClear }: {
  dateFrom: string | null;
  dateTo: string | null;
  onDateFromChange: (v: string | null) => void;
  onDateToChange: (v: string | null) => void;
  onClear: () => void;
}) {
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  // Use native event listeners to guarantee we capture date picker changes
  useEffect(() => {
    const fromEl = fromRef.current;
    const toEl = toRef.current;
    if (!fromEl || !toEl) return;

    const handleFrom = () => onDateFromChange(fromEl.value || null);
    const handleTo = () => onDateToChange(toEl.value || null);

    fromEl.addEventListener('change', handleFrom);
    fromEl.addEventListener('input', handleFrom);
    toEl.addEventListener('change', handleTo);
    toEl.addEventListener('input', handleTo);

    return () => {
      fromEl.removeEventListener('change', handleFrom);
      fromEl.removeEventListener('input', handleFrom);
      toEl.removeEventListener('change', handleTo);
      toEl.removeEventListener('input', handleTo);
    };
  }, [onDateFromChange, onDateToChange]);

  // Sync controlled value -> DOM (for clear button)
  useEffect(() => {
    if (fromRef.current) fromRef.current.value = dateFrom || '';
  }, [dateFrom]);
  useEffect(() => {
    if (toRef.current) toRef.current.value = dateTo || '';
  }, [dateTo]);

  return (
    <div className="flex items-center gap-2">
      <Calendar size={13} className="text-ink-muted shrink-0" />
      <span className="text-[11px] text-ink-muted font-medium">From</span>
      <input
        ref={fromRef}
        type="date"
        defaultValue={dateFrom || ''}
        className="px-3 py-1.5 text-[12px] bg-paper text-ink font-medium focus:outline-none focus:ring-1 focus:ring-masthead/30 transition-all cursor-pointer"
      />
      <span className="text-[11px] text-ink-muted font-medium">to</span>
      <input
        ref={toRef}
        type="date"
        defaultValue={dateTo || ''}
        className="px-3 py-1.5 text-[12px] bg-paper text-ink font-medium focus:outline-none focus:ring-1 focus:ring-masthead/30 transition-all cursor-pointer"
      />
      {(dateFrom || dateTo) && (
        <button
          onClick={onClear}
          className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper cursor-pointer transition-all"
          title="Clear dates"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
