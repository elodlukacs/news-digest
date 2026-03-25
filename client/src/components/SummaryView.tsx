import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { RefreshCw, AlertCircle, Clock, X, Zap, Send } from 'lucide-react';
import { SentimentBadge } from './SentimentBadge';
import { ChatPanel } from './ChatPanel';
import type { Summary, ChatMessage } from '../types';

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

function RateLimitModal({ error, onClose }: { error: string; onClose: () => void }) {
  const info = parseRateLimitError(error);
  const usagePercent = info.used && info.limit ? Math.round((info.used / info.limit) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-paper border border-rule shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
          <div className="flex items-center gap-2.5">
            <Clock size={16} className="text-masthead" />
            <h3 className="font-serif text-lg font-bold text-ink">Rate Limit Reached</h3>
          </div>
          <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-ink leading-relaxed">
            The AI provider has temporarily limited requests. This is normal on the free tier.
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-4 py-3 bg-paper-dark border border-rule">
              <span className="text-xs text-ink-muted uppercase tracking-wider">Wait time</span>
              <span className="font-serif font-bold text-masthead">{info.waitTime}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-paper-dark border border-rule">
              <span className="text-xs text-ink-muted uppercase tracking-wider">Model</span>
              <span className="text-sm font-medium text-ink">{info.model}</span>
            </div>
            {usagePercent !== null && (
              <div className="px-4 py-3 bg-paper-dark border border-rule">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-ink-muted uppercase tracking-wider">Daily usage</span>
                  <span className="text-sm font-medium text-ink">{usagePercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-rule rounded-full overflow-hidden">
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
      </div>
    </div>
  );
}

interface Props {
  categoryId: number;
  categoryName: string;
  summary: Summary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onLoad: () => void;
  onRefresh: () => void;
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
  onLoad,
  onRefresh,
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
      const resp = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });
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
  const categoryRef = React.useRef(categoryName);
  const initialLoad = React.useRef(true);
  const sectionIndexRef = useRef(0);

  useEffect(() => {
    setRateLimitDismissed(false);
  }, [error]);
  useEffect(() => {
    if (initialLoad.current || categoryRef.current !== categoryName) {
      categoryRef.current = categoryName;
      initialLoad.current = false;
      onLoad();
    }
  }, [categoryName]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = loading || refreshing;
  // Reset section counter before each render of markdown
  sectionIndexRef.current = 0;

  return (
    <div>
      <div className="flex items-end justify-between pt-8 pb-4 border-b border-rule">
        <div>
          <h2 className="font-serif text-4xl font-bold text-masthead tracking-tight">{categoryName}</h2>
          {summary && (
            <p className="text-xs text-ink-muted mt-1.5 font-light">
              {summary.article_count} articles from {summary.feed_count} sources
              &nbsp;&middot;&nbsp;
              {new Date(summary.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {summary.provider && <>&nbsp;&middot;&nbsp;{summary.provider}</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {summary && (
            <button
              onClick={sendToTelegram}
              disabled={sending}
              title="Send to Telegram"
              className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] font-medium cursor-pointer transition-all duration-200 border border-rule text-ink-muted hover:border-masthead hover:text-masthead disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={13} className={sending ? 'animate-pulse' : ''} />
              {sent ? 'Sent!' : 'Telegram'}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] font-medium cursor-pointer transition-all duration-200 border border-ink text-ink hover:bg-ink hover:text-paper disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {(loading || refreshing) && !summary && (
        <div className="py-24 text-center">
          <div className="inline-block w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-ink-muted font-light">Fetching and summarizing feeds...</p>
        </div>
      )}

      {error && !rateLimitDismissed && parseRateLimitError(error).isRateLimit && (
        <RateLimitModal error={error} onClose={() => setRateLimitDismissed(true)} />
      )}

      {telegramError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 bg-paper border border-rule shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
              <div className="flex items-center gap-2.5">
                <Send size={16} className="text-accent" />
                <h3 className="font-serif text-lg font-bold text-ink">Telegram Error</h3>
              </div>
              <button onClick={() => setTelegramError(null)} className="p-1 text-ink-muted hover:text-ink cursor-pointer transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-ink leading-relaxed">{telegramError}</p>
              <button
                onClick={() => setTelegramError(null)}
                className="px-4 py-2 text-xs uppercase tracking-[0.15em] font-medium cursor-pointer transition-all duration-200 border border-ink text-ink hover:bg-ink hover:text-paper"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !parseRateLimitError(error).isRateLimit && (
        <div className="mt-8 p-5 border border-accent/30 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-accent">Failed to load summary</p>
              <p className="text-xs text-ink-muted mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <article className="pt-8 pb-12">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="font-serif text-3xl font-bold text-ink mt-12 mb-4 leading-tight">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="font-serif text-2xl font-bold text-ink mt-10 mb-3 leading-snug">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-serif text-xl font-semibold text-ink mt-8 mb-2 leading-snug">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="text-[17px] leading-[1.85] text-ink mb-5 max-w-[65ch] font-[family-name:var(--font-body)] font-medium">
                  {children}
                </p>
              ),
              ul: ({ children }) => <ul className="space-y-6 my-8">{children}</ul>,
              ol: ({ children }) => <ol className="space-y-6 my-8 list-decimal list-inside">{children}</ol>,
              li: ({ children }) => (
                <li className="text-[17px] leading-[1.85] text-ink pl-5 border-l-2 border-rule relative font-[family-name:var(--font-body)] font-medium pb-6 mb-6 border-b border-b-rule last:border-b-0 last:mb-0 last:pb-0">
                  <div>{children}</div>
                </li>
              ),
              strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink transition-colors cursor-pointer"
                >
                  {children}
                </a>
              ),
              hr: () => {
                const idx = sectionIndexRef.current++;
                const sentiment = summary.sentiment_data?.[idx + 1];
                return (
                  <div className="my-5">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-rule" />
                      <div className="w-1 h-1 bg-ink-muted rotate-45" />
                      <div className="flex-1 h-px bg-rule" />
                    </div>
                    {sentiment && (
                      <div className="mt-2">
                        <SentimentBadge sentiment={sentiment.sentiment} />
                      </div>
                    )}
                  </div>
                );
              },
            }}
          >
            {summary.summary}
          </ReactMarkdown>

          {/* First section sentiment badge */}
          {summary.sentiment_data?.[0] && (
            <div className="mt-2 -order-1" style={{ position: 'relative', top: '-2rem' }}>
              {/* Rendered inline above via the hr component */}
            </div>
          )}

          {/* Tags */}
          {summary.tags_data && summary.tags_data.length > 0 && (
            <div className="mt-8 pt-6 border-t border-rule">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink-muted mb-3">Topics</p>
              <div className="flex flex-wrap gap-2">
                {summary.tags_data.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-[11px] font-medium bg-paper-dark border border-rule text-ink-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chat */}
          {summary.id && <ChatPanel messages={chatMessages} sending={chatSending} onSend={onChatSend} />}
        </article>
      )}

      {!loading && !refreshing && !error && !summary && (
        <div className="py-24 text-center">
          <p className="font-serif text-xl text-ink-muted italic">Click refresh to load the latest summary</p>
        </div>
      )}
    </div>
  );
}
