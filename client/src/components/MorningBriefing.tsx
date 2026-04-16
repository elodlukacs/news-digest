import { useMemo } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Briefing } from '../types';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';

interface Props {
  briefing: Briefing | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Parsing
// ────────────────────────────────────────────────────────────────────────────

type BriefingEntry =
  | { kind: 'story'; markdown: string }
  | { kind: 'heading'; markdown: string }
  | { kind: 'rule' };

function parseBriefing(summary: string): BriefingEntry[] {
  const lines = summary.split('\n').map((l) => l.trimEnd());
  const entries: BriefingEntry[] = [];
  let buffer: string[] = [];

  const flushStory = () => {
    if (buffer.length === 0) return;
    const text = buffer.join('\n').trim();
    if (text) entries.push({ kind: 'story', markdown: text });
    buffer = [];
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      flushStory();
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      flushStory();
      entries.push({ kind: 'rule' });
      continue;
    }
    if (/^#{1,6} /.test(trimmed)) {
      flushStory();
      entries.push({ kind: 'heading', markdown: trimmed });
      continue;
    }
    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      flushStory();
      buffer.push(trimmed);
      continue;
    }
    if (buffer.length > 0) {
      buffer.push(trimmed);
      continue;
    }
    buffer.push(trimmed);
    flushStory();
  }
  flushStory();
  return entries;
}

interface SplitStory {
  title: string;
  body: string;
  source: string | null;
}

// Pull "**Title** – body. (Source)" apart so we can render each piece with
// its own typographic treatment.
function splitStory(markdown: string): SplitStory {
  // Strip leading bullet marker, if any.
  const stripped = markdown.replace(/^([-*]|\d+\.)\s+/, '').trim();

  // Title: first **bold** run.
  const titleMatch = stripped.match(/^\*\*(.+?)\*\*/);
  const title = titleMatch ? titleMatch[1].trim() : stripped.split(/[–—-]/)[0].trim();

  let rest = titleMatch
    ? stripped.slice(titleMatch[0].length).trim()
    : stripped.slice(title.length).trim();

  // Drop a leading dash/em-dash separator after the title.
  rest = rest.replace(/^[\s]*[–—-][\s]*/, '');

  // Source: trailing parenthetical at the end, e.g. "(Bloomberg)" or "(BBC News)".
  let source: string | null = null;
  const sourceMatch = rest.match(/\s*\(([^()]+)\)\s*\.?\s*$/);
  if (sourceMatch) {
    source = sourceMatch[1].trim();
    rest = rest.slice(0, sourceMatch.index ?? rest.length).trim();
  }

  // Tidy trailing punctuation.
  rest = rest.replace(/\s+$/, '');

  return { title, body: rest, source };
}

function countWords(s: string): number {
  return (s.trim().match(/\S+/g) || []).length;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function timeOfDayGreeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'Late Night';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Goodnight';
}

// ────────────────────────────────────────────────────────────────────────────
// Markdown renderer fragments
// ────────────────────────────────────────────────────────────────────────────

const headingComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="font-serif text-2xl font-bold text-ink leading-tight">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="font-serif text-xl font-bold text-ink leading-snug">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-[10px] uppercase tracking-[0.18em] font-bold text-masthead">{children}</h3>
  ),
};

const inlineComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-ink">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-masthead underline decoration-masthead/30 underline-offset-2 hover:decoration-masthead transition-colors cursor-pointer"
    >
      {children}
    </a>
  ),
};

// ────────────────────────────────────────────────────────────────────────────
// Story card
// ────────────────────────────────────────────────────────────────────────────

