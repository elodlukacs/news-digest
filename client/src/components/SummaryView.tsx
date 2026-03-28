import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertCircle, Clock, Zap, Settings, Trash2, ExternalLink, MoreVertical, Search } from 'lucide-react';
import { SentimentBadge } from './SentimentBadge';
import { ChatPanel } from './ChatPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Drawer, DrawerContent } from './ui/drawer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import type { Summary, ChatMessage } from '../types';
import BiasRadarPanel from './bias-radar/BiasRadarPanel';
import { getBiasRating } from '../utils/biasRatings';

interface ParsedSection {
  title: string;
  url: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
}

function parseSummaryMarkdown(markdown: string, sentimentData: Summary['sentiment_data']): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const parts = markdown.split(/\n---\n/);

  // Build a title→sentiment lookup for reliable matching
  const sentimentByTitle = new Map<string, 'positive' | 'negative' | 'neutral' | 'mixed'>();
  if (sentimentData) {
    for (const entry of sentimentData) {
      if (entry.title && entry.sentiment) {
        sentimentByTitle.set(entry.title.toLowerCase(), entry.sentiment);
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

interface Props {
  categoryId: number;
  categoryName: string;
  summary: Summary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onManageFeeds: () => void;
  onDelete: () => void;
  chatMessages: ChatMessage[];
  chatSending: boolean;
  onChatSend: (text: string) => void;
}

export function SummaryView({
  categoryId: _categoryId,
  categoryName,
  summary,
  loading,
  refreshing,
  error,
  onRefresh,
  onManageFeeds,
  onDelete,
  chatMessages,
  chatSending,
  onChatSend,
}: Props) {
  const [rateLimitDismissed, setRateLimitDismissed] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [radarSection, setRadarSection] = useState<{ title: string; content: string; url: string } | null>(null);

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
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-masthead tracking-tight">{categoryName}</h2>

          {/* Mobile: single trigger button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden ml-auto"
            onClick={() => setActionsOpen(true)}
          >
            <MoreVertical size={20} />
          </Button>
        </div>
        {summary && (
          <p className="text-xs text-ink-muted mt-1.5 font-light">
            {summary.article_count} articles from {summary.feed_count} sources
            &nbsp;&middot;&nbsp;
            {new Date(summary.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {summary.provider && <>&nbsp;&middot;&nbsp;{summary.provider}</>}
          </p>
        )}

        {/* Desktop: labeled action buttons */}
        <div className="hidden md:flex items-center gap-2 mt-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={onRefresh} disabled={busy}>
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh the Articles'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={onManageFeeds}>
            <Settings size={14} />
            Feeds & Settings
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-ink-muted hover:text-accent" onClick={onDelete}>
            <Trash2 size={14} />
            Delete this Category
          </Button>
        </div>
      </div>

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
            <div className="h-px bg-rule/50 mx-6 my-1" />
            <button
              onClick={() => { onRefresh(); setActionsOpen(false); }}
              disabled={busy}
              className="flex items-center gap-4 px-6 py-4 active:bg-paper-dark transition-colors mt-2"
            >
              <RefreshCw size={18} className={`text-masthead ${busy ? 'animate-spin' : ''}`} />
              <span className="text-[14px] font-semibold text-masthead">{refreshing ? 'Refreshing...' : 'Refresh summary'}</span>
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
        <div className="pt-4 md:pt-8 pb-12 space-y-2 md:space-y-4">
          {sections.map((section, idx) => (
            <article key={idx} className="-mx-6 px-6 py-1.5 border-y border-rule/60 bg-paper-dark/70 md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-y-0">
              <Card className="border-0 bg-transparent md:bg-paper-dark md:border md:border-rule">
                <CardHeader className="pb-0 px-0 md:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg md:text-xl">{section.title}</CardTitle>
                    {section.sentiment && (
                      <SentimentBadge sentiment={section.sentiment} />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-0 md:px-5">
                  <p className="text-[15px] leading-[1.8] text-ink font-[family-name:var(--font-body)]">
                    {section.content}
                  </p>
                </CardContent>
                <CardFooter className="px-0 md:px-5 gap-2">
                  {section.url && (
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <a href={section.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={12} />
                        Read full article
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setRadarSection({ title: section.title, content: section.content, url: section.url })}
                  >
                    <Search size={14} strokeWidth={1.5} />
                    Bias Radar
                  </Button>
                </CardFooter>
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

          {summary.id && <ChatPanel messages={chatMessages} sending={chatSending} onSend={onChatSend} />}
        </div>
      )}

      {!loading && !refreshing && !error && !summary && (
        <div className="py-24 text-center">
          <p className="font-serif text-xl text-ink-muted italic">Click refresh to load the latest summary</p>
        </div>
      )}

      {radarSection && (
        <BiasRadarPanel
          articleId={radarSection.url || radarSection.title}
          headline={radarSection.title}
          content={radarSection.content}
          currentArticle={{
            id: radarSection.url || radarSection.title,
            title: radarSection.title,
            url: radarSection.url,
            source: categoryName,
            biasRating: radarSection.url ? getBiasRating(radarSection.url) : 'center',
            publishedAt: summary?.generated_at || '',
            excerpt: radarSection.content,
          }}
          onClose={() => setRadarSection(null)}
        />
      )}
    </div>
  );
}

