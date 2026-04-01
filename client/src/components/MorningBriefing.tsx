import { useState, useRef, useEffect } from 'react';
import { RefreshCw, AlertCircle, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Briefing } from '../types';
import { API_BASE } from '../config';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';

interface Props {
  briefing: Briefing | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-8 pb-4 border-b border-rule">
        <div>
          <h2 className="font-serif text-4xl font-bold text-masthead tracking-tight">Morning Briefing</h2>
          {briefing && (
            <p className="text-xs text-ink-muted mt-1.5 font-light">
              {new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {briefing.provider && <>&nbsp;&middot;&nbsp;{briefing.provider}</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={sendDigestToTelegram} disabled={tgSending || tgSent || !briefing}>
            <Send size={12} className={tgSending ? 'animate-pulse' : ''} />
            {tgSent ? 'Sent!' : tgSending ? 'Sending…' : 'Send to Telegram'}
          </Button>
          <Button variant="outline" onClick={onGenerate} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Generating' : 'Generate'}
          </Button>
        </div>
      </div>

      {loading && !briefing && (
        <div className="py-24 space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <Skeleton className="h-4 w-56 mx-auto" />
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {briefing && (
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
              hr: () => (
                <div className="my-5 flex items-center gap-4">
                  <div className="flex-1 h-px bg-rule" />
                  <div className="w-1 h-1 bg-ink-muted rotate-45" />
                  <div className="flex-1 h-px bg-rule" />
                </div>
              ),
            }}
          >
            {briefing.summary}
          </ReactMarkdown>
        </article>
      )}

      {!loading && !error && !briefing && (
        <div className="py-24 text-center">
          <p className="font-serif text-xl text-ink-muted italic">Click Generate to create your morning briefing</p>
        </div>
      )}
    </div>
  );
}
