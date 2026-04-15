import {
  Briefcase, ExternalLink, Search, X, RefreshCw, Sparkles,
  ChevronLeft, ChevronRight, Bookmark, MapPin, Globe, CalendarDays,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import type { Job, JobFilters, JobCounts, SourceCounts } from '../types';
import { timeAgoDays } from '../utils/date';

interface Props {
  jobs: Job[];
  total: number;
  counts: JobCounts;
  sources: string[];
  sourceCounts: SourceCounts;
  countries: string[];
  filters: JobFilters;
  updateFilters: (partial: Partial<JobFilters>) => void;
  page: number;
  setPage: (p: number) => void;
  loading: boolean;
  fetching: boolean;
  aiFiltering: boolean;
  fetchJobs: () => void;
  saveJob: (id: string) => void;
  unsaveJob: (id: string) => void;
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
  remoteok: 'bg-[var(--color-source-remoteok-bg)] text-[var(--color-source-remoteok-text)]',
  weworkremotely: 'bg-[var(--color-source-weworkremotely-bg)] text-[var(--color-source-weworkremotely-text)]',
  himalayas: 'bg-[var(--color-source-himalayas-bg)] text-[var(--color-source-himalayas-text)]',
  remotive: 'bg-[var(--color-source-remotive-bg)] text-[var(--color-source-remotive-text)]',
  arbeitnow: 'bg-[var(--color-source-arbeitnow-bg)] text-[var(--color-source-arbeitnow-text)]',
  linkedin: 'bg-[var(--color-source-linkedin-bg)] text-[var(--color-source-linkedin-text)]',
  indeed: 'bg-[var(--color-source-indeed-bg)] text-[var(--color-source-indeed-text)]',
  hackernews: 'bg-[var(--color-source-hackernews-bg)] text-[var(--color-source-hackernews-text)]',
};

const WORK_TYPE_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

export function JobsPage({
  jobs, total, counts, sources, sourceCounts, filters, updateFilters,
  page, setPage, loading, fetching, aiFiltering,
  fetchJobs, saveJob, unsaveJob, aiFilter, selectedLlm,
}: Props) {
  const PER_PAGE = 100;
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      <div className="pt-6 md:pt-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-black text-masthead leading-none">
              Career Opportunities
            </h1>
            <p className="text-xs sm:text-[13px] text-ink-muted mt-1.5 sm:mt-2 font-[family-name:var(--font-body)] truncate">
               {counts.total > 0
                ? `${counts.total} positions · ${sources.length} sources · ${counts.new} new · ${counts.saved} saved`
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

      <div className="border-b border-rule pb-5 mb-5 space-y-4">

        <div className="hidden md:flex md:items-center md:gap-3 md:flex-wrap">
          <div className="relative w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50 pointer-events-none" />
            <input
              type="search"
              placeholder="Search…"
              value={filters.search}
              onChange={e => updateFilters({ search: e.target.value })}
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-rule bg-paper-dark text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-masthead/40 focus:ring-2 focus:ring-masthead/10 transition-all"
            />
            {filters.search && (
              <button onClick={() => updateFilters({ search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                <X size={12} />
              </button>
            )}
          </div>

          <span className="w-px h-5 bg-rule shrink-0" />

          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest shrink-0">Source</span>
          <div className="flex items-center gap-1 flex-wrap">
            <FilterButton active={!filters.source} onClick={() => updateFilters({ source: '' })}>All <span className="opacity-60">({counts.total})</span></FilterButton>
            {sources.map(s => (
              <FilterButton key={s} active={filters.source === s} onClick={() => updateFilters({ source: filters.source === s ? '' : s })}>
                {SOURCE_LABELS[s] || s}{sourceCounts[s] !== undefined && <span className="opacity-60"> ({sourceCounts[s]})</span>}
              </FilterButton>
            ))}
          </div>

          <span className="w-px h-5 bg-rule shrink-0" />

          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest shrink-0">Type</span>
          <div className="flex items-center gap-1">
            <FilterButton active={!filters.workType} onClick={() => updateFilters({ workType: '' })}>All</FilterButton>
            {['remote', 'hybrid', 'onsite'].map(w => (
              <FilterButton key={w} active={filters.workType === w} onClick={() => updateFilters({ workType: filters.workType === w ? '' : w })}>
                {WORK_TYPE_LABELS[w]}
              </FilterButton>
            ))}
          </div>

          <span className="w-px h-5 bg-rule shrink-0" />

          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest shrink-0">Status</span>
          <div className="flex items-center gap-1">
            <FilterButton active={!filters.saved} onClick={() => updateFilters({ saved: false })}>All</FilterButton>
            <FilterButton active={filters.saved} onClick={() => updateFilters({ saved: !filters.saved })}>
              Saved{counts.saved > 0 && <span className="opacity-60"> ({counts.saved})</span>}
            </FilterButton>
          </div>

          <span className="w-px h-5 bg-rule shrink-0" />

          <FilterButton active={filters.aiOnly} onClick={() => updateFilters({ aiOnly: !filters.aiOnly })}>
            <Sparkles size={11} /> AI Only{counts.aiFiltered > 0 && <span className="opacity-60"> ({counts.aiFiltered})</span>}
          </FilterButton>
        </div>

        <div className="md:hidden space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted/50 pointer-events-none" />
            <input
              type="search"
              placeholder="Search jobs, companies, skills…"
              value={filters.search}
              onChange={e => updateFilters({ search: e.target.value })}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-rule bg-paper-dark text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-masthead/40 focus:ring-2 focus:ring-masthead/10 transition-all"
            />
            {filters.search && (
              <button onClick={() => updateFilters({ search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Source</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <FilterButton active={!filters.source} onClick={() => updateFilters({ source: '' })}>All <span className="opacity-60">({counts.total})</span></FilterButton>
              {sources.map(s => (
                <FilterButton key={s} active={filters.source === s} onClick={() => updateFilters({ source: filters.source === s ? '' : s })}>
                  {SOURCE_LABELS[s] || s}{sourceCounts[s] !== undefined && <span className="opacity-60"> ({sourceCounts[s]})</span>}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Type</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterButton active={!filters.workType} onClick={() => updateFilters({ workType: '' })}>All</FilterButton>
                {['remote', 'hybrid', 'onsite'].map(w => (
                  <FilterButton key={w} active={filters.workType === w} onClick={() => updateFilters({ workType: filters.workType === w ? '' : w })}>
                    {WORK_TYPE_LABELS[w]}
                  </FilterButton>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Status</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterButton active={!filters.saved} onClick={() => updateFilters({ saved: false })}>All</FilterButton>
                <FilterButton active={filters.saved} onClick={() => updateFilters({ saved: !filters.saved })}>
                  Saved{counts.saved > 0 && <span className="opacity-60"> ({counts.saved})</span>}
                </FilterButton>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Curation</p>
            <FilterButton active={filters.aiOnly} onClick={() => updateFilters({ aiOnly: !filters.aiOnly })}>
              <Sparkles size={12} /> AI Curated Only{counts.aiFiltered > 0 && <span className="opacity-60"> ({counts.aiFiltered})</span>}
            </FilterButton>
          </div>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 bg-paper-dark/50 rounded-xl space-y-3">
              <Skeleton className="w-3/4 h-5" />
              <Skeleton className="w-1/2 h-4" />
              <div className="flex gap-2 pt-2"><Skeleton className="w-20 h-4" /><Skeleton className="w-16 h-4" /></div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onSave={() => saveJob(job.id)}
                onUnsave={() => unsaveJob(job.id)}
              />
            ))}
          </div>

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
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-150 cursor-pointer active:scale-95 ${
        active
          ? 'bg-masthead text-white border-masthead shadow-sm'
          : 'bg-paper text-ink border-rule hover:border-masthead/40 hover:text-masthead'
      }`}
    >
      {children}
    </button>
  );
}

function JobCard({ job, onSave, onUnsave }: { job: Job; onSave: () => void; onUnsave: () => void }) {
  const dateLabel = timeAgoDays(job.datePosted);

  return (
    <article
      className={`group relative bg-paper-dark rounded-lg p-2.5 sm:p-3 transition-all duration-200 border ${
        job.saved
          ? 'border-l-[3px] border-l-amber-500 border-rule/30'
          : 'border-rule/40 hover:border-ink/15 hover:shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="font-serif text-[15px] font-semibold leading-snug text-ink group-hover:text-masthead transition-colors line-clamp-1">
              {job.title}
            </h3>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs font-sans">
            {job.title}
          </TooltipContent>
        </Tooltip>
        <p className="text-[11px] sm:text-[12px] text-ink-light mt-0.5 truncate">{job.company}</p>
      </div>

      <div className="flex items-center justify-between mt-1.5 sm:mt-2">
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-ink-muted">
          <span className="flex items-center gap-0.5">
            <CalendarDays size={10} className="text-ink-muted/60" />
            {dateLabel}
          </span>
          {job.country && (
            <span className="flex items-center gap-0.5">
              <MapPin size={10} className="text-ink-muted/60" />
              {job.country}
            </span>
          )}
          <span className="text-[9px] font-semibold text-ink-muted px-1.5 py-0.5 border border-rule rounded">
            {SOURCE_LABELS[job.source] || job.source}
          </span>
          {job.workType && (
            <span className={`font-semibold ${
              job.workType === 'remote' ? 'text-emerald-600' :
              job.workType === 'hybrid' ? 'text-amber-600' :
              'text-stone-500'
            }`}>
              {WORK_TYPE_LABELS[job.workType]}
            </span>
          )}
          {job.aiRemote && (
            <Badge variant="outline" className="text-[9px] gap-0.5 py-px">
              <Globe size={9} />
              {job.aiRemote}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-px sm:gap-0.5 shrink-0">
          <button
            type="button"
            onClick={job.saved ? onUnsave : onSave}
            className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md transition-all duration-150 cursor-pointer active:scale-90 ${
              job.saved
                ? 'text-amber-500 hover:bg-amber-500/10'
                : 'text-ink-muted/40 hover:text-amber-500 hover:bg-amber-500/10'
            }`}
            aria-label={job.saved ? 'Unsave job' : 'Save job'}
          >
            <Bookmark size={14} className="sm:w-4 sm:h-4" />
          </button>

          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md text-ink-muted/40 hover:text-masthead hover:bg-masthead/5 transition-all duration-150 active:scale-90"
            aria-label="Open original listing"
          >
            <ExternalLink size={14} className="sm:w-4 sm:h-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