function StoryCard({
  story,
  index,
  isLead,
  delayMs,
}: {
  story: SplitStory;
  index: number;
  isLead: boolean;
  delayMs: number;
}) {
  return (
    <article
      style={{ ['--delay' as string]: `${delayMs}ms` }}
      className="briefing-rise group relative grid grid-cols-[3.25rem_1fr] md:grid-cols-[5.5rem_1fr] gap-x-3 md:gap-x-6 py-6 md:py-8 border-b border-rule/60 last:border-b-0 transition-colors duration-300 hover:bg-paper-dark/40 -mx-3 md:-mx-5 px-3 md:px-5"
    >
      {/* Numeral */}
      <div className="pt-1 md:pt-2 select-none">
        <span
          aria-hidden="true"
          className="block font-serif font-black tabular-nums leading-none text-masthead/80 group-hover:text-masthead transition-all duration-300 group-hover:-translate-x-0.5 text-[2.25rem] md:text-[3.25rem]"
        >
          {pad2(index + 1)}
        </span>
        {isLead && (
          <span
            aria-hidden="true"
            className="mt-2 hidden md:block text-[9px] uppercase tracking-[0.32em] font-bold text-accent font-[family-name:var(--font-widget)]"
          >
            Lead
          </span>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0">
        {story.source && (
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-[6px] w-[6px] rotate-45 bg-accent group-hover:scale-125 transition-transform duration-300"
            />
            <span className="text-[10px] md:text-[11px] uppercase tracking-[0.22em] font-bold text-masthead font-[family-name:var(--font-widget)]">
              {story.source}
            </span>
          </div>
        )}

        <h3
          className={
            isLead
              ? 'font-serif font-bold text-ink leading-[1.15] tracking-[-0.01em] text-[26px] md:text-[34px] mb-3'
              : 'font-serif font-bold text-ink leading-[1.2] tracking-[-0.005em] text-[19px] md:text-[22px] mb-2'
          }
        >
          {story.title}
        </h3>

        {story.body && (
          <p
            className={
              isLead
                ? 'font-[family-name:var(--font-body)] text-ink-light text-[17px] md:text-[19px] leading-[1.7]'
                : 'font-[family-name:var(--font-body)] text-ink-light text-[15px] md:text-[16px] leading-[1.7]'
            }
          >
            <ReactMarkdown components={inlineComponents}>
              {story.body}
            </ReactMarkdown>
          </p>
        )}
      </div>
    </article>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Briefing body
// ────────────────────────────────────────────────────────────────────────────

function BriefingContent({ summary }: { summary: string }) {
  const entries = useMemo(() => parseBriefing(summary), [summary]);

  let storyIndex = -1;

  return (
    <div className="pt-6 md:pt-10">
      {entries.map((entry, i) => {
        if (entry.kind === 'rule') {
          return (
            <div
              key={i}
              className="my-6 md:my-10 flex items-center gap-4"
              aria-hidden="true"
            >
              <div className="flex-1 h-px bg-rule briefing-rule-grow" style={{ ['--delay' as string]: `${i * 30}ms` }} />
              <span className="font-serif text-masthead/60 text-sm tracking-widest">❦</span>
              <div className="flex-1 h-px bg-rule briefing-rule-grow" style={{ ['--delay' as string]: `${i * 30}ms` }} />
            </div>
          );
        }

        if (entry.kind === 'heading') {
          return (
            <div key={i} className="pt-6 pb-2 first:pt-0">
              <ReactMarkdown components={headingComponents}>{entry.markdown}</ReactMarkdown>
            </div>
          );
        }

        storyIndex += 1;
        const story = splitStory(entry.markdown);
        const delayMs = Math.min(60 + storyIndex * 55, 900);
        return (
          <StoryCard
            key={i}
            story={story}
            index={storyIndex}
            isLead={storyIndex === 0}
            delayMs={delayMs}
          />
        );
      })}

      {entries.some((e) => e.kind === 'story') && (
        <div
          className="mt-10 md:mt-14 flex flex-col items-center gap-3 briefing-rise"
          style={{ ['--delay' as string]: '900ms' }}
        >
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-rule" />
            <span className="font-serif italic text-ink-muted text-sm tracking-[0.3em]">— 30 —</span>
            <span className="h-px w-8 bg-rule" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.32em] font-bold text-ink-muted/70 font-[family-name:var(--font-widget)]">
            End of Briefing
          </span>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Masthead
// ────────────────────────────────────────────────────────────────────────────

function Masthead({
  briefing,
  storyCount,
  readMinutes,
  generatedDate,
}: {
  briefing: Briefing | null;
  storyCount: number;
  readMinutes: number;
  generatedDate: Date | null;
}) {
  // Edition numbering: Vol = year - 2025, No = day-of-year of the briefing
  // (or today, if no briefing yet). Pure flourish, but it grounds the page.
  const refDate = generatedDate ?? new Date();
  const vol = Math.max(1, refDate.getFullYear() - 2025);
  const no = dayOfYear(refDate);

  const dateString = refDate.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const greeting = timeOfDayGreeting(new Date());

  return (
    <header className="relative">
      {/* Top metadata strip — like a real masthead's date line */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-ink/70">
        <div className="flex items-center gap-3 text-[10px] md:text-[11px] uppercase tracking-[0.28em] font-bold text-ink font-[family-name:var(--font-widget)]">
          <span className="hidden md:inline">Vol. {vol}</span>
          <span className="hidden md:inline opacity-40">·</span>
          <span>No. {no}</span>
          <span className="opacity-40">·</span>
          <span className="text-ink-muted font-medium normal-case tracking-normal font-[family-name:var(--font-body)] italic">
            {dateString}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] md:text-[11px] uppercase tracking-[0.28em] font-bold text-masthead font-[family-name:var(--font-widget)]">
          <span className="briefing-pulse inline-block h-[6px] w-[6px] rounded-full bg-accent" />
          {greeting}
        </div>
      </div>

      {/* Title row */}
      <div className="pt-5 md:pt-7 pb-4 md:pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-5 border-b border-rule">
        <div className="min-w-0">
          <p className="text-[10px] md:text-[11px] uppercase tracking-[0.42em] font-bold text-accent mb-2 font-[family-name:var(--font-widget)]">
            The Sunday Edition
          </p>
          <h1 className="font-serif text-[44px] sm:text-[56px] md:text-[68px] lg:text-[76px] leading-[0.92] font-black tracking-[-0.025em] text-masthead whitespace-nowrap">
            Morning Briefing<span className="text-accent">.</span>
          </h1>
          {briefing && (
            <p className="mt-3 text-[12px] md:text-[13px] text-ink-muted font-[family-name:var(--font-body)] italic">
              Filed{' '}
              {new Date(briefing.generated_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {briefing.provider && (
                <>
                  {' · set in '}
                  <span className="not-italic font-[family-name:var(--font-widget)] text-[11px] uppercase tracking-[0.18em] font-semibold text-ink-light">
                    {briefing.provider}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Read-time / story-count chips */}
        {briefing && storyCount > 0 && (
          <div className="flex items-stretch gap-0 self-start md:self-end shrink-0 border border-ink/70 divide-x divide-ink/70 bg-paper">
            <div className="px-3 py-2 text-center min-w-[68px]">
              <div className="font-serif text-[22px] md:text-[26px] font-black leading-none text-masthead tabular-nums">
                {storyCount}
              </div>
              <div className="mt-1 text-[8.5px] md:text-[9px] uppercase tracking-[0.2em] font-bold text-ink-muted font-[family-name:var(--font-widget)]">
                Stories
              </div>
            </div>
            <div className="px-3 py-2 text-center min-w-[68px]">
              <div className="font-serif text-[22px] md:text-[26px] font-black leading-none text-masthead tabular-nums">
                {readMinutes}
                <span className="text-[12px] md:text-[14px] font-bold text-ink-muted ml-0.5">m</span>
              </div>
              <div className="mt-1 text-[8.5px] md:text-[9px] uppercase tracking-[0.2em] font-bold text-ink-muted font-[family-name:var(--font-widget)]">
                Read
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function MorningBriefing({ briefing, loading, error, onGenerate }: Props) {
  const { storyCount, readMinutes, generatedDate } = useMemo(() => {
    if (!briefing) {
      return { storyCount: 0, readMinutes: 0, generatedDate: null as Date | null };
    }
    const entries = parseBriefing(briefing.summary);
    const stories = entries.filter((e) => e.kind === 'story');
    const totalWords = stories.reduce(
      (acc, e) => acc + countWords(e.kind === 'story' ? e.markdown : ''),
      0,
    );
    return {
      storyCount: stories.length,
      readMinutes: Math.max(1, Math.round(totalWords / 200)),
      generatedDate: new Date(briefing.generated_at),
    };
  }, [briefing]);

  return (
    <div className="pt-4 md:pt-5 pb-20">
      <Masthead
        briefing={briefing}
        storyCount={storyCount}
        readMinutes={readMinutes}
        generatedDate={generatedDate}
      />

      {/* Action row — sits just under the masthead, like a kicker bar */}
      <div className="flex items-center justify-between gap-2 py-3 md:py-4 border-b border-rule/60">
        <p className="text-[10px] md:text-[11px] uppercase tracking-[0.28em] font-bold text-ink-muted/80 font-[family-name:var(--font-widget)]">
          {briefing ? 'Today’s Front Page' : 'Awaiting Press Run'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={loading}
            className="font-[family-name:var(--font-widget)] uppercase tracking-[0.12em] text-[11px]"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Pressing…' : 'New Edition'}
          </Button>
        </div>
      </div>

      {loading && !briefing && (
        <div className="pt-10 space-y-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[3.25rem_1fr] md:grid-cols-[5.5rem_1fr] gap-x-3 md:gap-x-6 py-2"
            >
              <Skeleton className="w-12 h-10 md:h-14" />
              <div className="space-y-3">
                <Skeleton className="w-24 h-3" />
                <Skeleton className="w-3/4 h-6" />
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-5/6 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {briefing && <BriefingContent summary={briefing.summary} />}

      {!loading && !error && !briefing && (
        <div className="py-24 text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <span className="font-serif text-[80px] md:text-[120px] leading-none font-black text-masthead/15 select-none">
              ❦
            </span>
            <p className="font-serif text-xl md:text-2xl text-ink-muted italic">
              The presses are quiet.
            </p>
            <p className="text-[12px] uppercase tracking-[0.32em] font-bold text-ink-muted/70 font-[family-name:var(--font-widget)]">
              Tap “New Edition” to file today’s briefing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
