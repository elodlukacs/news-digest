import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Briefcase, ExternalLink, Search, X, RefreshCw, Sparkles,
  ChevronLeft, ChevronRight, Check, EyeOff, MapPin, Globe,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import type { Job, JobFilters, JobCounts } from '../types';
import { timeAgoDays } from '../utils/date';

interface Props {
  jobs: Job[];
  total: number;
  counts: JobCounts;
  sources: string[];
  countries: string[];
  filters: JobFilters;
  updateFilters: (partial: Partial<JobFilters>) => void;
  page: number;
  setPage: (p: number) => void;
  loading: boolean;
  fetching: boolean;
  aiFiltering: boolean;
  fetchJobs: () => void;
  updateStatus: (id: string, status: string) => void;
  aiFilter: (providerId?: string) => void;
  selectedLlm: string;
}

const SOURCE_LABELS: Record<string, string> = {
  remoteok: 'RemoteOK',
  weworkremotely: 'WWR',
  himalayas: 'Himalayas',
  remotive: 'Remotive',
  arbeitnow: 'Arbeitnow',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  hackernews: 'HN',
};

const SOURCE_COLORS: Record<string, string> = {
  remoteok: 'bg-emerald-100 text-emerald-700',
  weworkremotely: 'bg-blue-100 text-blue-700',
  himalayas: 'bg-purple-100 text-purple-700',
  remotive: 'bg-orange-100 text-orange-700',
  arbeitnow: 'bg-cyan-100 text-cyan-700',
  linkedin: 'bg-sky-100 text-sky-700',
  indeed: 'bg-indigo-100 text-indigo-700',
  hackernews: 'bg-amber-100 text-amber-700',
};

const WORK_TYPE_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

