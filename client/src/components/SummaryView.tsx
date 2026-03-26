import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Clock, Zap, Send, Settings, Trash2, ExternalLink } from 'lucide-react';
import { API_BASE } from '../config';
import { SentimentBadge } from './SentimentBadge';
import { ChatPanel } from './ChatPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
import { Skeleton } from './ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import type { Summary, ChatMessage } from '../types';

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
  categoryId,
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
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  const sendToTelegram = async () => {
    setSending(true);
    setSent(false);
    setTelegramError(null);
    try {
      const resp = await fetch(`${API_BASE}/telegram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });
      if (!resp.ok) { setTelegramError('Request failed'); return; }
      const data = await resp.json();
      if (data.success) {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } else {
        setTelegramError(data.error || 'Failed to send');
      }
    } catch {
      setTelegramError('Failed to connect to server');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    setRateLimitDismissed(false);
  }, [error]);

  const busy = loading || refreshing;
  const rateLimitInfo = error ? parseRateLimitError(error) : null;

  const sections = summary ? parseSummaryMarkdown(summary.summary, summary.sentiment_data) : [];

  return (
    <div>
      <div className="pt-8 pb-4 border-b border-rule">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-4xl font-bold text-masthead tracking-tight">{categoryName}</h2>
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onManageFeeds}
                  >
                    <Settings size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manage feeds & settings</TooltipContent>
              </Tooltip>
              {summary && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={sendToTelegram}
                      disabled={sending}
                    >
                      <Send size={18} className={sending ? 'animate-pulse' : ''} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{sent ? 'Sent!' : 'Send to Telegram'}</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    onClick={onRefresh}
                    disabled={busy}
                  >
                    <RefreshCw size={18} className={busy ? 'animate-spin' : ''} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{refreshing ? 'Refreshing...' : 'Refresh'}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                  >
                    <Trash2 size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete category</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        {summary && (
          <p className="text-xs text-ink-muted mt-1.5 font-light">
            {summary.article_count} articles from {summary.feed_count} sources
            &nbsp;&middot;&nbsp;
            {new Date(summary.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {summary.provider && <>&nbsp;&middot;&nbsp;{summary.provider}</>}
          </p>
        )}
      </div>

      {(loading || refreshing) && !summary && (
        <div className="py-24 space-y-4">
          <Skeleton className="w-48 h-8 mx-auto" />
          <Skeleton className="w-64 h-4 mx-auto" />
          <Skeleton className="w-32 h-4 mx-auto" />
        </div>
      )}

      {error && !rateLimitDismissed && rateLimitInfo?.isRateLimit && (
        <RateLimitDialog
          error={error}
          open={true}
          onClose={() => setRateLimitDismissed(true)}
        />
      )}

      {telegramError && (
        <Dialog open={true} onOpenChange={() => setTelegramError(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <Send size={16} className="text-accent" />
                Telegram Error
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">{telegramError}</p>
              <Button variant="outline" onClick={() => setTelegramError(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {error && !rateLimitInfo?.isRateLimit && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load summary</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {summary && sections.length > 0 && (
        <div className="pt-8 pb-12 space-y-4">
          {sections.map((section, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                  {section.sentiment && (
                    <SentimentBadge sentiment={section.sentiment} />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-[15px] leading-[1.8] text-ink font-[family-name:var(--font-body)]">
                  {section.content}
                </p>
              </CardContent>
              {section.url && (
                <CardFooter>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a href={section.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={12} />
                      Read full article
                    </a>
                  </Button>
                </CardFooter>
              )}
            </Card>
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
    </div>
  );
}
