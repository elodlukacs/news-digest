import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Film, Tv, Star, Clock, ExternalLink, Play, Calendar, Search, X } from 'lucide-react';
import { API_BASE } from '../config';
import { formatShortDate } from '../utils/date';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
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
  };

  const handleCloseDetail = useCallback(() => {
    setSelectedRelease(null);
    setDetail(null);
  }, []);

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
        <h1 className="font-serif text-3xl md:text-4xl font-black">
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
              <Button
                key={t}
                variant={typeFilter === t ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold cursor-pointer transition-all duration-200 ${
                  typeFilter === t
                    ? 'bg-masthead text-white hover:bg-masthead/90'
                    : 'text-ink-muted hover:text-ink hover:bg-paper'
                }`}
              >
                {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV Shows'}
              </Button>
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
            <Input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search titles..."
              className="pl-8 pr-3 py-1.5 text-sm bg-paper placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-masthead/30 transition-all w-48 h-8"
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
        <div className="py-16 space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full aspect-[2/3]" />
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-2/3 h-3" />
              </div>
            ))}
          </div>
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
              type="button"
              key={`${r.type}-${r.id}`}
              onClick={() => handleCardClick(r)}
              className="group flex flex-col bg-paper-dark hover:bg-paper-dark/80 cursor-pointer transition-all duration-200 overflow-hidden text-left"
            >
              <div className="w-full aspect-[2/3] bg-paper-dark shrink-0 overflow-hidden">
                {r.poster ? (
                  <img
                    src={r.poster}
                    alt={r.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {r.type === 'movie' ? <Film size={28} className="text-ink-muted" /> : <Tv size={28} className="text-ink-muted" />}
                  </div>
                )}
              </div>
              <div className="p-2 flex flex-col gap-1 flex-1 min-w-0">
                <p className="font-serif text-sm font-bold leading-snug line-clamp-2 text-ink group-hover:text-masthead transition-colors duration-200">
                  {r.title}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={r.type === 'movie' ? 'default' : 'secondary'} className={`text-[10px] uppercase tracking-[0.2em] font-bold px-1.5 py-0.5 ${
                    r.type === 'movie' ? 'text-masthead bg-masthead/10' : 'text-ink-muted bg-paper-dark'
                  }`}>
                    {r.type === 'movie' ? 'Film' : 'TV'}
                  </Badge>
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

      {/* Detail Sheet */}
      <Sheet open={!!selectedRelease} onOpenChange={(v) => { if (!v) handleCloseDetail(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 gap-0">
          <ScrollArea className="h-full">
            {detailLoading ? (
              <div className="py-32 space-y-4">
                <Skeleton className="w-full h-48" />
                <div className="px-5 space-y-3">
                  <div className="flex gap-4">
                    <Skeleton className="w-28 h-40 shrink-0" />
                    <div className="flex-1 space-y-2 pt-2">
                      <Skeleton className="w-48 h-6" />
                      <Skeleton className="w-32 h-4" />
                      <div className="flex gap-2 pt-2">
                        <Skeleton className="w-16 h-5" />
                        <Skeleton className="w-12 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : detail ? (
              <>
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
                      <SheetHeader className="p-0">
                        <SheetTitle className="text-xl md:text-2xl font-black leading-tight">
                          {detail.title}
                        </SheetTitle>
                      </SheetHeader>
                      {detail.tagline && (
                        <p className="text-sm text-ink-muted italic mt-1">{detail.tagline}</p>
                      )}

                      {detail.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {detail.genres.map(g => (
                            <Badge key={g} variant="secondary" className="text-[10px] uppercase tracking-[0.15em] font-semibold px-2 py-0.5 bg-paper-dark text-ink-muted">
                              {g}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 py-3 bg-paper-dark -mx-5 px-5 text-sm text-ink-muted">
                    <Badge variant={detail.type === 'movie' ? 'default' : 'secondary'} className={`text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 ${
                      detail.type === 'movie' ? 'text-masthead bg-masthead/10' : 'text-ink-muted bg-paper-dark'
                    }`}>
                      {detail.type === 'movie' ? 'Movie' : 'TV Show'}
                    </Badge>

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

                  {detail.type === 'tv' && (detail.seasons || detail.episodes) && (
                    <div className="flex items-center gap-4 py-2 text-sm text-ink-muted">
                      {detail.seasons && <span>{detail.seasons} Season{detail.seasons > 1 ? 's' : ''}</span>}
                      {detail.episodes && <span>{detail.episodes} Episode{detail.episodes > 1 ? 's' : ''}</span>}
                    </div>
                  )}

                  {detail.overview && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 bg-paper-dark -mx-5 px-5 py-2 mb-2">
                        <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold">Synopsis</h3>
                      </div>
                      <p className="text-sm leading-relaxed text-ink-muted font-[family-name:var(--font-body)]">
                        {detail.overview}
                      </p>
                    </div>
                  )}

                  {detail.cast.length > 0 && (
                    <div className="mt-5">
                      <div className="flex items-center gap-2 bg-paper-dark -mx-5 px-5 py-2 mb-2">
                        <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold">Cast</h3>
                      </div>
                      <p className="text-sm text-ink-muted">{detail.cast.join(', ')}</p>
                    </div>
                  )}

                  {detail.directors.length > 0 && (
                    <div className="mt-5">
                      <div className="flex items-center gap-2 bg-paper-dark -mx-5 px-5 py-2 mb-2">
                        <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold">
                          {detail.type === 'movie' ? 'Director' : 'Created By'}
                        </h3>
                      </div>
                      <p className="text-sm text-ink-muted">{detail.directors.join(', ')}</p>
                    </div>
                  )}

                  {detail.trailer && (
                    <div className="mt-5">
                      <Button asChild>
                        <a href={detail.trailer} target="_blank" rel="noopener noreferrer">
                          <Play size={14} />
                          Watch Trailer
                          <ExternalLink size={11} />
                        </a>
                      </Button>
                    </div>
                  )}

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
          </ScrollArea>
        </SheetContent>
      </Sheet>
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
      <Input
        ref={fromRef}
        type="date"
        defaultValue={dateFrom || ''}
        className="px-3 py-1.5 text-[12px] bg-paper font-medium focus:outline-none focus:ring-1 focus:ring-masthead/30 transition-all cursor-pointer h-8"
      />
      <span className="text-[11px] text-ink-muted font-medium">to</span>
      <Input
        ref={toRef}
        type="date"
        defaultValue={dateTo || ''}
        className="px-3 py-1.5 text-[12px] bg-paper font-medium focus:outline-none focus:ring-1 focus:ring-masthead/30 transition-all cursor-pointer h-8"
      />
      {(dateFrom || dateTo) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="h-7 w-7"
          title="Clear dates"
        >
          <X size={13} />
        </Button>
      )}
    </div>
  );
}