export function JobsPage({
  jobs, total, counts, sources, filters, updateFilters,
  page, setPage, loading, fetching, aiFiltering,
  fetchJobs, updateStatus, aiFilter, selectedLlm,
}: Props) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
  const PER_PAGE = 100;
  const totalPages = Math.ceil(total / PER_PAGE);

  const checkScroll = useCallback(() => {
    const el = filterScrollRef.current;
    if (!el) return;
    setScrollState({
      canScrollLeft: el.scrollLeft > 0,
      canScrollRight: el.scrollLeft < el.scrollWidth - el.clientWidth - 1,
    });
  }, []);

  useEffect(() => {
    checkScroll();
    const el = filterScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const el = filterScrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="pt-6 md:pt-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-black text-masthead leading-none">
              Career Opportunities
            </h1>
            <p className="text-xs sm:text-[13px] text-ink-muted mt-1.5 sm:mt-2 font-[family-name:var(--font-body)] truncate">
              {counts.total > 0
                ? `${counts.total} positions · ${sources.length} sources · ${counts.new} new · ${counts.applied} applied`
                : 'Fetch jobs from 8 sources to get started'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => aiFilter(selectedLlm)}
              disabled={aiFiltering || counts.new === 0}
              className="h-8 text-xs border-masthead/30 text-masthead hover:bg-masthead hover:text-white"
            >
              <Sparkles size={13} className={aiFiltering ? 'animate-pulse' : ''} />
              <span className="hidden sm:inline">{aiFiltering ? 'Curating...' : 'AI Curate New'}</span>
              <span className="sm:hidden">{aiFiltering ? 'AI Curating...' : 'AI Curate'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchJobs}
              disabled={fetching}
              className="h-8 text-xs border-masthead/30 text-masthead hover:bg-masthead hover:text-white"
            >
              <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{fetching ? 'Fetching...' : 'Fetch New Jobs'}</span>
              <span className="sm:hidden">{fetching ? 'Fetching jobs...' : 'Fetch Jobs'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Filter bar ─── */}
      <div className="sm:border-b border-rule mb-5">
        <div className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-1.5">
          {/* Filter buttons row - scrollable on mobile with arrows */}
          <div className="relative bg-paper-dark/40 -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent sm:flex-1 sm:min-w-0">
            {/* Left scroll arrow - mobile only */}
            {scrollState.canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 sm:hidden flex items-center justify-center w-8 h-8 bg-paper/90 backdrop-blur-sm rounded-r-md shadow-sm border border-rule/60 border-l-0"
                aria-label="Scroll filters left"
              >
                <ChevronLeft size={16} className="text-ink-muted" />
              </button>
            )}

            <div
              ref={filterScrollRef}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
            >
            {/* Source filter */}
            <div className="flex items-center gap-px shrink-0">
              <FilterButton active={!filters.source} onClick={() => updateFilters({ source: '' })}>All</FilterButton>
              {sources.map(s => (
                <FilterButton key={s} active={filters.source === s} onClick={() => updateFilters({ source: filters.source === s ? '' : s })}>
                  {SOURCE_LABELS[s] || s}
                </FilterButton>
              ))}
            </div>

            <div className="hidden sm:block w-px h-5 bg-rule/60 mx-1 shrink-0" />

            {/* Work type */}
            <div className="flex items-center gap-px shrink-0">
              <FilterButton active={!filters.workType} onClick={() => updateFilters({ workType: '' })}>All</FilterButton>
              {['remote', 'hybrid', 'onsite'].map(w => (
                <FilterButton key={w} active={filters.workType === w} onClick={() => updateFilters({ workType: filters.workType === w ? '' : w })}>
                  {WORK_TYPE_LABELS[w]}
                </FilterButton>
              ))}
            </div>

            <div className="hidden sm:block w-px h-5 bg-rule/60 mx-1 shrink-0" />

            {/* Status */}
            <div className="flex items-center gap-px shrink-0">
              <FilterButton active={!filters.status} onClick={() => updateFilters({ status: '' })}>All</FilterButton>
              <FilterButton active={filters.status === 'new'} onClick={() => updateFilters({ status: filters.status === 'new' ? '' : 'new' })}>
                New {counts.new > 0 && `(${counts.new})`}
              </FilterButton>
              <FilterButton active={filters.status === 'applied'} onClick={() => updateFilters({ status: filters.status === 'applied' ? '' : 'applied' })}>
                Applied {counts.applied > 0 && `(${counts.applied})`}
              </FilterButton>
              <FilterButton active={filters.status === 'ignored'} onClick={() => updateFilters({ status: filters.status === 'ignored' ? '' : 'ignored' })}>
                Ignored {counts.ignored > 0 && `(${counts.ignored})`}
              </FilterButton>
            </div>

            <div className="hidden sm:block w-px h-5 bg-rule/60 mx-1 shrink-0" />

            {/* AI toggle */}
            <FilterButton active={filters.aiOnly} onClick={() => updateFilters({ aiOnly: !filters.aiOnly })}>
              <span className="flex items-center gap-1"><Sparkles size={10} /> AI {counts.aiFiltered > 0 && `(${counts.aiFiltered})`}</span>
            </FilterButton>
            </div>

            {/* Right scroll arrow - mobile only */}
            {scrollState.canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 sm:hidden flex items-center justify-center w-8 h-8 bg-paper/90 backdrop-blur-sm rounded-l-md shadow-sm border border-rule/60 border-r-0"
                aria-label="Scroll filters right"
              >
                <ChevronRight size={16} className="text-ink-muted" />
              </button>
            )}
          </div>

          {/* Search - full width on mobile, inline on desktop */}
          <div className="relative w-full sm:w-auto sm:max-w-[200px] sm:shrink-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50 sm:left-2.5 sm:size-[13px]" />
            <Input
              placeholder="Search jobs..."
              value={filters.search}
              onChange={e => updateFilters({ search: e.target.value })}
              className="pl-9 sm:pl-8 h-9 sm:h-7 text-sm sm:text-[11px] bg-transparent border-rule/60"
            />
            {filters.search && (
              <button onClick={() => updateFilters({ search: '' })} className="absolute right-3 sm:right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                <X size={14} className="sm:size-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Job List ─── */}
      {loading && jobs.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="p-3.5 bg-paper-dark/50 rounded space-y-2.5">
              <Skeleton className="w-3/4 h-4" />
              <Skeleton className="w-1/2 h-3" />
              <div className="flex gap-2"><Skeleton className="w-14 h-4" /><Skeleton className="w-10 h-4" /></div>
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-24 text-center">
          <Briefcase size={40} className="mx-auto text-ink-muted/30 mb-4" />
          <p className="font-serif text-2xl text-ink-muted italic mb-2">No positions found</p>
          <p className="text-sm text-ink-muted mb-6">
            {counts.total === 0 ? 'Click "Fetch Jobs" to load listings from 8 sources.' : 'Try adjusting your filters.'}
          </p>
          {counts.total === 0 && (
            <Button onClick={fetchJobs} disabled={fetching}>
              <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
              Fetch Jobs
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => setSelectedJob(job)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 py-4 border-t border-rule/40">
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-[11px] text-ink-muted min-w-[100px] text-center">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
              </span>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ─── Detail Sheet ─── */}
      <Sheet open={!!selectedJob} onOpenChange={open => !open && setSelectedJob(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b border-rule">
            <SheetTitle className="font-serif text-lg font-bold leading-snug">
              {selectedJob?.title}
            </SheetTitle>
          </SheetHeader>
          {selectedJob && (
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold text-ink">{selectedJob.company}</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-ink-muted">
                    {selectedJob.country && (
                      <span className="flex items-center gap-1"><MapPin size={12} />{selectedJob.country}</span>
                    )}
                    {selectedJob.workType && (
                      <Badge variant="outline" className="text-[10px]">{WORK_TYPE_LABELS[selectedJob.workType] || selectedJob.workType}</Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] ${SOURCE_COLORS[selectedJob.source] || ''}`}>
                    {SOURCE_LABELS[selectedJob.source] || selectedJob.source}
                  </Badge>
                  <span className="text-xs text-ink-muted">{timeAgoDays(selectedJob.datePosted)}</span>
                  {selectedJob.aiRemote && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Globe size={10} />
                      Remote: {selectedJob.aiRemote}
                    </Badge>
                  )}
                </div>

                {/* Status actions */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted mr-1">Status:</span>
                  {(['new', 'applied', 'ignored'] as const).map(s => (
                    <Button
                      key={s}
                      variant={selectedJob.status === s ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs capitalize"
                      onClick={() => {
                        updateStatus(selectedJob.id, s);
                        setSelectedJob({ ...selectedJob, status: s });
                      }}
                    >
                      {s === 'applied' && <Check size={12} />}
                      {s === 'ignored' && <EyeOff size={12} />}
                      {s}
                    </Button>
                  ))}
                </div>

                {selectedJob.description && (
                  <div className="border-t border-rule pt-4">
                    <p className="text-xs uppercase tracking-wider text-ink-muted mb-2 font-semibold">Description</p>
                    <div
                      className="text-sm leading-relaxed text-ink-light font-[family-name:var(--font-body)] prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedJob.description) }}
                    />
                  </div>
                )}

                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-masthead hover:underline mt-2"
                >
                  <ExternalLink size={14} />
                  Open Original Listing
                </a>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Sub-components ─── */

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2 py-1.5 sm:py-1 text-xs sm:text-[10px] font-sans font-medium rounded transition-all duration-200 cursor-pointer ${
        active
          ? 'bg-masthead text-white shadow-sm'
          : 'text-ink-muted hover:text-ink hover:bg-paper'
      }`}
    >
      {children}
    </button>
  );
}

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={`group relative bg-paper-dark rounded px-3 py-2.5 sm:px-3 sm:py-2 cursor-pointer transition-all duration-200 border border-rule/40 hover:border-ink/20 hover:shadow-sm ${
        job.status === 'ignored' ? 'opacity-40' : ''
      } ${job.status === 'applied' ? 'border-l-2 border-l-emerald-500' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <h3 className="font-sans text-sm sm:text-[13px] font-semibold leading-tight text-ink group-hover:text-masthead transition-colors line-clamp-1">
                  {job.title}
                </h3>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs font-sans">
                {job.title}
              </TooltipContent>
            </Tooltip>
          <p className="text-xs sm:text-[11px] text-ink-light mt-0.5 truncate">{job.company}</p>
        </div>
        <span className={`text-[9px] sm:text-[8px] font-semibold uppercase tracking-wider shrink-0 mt-0.5 ${
          SOURCE_COLORS[job.source]?.split(' ')[1] || 'text-ink-muted'
        }`}>
          {SOURCE_LABELS[job.source] || job.source}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 sm:mt-1 text-xs sm:text-[10px] text-ink-muted">
        {job.country && (
          <span className="flex items-center gap-0.5 truncate"><MapPin size={9} className="sm:size-2" />{job.country}</span>
        )}
        {job.workType && (
          <span className={`px-1.5 py-px rounded-sm text-[9px] sm:text-[8px] font-medium ${
            job.workType === 'remote' ? 'bg-emerald-100/60 text-emerald-700' :
            job.workType === 'hybrid' ? 'bg-amber-100/60 text-amber-700' :
            'bg-stone-100 text-stone-600'
          }`}>
            {WORK_TYPE_LABELS[job.workType] || job.workType}
          </span>
        )}
        <span className="ml-auto text-[10px] sm:text-[9px]">{timeAgoDays(job.datePosted)}</span>
        {job.status === 'applied' && <Check size={12} className="text-emerald-600 sm:size-3" />}
      </div>
    </article>
  );
}
