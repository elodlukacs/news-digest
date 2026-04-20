import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { RefreshCw, AlertCircle, Clock, Zap, Settings, Trash2, ExternalLink, MoreVertical, MessageCircle, X, Brain, FlaskConical, Filter, Search } from 'lucide-react';
// Sentiment ribbon — positioned absolute top-right, no layout impact
const RIBBON_COLORS: Record<string, string> = {
  positive: 'bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]',
  negative: 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]',
  neutral: 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]',
  mixed: 'bg-[var(--color-mixed-bg)] text-[var(--color-mixed-text)]',
};
const RIBBON_DOT: Record<string, string> = {
  positive: 'bg-[var(--color-positive-dot)]',
  negative: 'bg-[var(--color-negative-dot)]',
  neutral: 'bg-[var(--color-neutral-dot)]',
  mixed: 'bg-[var(--color-mixed-dot)]',
};
function SentimentRibbon({ sentiment }: { sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' }) {
  return (
    <span className={`absolute -top-1.5 right-0 md:top-0 md:right-0 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-bl-lg text-[9px] uppercase tracking-wider font-semibold pointer-events-none ${RIBBON_COLORS[sentiment]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${RIBBON_DOT[sentiment]}`} />
      {sentiment}
    </span>
  );
}
import { ArticleChatPopup } from './ArticleChatPopup';
import { ChallengeQuiz } from './ChallengeQuiz';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Drawer, DrawerContent } from './ui/drawer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import type { Summary } from '../types';
import { useArticleChat } from '../hooks/useApi';
import { BiasRadarPanel } from '../features/mindgames/bias-radar';

export interface ParsedSection {
  title: string;
  url: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
  originalContent?: string;
  source?: string;
  pubDate?: string;
}

