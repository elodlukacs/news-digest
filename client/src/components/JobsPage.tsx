import { useState } from 'react';
import {
  Briefcase, ExternalLink, Search, X, RefreshCw, Sparkles,
  ChevronLeft, ChevronRight, Check, EyeOff, MapPin, Globe,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import type { Job, JobFilters, JobCounts } from '../types';

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

function timeAgo(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function JobsPage({
  jobs, total, counts, sources, filters, updateFilters,
  page, setPage, loading, fetching, aiFiltering,
  fetchJobs, updateStatus, aiFilter, selectedLlm,
}: Props) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const PER_PAGE = 100;
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="pt-6 md:pt-8 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-black text-masthead leading-none">
              Career Opportunities
            </h1>
            <p className="text-[13px] text-ink-muted mt-2 font-[family-name:var(--font-body)]">
              {counts.total > 0
                ? `${counts.total} positions · ${sources.length} sources · ${counts.new} new · ${counts.applied} applied`
                : 'Fetch jobs from 8 sources to get started'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => aiFilter(selectedLlm)}
              disabled={aiFiltering || counts.new === 0}
              className="h-8 text-xs"
            >
              <Sparkles size={13} className={aiFiltering ? 'animate-pulse' : ''} />
              {aiFiltering ? 'Curating...' : 'AI Curate'}
            </Button>
            <Button size="sm" onClick={fetchJobs} disabled={fetching} className="h-8 text-xs">
              <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
              {fetching ? 'Fetching...' : 'Fetch Jobs'}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Filter bar ─── */}
      <div className="flex flex-wrap items-center gap-1.5 py-3 border-y border-rule mb-5">
        {/* Search */}
        <div className="relative min-w-[160px] max-w-[200px]">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted/50" />
          <Input
            placeholder="Search..."
            value={filters.search}
            onChange={e => updateFilters({ search: e.target.value })}
            className="pl-7 h-7 text-[11px] bg-transparent border-rule/60"
          />
          {filters.search && (
            <button onClick={() => updateFilters({ search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X size={11} />
            </button>
          )}
        </div>

        <div className="w-px h-5 bg-rule/60 mx-1" />

        {/* Source filter */}
        <div className="flex items-center gap-px">
          <FilterButton active={!filters.source} onClick={() => updateFilters({ source: '' })}>All</FilterButton>
          {sources.map(s => (
            <FilterButton key={s} active={filters.source === s} onClick={() => updateFilters({ source: filters.source === s ? '' : s })}>
              {SOURCE_LABELS[s] || s}
            </FilterButton>
          ))}
        </div>

        <div className="w-px h-5 bg-rule/60 mx-1" />

        {/* Work type */}
        <div className="flex items-center gap-px">
          <FilterButton active={!filters.workType} onClick={() => updateFilters({ workType: '' })}>All</FilterButton>
          {['remote', 'hybrid', 'onsite'].map(w => (
            <FilterButton key={w} active={filters.workType === w} onClick={() => updateFilters({ workType: filters.workType === w ? '' : w })}>
              {WORK_TYPE_LABELS[w]}
            </FilterButton>
          ))}
        </div>

        <div className="w-px h-5 bg-rule/60 mx-1" />

        {/* Status */}
        <div className="flex items-center gap-px">
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

        <div className="w-px h-5 bg-rule/60 mx-1" />

        {/* AI toggle */}
        <FilterButton active={filters.aiOnly} onClick={() => updateFilters({ aiOnly: !filters.aiOnly })}>
          <span className="flex items-center gap-1"><Sparkles size={10} /> AI {counts.aiFiltered > 0 && `(${counts.aiFiltered})`}</span>
        </FilterButton>
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
                  <span className="text-xs text-ink-muted">{timeAgo(selectedJob.datePosted)}</span>
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
                      dangerouslySetInnerHTML={{ __html: selectedJob.description }}
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
      className={`px-2 py-1 text-[10px] font-sans font-medium rounded transition-all duration-200 cursor-pointer ${
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
      className={`group relative bg-paper-dark rounded px-3 py-2 cursor-pointer transition-all duration-200 border border-rule/40 hover:border-ink/20 hover:shadow-sm ${
        job.status === 'ignored' ? 'opacity-40' : ''
      } ${job.status === 'applied' ? 'border-l-2 border-l-emerald-500' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <h3 className="font-sans text-[13px] font-semibold leading-tight text-ink group-hover:text-masthead transition-colors line-clamp-1">
                  {job.title}
                </h3>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs font-sans">
                {job.title}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-[11px] text-ink-light mt-0.5 truncate">{job.company}</p>
        </div>
        <span className={`text-[8px] font-semibold uppercase tracking-wider shrink-0 mt-0.5 ${
          SOURCE_COLORS[job.source]?.split(' ')[1] || 'text-ink-muted'
        }`}>
          {SOURCE_LABELS[job.source] || job.source}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-ink-muted">
        {job.country && (
          <span className="flex items-center gap-0.5 truncate"><MapPin size={8} />{job.country}</span>
        )}
        {job.workType && (
          <span className={`px-1 py-px rounded-sm text-[8px] font-medium ${
            job.workType === 'remote' ? 'bg-emerald-100/60 text-emerald-700' :
            job.workType === 'hybrid' ? 'bg-amber-100/60 text-amber-700' :
            'bg-stone-100 text-stone-600'
          }`}>
            {WORK_TYPE_LABELS[job.workType] || job.workType}
          </span>
        )}
        <span className="ml-auto text-[9px]">{timeAgo(job.datePosted)}</span>
        {job.status === 'applied' && <Check size={11} className="text-emerald-600" />}
      </div>
    </article>
  );
}
