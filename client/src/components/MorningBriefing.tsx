import { useState, useRef, useEffect } from 'react';
import { RefreshCw, AlertCircle, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Briefing } from '../types';
import { API_BASE } from '../config';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Card, CardContent } from './ui/card';

interface Props {
  briefing: Briefing | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}

const headingComponents = {
  h1: ({ children }: { children: React.ReactNode }) => (
    <h1 className="font-serif text-2xl font-bold text-ink leading-tight">{children}</h1>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2 className="font-serif text-xl font-bold text-ink leading-snug">{children}</h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold text-ink-muted">{children}</h3>
  ),
};

const contentComponents = {
  p: ({ children }: { children: React.ReactNode }) => (
    <p className="text-[16px] leading-[1.8] text-ink font-[family-name:var(--font-body)] break-words [overflow-wrap:anywhere]">
      {children}
    </p>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="font-bold text-ink">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
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

function BriefingContent({ summary }: { summary: string }) {
  const blocks = summary.split(/\n\n+/).filter((b) => b.trim());

  return (
    <div className="pt-2 md:pt-8 pb-12 space-y-1 md:space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim();

        // Horizontal rule
        if (/^-{3,}$/.test(trimmed)) {
          return (
            <div key={i} className="py-2 flex items-center gap-4">
              <div className="flex-1 h-px bg-rule" />
              <div className="w-1 h-1 bg-ink-muted rotate-45" />
              <div className="flex-1 h-px bg-rule" />
            </div>
          );
        }

        // Section heading
        if (/^#{1,6} /.test(trimmed)) {
          return (
            <div key={i} className="pt-4 pb-1 first:pt-0">
              <ReactMarkdown components={headingComponents}>{trimmed}</ReactMarkdown>
            </div>
          );
        }

        // List block — keep as-is (rare in briefings but handle gracefully)
        if (/^[-*] /.test(trimmed) || /^\d+\. /.test(trimmed)) {
          return (
            <article key={i} className="-mx-4 px-4 py-1.5 border-y border-rule/60 bg-paper-dark/70 md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-y-0">
              <Card className="border-0 bg-transparent md:bg-paper-dark md:border md:border-rule overflow-hidden min-w-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
                <CardContent className="px-0 md:px-5 pt-4 pb-5">
                  <ReactMarkdown components={contentComponents}>{trimmed}</ReactMarkdown>
                </CardContent>
              </Card>
            </article>
          );
        }

        // Article paragraph → Card
        return (
          <article key={i} className="-mx-4 px-4 py-1.5 border-y border-rule/60 bg-paper-dark/70 md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-y-0">
            <Card className="border-0 bg-transparent md:bg-paper-dark md:border md:border-rule overflow-hidden min-w-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
              <CardContent className="px-0 md:px-5 pt-4 pb-5">
                <ReactMarkdown components={contentComponents}>{trimmed}</ReactMarkdown>
              </CardContent>
            </Card>
          </article>
        );
      })}
    </div>
  );
}

export function MorningBriefing({ briefing, loading, error, onGenerate }: Props) {
  const [tgSending, setTgSending] = useState(false);
  const [tgSent, setTgSent] = useState(false);
  const tgTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (tgTimerRef.current) clearTimeout(tgTimerRef.current); };
  }, []);

  const sendDigestToTelegram = async () => {
    setTgSending(true);
    setTgSent(false);
    try {
      const resp = await fetch(`${API_BASE}/telegram/digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (data.success) {
        setTgSent(true);
        if (tgTimerRef.current) clearTimeout(tgTimerRef.current);
        tgTimerRef.current = setTimeout(() => setTgSent(false), 3000);
      }
    } catch {
      // silent fail
    } finally {
      setTgSending(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-8 pb-4 md:border-b md:border-rule">
        <div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-masthead tracking-tight">Morning Briefing</h2>
          {briefing && (
            <p className="text-xs text-ink-muted mt-1.5 font-light">
              {new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {briefing.provider && <>&nbsp;&middot;&nbsp;{briefing.provider}</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={sendDigestToTelegram} disabled={tgSending || tgSent || !briefing}>
            <Send size={12} className={tgSending ? 'animate-pulse' : ''} />
            {tgSent ? 'Sent!' : tgSending ? 'Sending…' : 'Send to Telegram'}
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>

      {loading && !briefing && (
        <div className="pt-8 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-3 px-2">
              <Skeleton className="w-3/4 h-5" />
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-5/6 h-4" />
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
          <p className="font-serif text-xl text-ink-muted italic">Click Generate to create your morning briefing</p>
        </div>
      )}
    </div>
  );
}