export function parseSummaryMarkdown(markdown: string, sentimentData: Summary['sentiment_data']): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const parts = markdown.split(/\n---\n/);

  // Build title→sentiment and title→originalContent lookups
  const sentimentByTitle = new Map<string, 'positive' | 'negative' | 'neutral' | 'mixed'>();
  const originalContentByTitle = new Map<string, string>();
  const sourceByTitle = new Map<string, string>();
  const pubDateByTitle = new Map<string, string>();
  if (sentimentData) {
    for (const entry of sentimentData) {
      if (entry.title && entry.sentiment) {
        sentimentByTitle.set(entry.title.toLowerCase(), entry.sentiment);
      }
      if (entry.title && entry.original_content) {
        originalContentByTitle.set(entry.title.toLowerCase(), entry.original_content);
      }
      if (entry.title && entry.source) {
        sourceByTitle.set(entry.title.toLowerCase(), entry.source);
      }
      if (entry.title && entry.pub_date) {
        pubDateByTitle.set(entry.title.toLowerCase(), entry.pub_date);
      }
    }
  }

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extract title and URL from ## [Title](url) pattern
    const linkMatch = trimmed.match(/^##\s+\[([^\]]+)\]\(([^)]+)\)/);
    const title = linkMatch ? linkMatch[1] : trimmed.split('\n')[0].replace(/^#+\s*/, '').replace(/\*\*/g, '');
    const url = linkMatch ? linkMatch[2] : '';

    // Remove the title line and clean up
    let content = trimmed
      .replace(/^##\s+\[[^\]]+\]\([^)]+\)/, '')
      .replace(/^#+\s*/, '')
      .trim();

    // Clean up content - remove source annotations and normalize
    content = content
      .replace(/出自\s*[^。]+。/g, '')
      .replace(/Source:\s*[^\n]+/gi, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    sections.push({
      title,
      url,
      content,
      sentiment: sentimentByTitle.get(title.toLowerCase()) || null,
      originalContent: originalContentByTitle.get(title.toLowerCase()) || '',
      source: sourceByTitle.get(title.toLowerCase()),
      pubDate: pubDateByTitle.get(title.toLowerCase()),
    });
  }

  return sections;
}

function parseRateLimitError(error: string): {
  isRateLimit: boolean;
  waitTime?: string;
  model?: string;
  used?: number;
  limit?: number;
} {
  if (!error.includes('429') && !error.includes('rate_limit')) return { isRateLimit: false };
  const rawTimeMatch = error.match(/try again in ([\d.]+m)?([\d.]+s)?/i);
  const modelMatch = error.match(/model `([^`]+)`/);
  const usedMatch = error.match(/Used (\d+)/);
  const limitMatch = error.match(/Limit (\d+)/);
  return {
    isRateLimit: true,
    waitTime: rawTimeMatch
      ? [
          rawTimeMatch[1]?.replace(/(\d+)m/, '$1 min'),
          rawTimeMatch[2]?.replace(/[\d.]+s/, (s) => `${Math.round(parseFloat(s))} sec`),
        ]
          .filter(Boolean)
          .join(' ')
      : 'a few minutes',
    model: modelMatch?.[1] || 'Unknown',
    used: usedMatch ? parseInt(usedMatch[1]) : undefined,
    limit: limitMatch ? parseInt(limitMatch[1]) : undefined,
  };
}

function RateLimitDialog({ error, open, onClose }: { error: string; open: boolean; onClose: () => void }) {
  const info = parseRateLimitError(error);
  const usagePercent = info.used && info.limit ? Math.round((info.used / info.limit) * 100) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <Clock size={16} className="text-masthead" />
            Rate Limit Reached
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            The AI provider has temporarily limited requests. This is normal on the free tier.
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-4 py-3 bg-paper-dark border border-rule">
              <span className="text-xs text-ink-muted uppercase tracking-wider">Wait time</span>
              <span className="font-serif font-bold text-masthead">{info.waitTime}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-paper-dark border border-rule">
              <span className="text-xs text-ink-muted uppercase tracking-wider">Model</span>
              <span className="text-sm font-medium">{info.model}</span>
            </div>
            {usagePercent !== null && (
              <div className="px-4 py-3 bg-paper-dark border border-rule">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-ink-muted uppercase tracking-wider">Daily usage</span>
                  <span className="text-sm font-medium">{usagePercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-masthead rounded-full" style={{ width: `${usagePercent}%` }} />
                </div>
                <p className="text-[11px] text-ink-muted mt-1.5">
                  {info.used?.toLocaleString()} / {info.limit?.toLocaleString()} tokens
                </p>
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 pt-1">
            <Zap size={12} className="text-ink-muted mt-0.5 shrink-0" />
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Try again after the wait time. Limits reset daily.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { PromptLensSelector, type PromptLens } from './PromptLensSelector';

interface Props {
  categoryName: string;
  summary: Summary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: (keyword?: string) => void;
  onClearFilter?: () => void;
  onManageFeeds: () => void;
  onDelete: () => void;
  selectedLlm: string;
  selectedLens: PromptLens | null;
  onLensChange: (lens: PromptLens | null) => void;
  onRunLens: () => void;
  lensLoading: boolean;
  lensContent: string | null;
  lensName: string | null;
  lensError: string | null;
  onDismissLens: () => void;
  articleFontSize: number;
}

export function SummaryView({
  categoryName,
  summary,
  loading,
  refreshing,
  error,
  onRefresh,
  onClearFilter,
  onManageFeeds,
  onDelete,
  selectedLlm,
  selectedLens,
  onLensChange,
  onRunLens,
  lensLoading,
  lensContent,
  lensName,
  lensError,
  onDismissLens,
  articleFontSize,
}: Props) {
  const [rateLimitDismissed, setRateLimitDismissed] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');

  const handleFilterRefresh = () => {
    const kw = keyword.trim();
    setActiveKeyword(kw);
    onRefresh(kw || undefined);
  };

  const handleClearFilter = () => {
    setKeyword('');
    setActiveKeyword('');
    if (onClearFilter) onClearFilter();
    else onRefresh(undefined);
  };
  const [radarSection, setRadarSection] = useState<{ title: string; content: string; url: string; originalContent?: string } | null>(null);
  const [chatSection, setChatSection] = useState<{ title: string; content: string; originalContent?: string } | null>(null);
  const [challengeIdx, setChallengeIdx] = useState<number | null>(null);

  const chatArticleContent = useMemo(() => {
    if (!chatSection) return null;
    return chatSection.originalContent || chatSection.content || null;
  }, [chatSection]);

  const { messages: chatMessages, sending: chatSending, sendMessage: chatSend } = useArticleChat(
    summary?.id ?? null,
    chatSection?.title ?? null,
    chatArticleContent,
    selectedLlm,
  );

  useEffect(() => {
    setRateLimitDismissed(false);
  }, [error]);

  const busy = loading || refreshing;
  const rateLimitInfo = error ? parseRateLimitError(error) : null;

  const sections = useMemo(() => {
    return summary ? parseSummaryMarkdown(summary.summary, summary.sentiment_data) : [];
  }, [summary?.summary, summary?.sentiment_data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="pt-8 pb-4 md:border-b md:border-rule">
        <div className="flex items-center gap-3 mb-3">
          {/* Mobile: single trigger button */}
          <button
            className="md:hidden shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-rule bg-paper-dark text-ink shadow-sm active:scale-95 transition-transform cursor-pointer"
            onClick={() => setActionsOpen(true)}
            aria-label="More options"
          >
            <MoreVertical size={20} />
          </button>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-masthead tracking-tight">{categoryName}</h2>
        </div>
        {summary && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-paper-dark border border-rule text-[11px] font-medium text-ink-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              {summary.article_count} articles · {summary.feed_count} sources
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-paper-dark border border-rule text-[11px] font-medium text-ink-muted">
              <Clock size={10} />
              {new Date(summary.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {summary.provider && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-paper-dark border border-rule text-[11px] font-medium text-ink-muted">
                <Zap size={10} />
                {summary.provider}
              </span>
            )}
          </div>
        )}

        <div className="md:hidden mt-4 space-y-2">
          <button
            onClick={() => onRefresh(undefined)}
            disabled={busy}
            className="w-full h-14 flex items-center justify-between px-4 rounded-xl bg-masthead/8 border border-masthead/20 text-masthead disabled:opacity-50 active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex flex-col items-start min-w-0">
              <span className="text-base font-semibold leading-tight truncate">
                {refreshing ? 'Updating…' : 'Pull latest stories'}
              </span>
              {!refreshing && (
                <span className="text-xs text-masthead/60 mt-0.5 truncate">Fetch new articles from your feeds</span>
              )}
            </div>
            <RefreshCw size={18} className={`shrink-0 ml-3 ${busy ? 'animate-spin' : ''}`} />
          </button>

          {/* Filter — input on left, action button attached on right */}
          <div className={`flex h-14 rounded-xl border bg-paper overflow-hidden transition-colors ${busy ? 'opacity-60' : ''} ${activeKeyword ? 'border-masthead/30' : 'border-rule'}`}>
            <div className="flex-1 min-w-0 flex items-center gap-3 pl-4">
              <Search size={18} className="text-ink-muted shrink-0" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && handleFilterRefresh()}
                placeholder="Filter by keyword…"
                disabled={busy}
                className="flex-1 min-w-0 pr-4 text-sm font-semibold bg-transparent text-ink placeholder:text-ink-muted placeholder:font-normal outline-none"
              />
            </div>
            {activeKeyword && (
              <button
                onClick={handleClearFilter}
                className="px-3 text-ink-muted hover:text-accent transition-colors cursor-pointer"
                aria-label="Clear filter"
              >
                <X size={14} />
              </button>
            )}
            <button
              onClick={handleFilterRefresh}
              disabled={busy || !keyword.trim()}
              className="flex items-center justify-center gap-1.5 px-4 min-w-[112px] border-l border-rule bg-masthead text-paper text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <Filter size={14} /> Filter
            </button>
          </div>

          <PromptLensSelector selectedSlug={selectedLens?.slug ?? null} onSelect={onLensChange} onRun={onRunLens} running={lensLoading} disabled={busy} fullWidth />
        </div>

        {/* Desktop: unified toolbar */}
        <div className="hidden md:flex items-center gap-2 mt-3 flex-wrap">
          {/* Primary: Refresh */}
          <button
            onClick={() => onRefresh(undefined)}
            disabled={busy}
            className="h-9 inline-flex items-center gap-2 px-3.5 rounded-md bg-masthead text-paper text-[13px] font-semibold hover:bg-masthead/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh Articles'}
          </button>

          {/* Filter: segmented */}
          <div className={`h-9 inline-flex items-stretch rounded-md border overflow-hidden transition-colors bg-paper shadow-sm ${activeKeyword ? 'border-masthead/40' : 'border-rule'} ${busy ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-1.5 pl-2.5">
              <Search size={13} className="text-ink-muted shrink-0" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && handleFilterRefresh()}
                placeholder="Filter by keyword…"
                disabled={busy}
                className="w-40 pr-2 text-[13px] font-medium bg-transparent text-ink placeholder:text-ink-muted placeholder:font-normal outline-none"
              />
            </div>
            {activeKeyword && (
              <button
                onClick={handleClearFilter}
                className="inline-flex items-center justify-center px-2 text-ink-muted hover:text-accent transition-colors cursor-pointer"
                aria-label="Clear filter"
              >
                <X size={12} />
              </button>
            )}
            <button
              onClick={handleFilterRefresh}
              disabled={busy || !keyword.trim()}
              className="inline-flex items-center gap-1.5 px-3 border-l border-rule bg-paper-dark text-[13px] font-semibold text-ink hover:bg-masthead hover:text-paper disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-paper-dark disabled:hover:text-ink transition-colors cursor-pointer"
            >
              <Filter size={12} /> Filter
            </button>
          </div>

          {/* Lens */}
          <PromptLensSelector selectedSlug={selectedLens?.slug ?? null} onSelect={onLensChange} onRun={onRunLens} running={lensLoading} disabled={busy} />

          {/* Secondary actions */}
          <div className="inline-flex items-center gap-1">
            <button
              onClick={onManageFeeds}
              className="h-9 inline-flex items-center gap-2 px-3 rounded-md border border-rule bg-paper text-[13px] font-medium text-ink hover:bg-paper-dark transition-colors cursor-pointer shadow-sm"
            >
              <Settings size={14} />
              Settings
            </button>
            <button
              onClick={onDelete}
              aria-label="Delete this category"
              className="h-9 inline-flex items-center justify-center px-2.5 rounded-md text-ink-muted hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Lens error */}
      {lensError && !lensLoading && (
        <Alert variant="destructive" className="mt-6 md:mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Lens failed</AlertTitle>
          <AlertDescription>{lensError}</AlertDescription>
        </Alert>
      )}

      {/* Lens loading / result */}
      {(lensLoading || lensContent) && (
        <div className="mt-6 md:mt-8">
          <article className="relative -mx-4 md:mx-0 overflow-hidden">
            {/* Accent left bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-masthead" />

            {/* Subtle background */}
            <div className="ml-0 md:ml-0 border-y md:border border-masthead/20 bg-gradient-to-br from-masthead/[0.06] to-masthead/[0.02]">
              <div className="px-5 py-5 md:px-6 md:py-6 relative">

                {/* Dismiss */}
                {!lensLoading && lensContent && (
                  <button
                    onClick={onDismissLens}
                    className="absolute top-4 right-4 p-1 text-masthead/40 hover:text-masthead transition-colors cursor-pointer"
                    aria-label="Dismiss lens result"
                  >
                    <X size={14} />
                  </button>
                )}

                {/* Header */}
                <div className="flex items-center gap-2.5 mb-4 pr-6">
                  {(selectedLens || lensName) && (
                    <span className="text-2xl leading-none shrink-0">{selectedLens?.icon ?? '🔭'}</span>
                  )}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-serif text-xl font-bold text-masthead leading-tight">
                      {lensLoading ? (selectedLens?.name || 'Lens') : (lensName || 'Lens')}
                    </h3>
                    <span className="text-[9px] uppercase tracking-[0.22em] font-bold text-masthead/50 font-[family-name:var(--font-widget)]">
                      Lens View
                    </span>
                  </div>
                </div>

                {/* Content */}
                {lensLoading ? (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex gap-[5px]">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-[5px] h-[5px] rounded-full bg-masthead animate-[pulse_1s_ease-in-out_infinite]"
                          style={{ animationDelay: `${i * 180}ms` }}
                        />
                      ))}
                    </div>
                    <span className="text-[13px] font-[family-name:var(--font-body)] text-ink-light italic">Thinking…</span>
                  </div>
                ) : lensContent ? (
                  <div className="border-t border-masthead/15 pt-4">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="font-serif text-2xl font-bold text-ink mt-6 mb-3 leading-tight">{children}</h1>,
                        h2: ({ children }) => <h2 className="font-serif text-xl font-bold text-ink mt-5 mb-2 leading-snug">{children}</h2>,
                        h3: ({ children }) => <h3 className="font-serif text-lg font-semibold text-ink mt-4 mb-2 leading-snug">{children}</h3>,
                        p: ({ children }) => <p className="text-[16px] leading-[1.8] text-ink font-[family-name:var(--font-body)] break-words [overflow-wrap:anywhere] mb-4">{children}</p>,
                        ul: ({ children }) => <ul className="space-y-3 my-4 list-disc pl-5">{children}</ul>,
                        ol: ({ children }) => <ol className="space-y-3 my-4 list-decimal pl-5">{children}</ol>,
                        li: ({ children }) => <li className="text-[16px] leading-[1.8] text-ink font-[family-name:var(--font-body)]">{children}</li>,
                        strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-masthead underline decoration-masthead/30 underline-offset-2 hover:decoration-masthead transition-colors cursor-pointer">
                            {children}
                          </a>
                        ),
                        hr: () => <div className="my-4 h-px bg-masthead/20" />,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-masthead/40 pl-4 italic text-ink-light my-4">{children}</blockquote>,
                      }}
                    >
                      {lensContent}
                    </ReactMarkdown>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </div>
      )}

      {/* Mobile: bottom drawer with actions */}
      <Drawer open={actionsOpen} onOpenChange={setActionsOpen} direction="bottom">
        <DrawerContent className="px-0 pb-8 bg-paper rounded-t-2xl">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted px-6 mt-2 mb-3">Actions</p>
          <nav className="flex flex-col">
            <button
              onClick={() => { onManageFeeds(); setActionsOpen(false); }}
              className="flex items-center gap-4 px-6 py-3.5 active:bg-paper-dark transition-colors"
            >
              <Settings size={18} className="text-ink-muted" />
              <span className="text-[14px] font-medium text-ink">Manage feeds & settings</span>
            </button>
            <div className="h-px bg-rule/50 mx-6 my-1" />
            <button
              onClick={() => { onDelete(); setActionsOpen(false); }}
              className="flex items-center gap-4 px-6 py-3.5 active:bg-paper-dark transition-colors"
            >
              <Trash2 size={18} className="text-accent" />
              <span className="text-[14px] font-medium text-accent">Delete category</span>
            </button>
          </nav>
        </DrawerContent>
      </Drawer>

      {(loading || refreshing) && !summary && (
        <div className="py-16 space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3 px-2">
              <Skeleton className="w-3/4 h-6" />
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-5/6 h-4" />
              <Skeleton className="w-24 h-8 mt-2" />
            </div>
          ))}
        </div>
      )}

      {error && !rateLimitDismissed && rateLimitInfo?.isRateLimit && (
        <RateLimitDialog
          error={error}
          open={true}
          onClose={() => setRateLimitDismissed(true)}
        />
      )}

      {error && !rateLimitInfo?.isRateLimit && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load summary</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {summary && sections.length > 0 && (
        <div className="pt-2 md:pt-8 pb-12 space-y-1 md:space-y-4">
          {sections.map((section, idx) => (
            <article key={idx} className="-mx-4 px-4 py-1.5 border-y border-rule/60 bg-paper-dark/70 md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-y-0">
              <Card className="relative border-0 bg-transparent md:bg-paper-dark md:border md:border-rule overflow-visible md:overflow-hidden min-w-0">
                {/* Sentiment ribbon — card edge on both mobile and desktop */}
                {section.sentiment && (
                  <SentimentRibbon sentiment={section.sentiment} />
                )}
                <CardHeader className="pb-0 px-0 md:px-5">
                  <CardTitle className="text-lg md:text-xl pr-16 break-words">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-0 md:px-5">
                  <p className="break-words [overflow-wrap:anywhere]" style={{ fontSize: `${articleFontSize}px`, lineHeight: `${articleFontSize * 1.8}px`, color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}>
                    {section.content}
                  </p>
                </CardContent>
                <CardFooter className="px-0 md:px-5 flex-wrap gap-1.5 md:gap-2 items-end">
                  {section.url && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                      <a href={section.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={12} />
                        Read
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1.5 text-xs transition-colors ${
                      challengeIdx === idx
                        ? 'border-masthead/60 bg-masthead/10 text-masthead hover:bg-masthead/15'
                        : 'hover:border-masthead/50 hover:text-masthead'
                    }`}
                    onClick={() => setChallengeIdx(challengeIdx === idx ? null : idx)}
                    aria-expanded={challengeIdx === idx}
                  >
                    <Brain size={14} strokeWidth={1.75} />
                    {challengeIdx === idx ? 'Close challenge' : 'Challenge'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setRadarSection({ title: section.title, content: section.content, url: section.url, originalContent: section.originalContent })}
                  >
                    <FlaskConical size={14} strokeWidth={1.5} />
                    Dissect
                  </Button>
                  {summary.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setChatSection({ title: section.title, content: section.content, originalContent: section.originalContent })}
                    >
                      <MessageCircle size={14} strokeWidth={1.5} />
                      Chat
                    </Button>
                  )}
                  {(section.source || section.pubDate) && (
                    <div className="ml-auto flex items-center gap-2 text-[11px] text-ink-muted/70 font-[family-name:var(--font-body)] italic">
                      {section.source && <span>{section.source}</span>}
                      {section.source && section.pubDate && <span className="text-ink-muted/30">·</span>}
                      {section.pubDate && (
                        <span>
                          {(() => {
                            try {
                              const d = new Date(section.pubDate);
                              return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                            } catch { return section.pubDate; }
                          })()}
                        </span>
                      )}
                    </div>
                  )}
                </CardFooter>
                {challengeIdx === idx && (
                  <div className="px-0 md:px-5 pb-4 md:pb-5">
                    <ChallengeQuiz
                      headline={section.title}
                      content={section.originalContent || section.content}
                      onClose={() => setChallengeIdx(null)}
                    />
                  </div>
                )}
              </Card>
            </article>
          ))}

          {summary.tags_data && summary.tags_data.length > 0 && (
            <div className="mt-8 pt-6 border-t border-rule">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink-muted mb-3">Topics</p>
              <div className="flex flex-wrap gap-2">
                {summary.tags_data.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px] font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {chatSection && summary.id && (
            <ArticleChatPopup
              headline={chatSection.title}
              sourceName={categoryName}
              messages={chatMessages}
              sending={chatSending}
              onSend={chatSend}
              onClose={() => setChatSection(null)}
            />
          )}
        </div>
      )}

      {!loading && !refreshing && !error && !summary && (
        <div className="py-24 text-center">
          <p className="font-serif text-xl text-ink-muted italic">Click refresh to load the latest summary</p>
        </div>
      )}

      {radarSection && (() => {
        let sourceDomain = categoryName;
        try {
          if (radarSection.url) {
            sourceDomain = new URL(radarSection.url).hostname.replace(/^www\./, '');
          }
        } catch {}
        return (
          <BiasRadarPanel
            headline={radarSection.title}
            content={radarSection.content}
            originalContent={radarSection.originalContent}
            currentArticle={{
              id: radarSection.url || radarSection.title,
              title: radarSection.title,
              url: radarSection.url,
              source: sourceDomain,
              biasRating: 'center',
              publishedAt: summary?.generated_at || '',
              excerpt: radarSection.content,
            }}
            sourceName={sourceDomain}
            onClose={() => setRadarSection(null)}
            initialTab="decode"
            sections={sections}
            categoryName={categoryName}
          />
        );
      })()}
    </div>
  );
}

