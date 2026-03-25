import { RefreshCw, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  briefing: { summary: string; generated_at: string; provider?: string } | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}

export function MorningBriefing({ briefing, loading, error, onGenerate }: Props) {
  return (
    <div>
      <div className="flex items-end justify-between pt-8 pb-4 border-b border-rule">
        <div>
          <h2 className="font-serif text-4xl font-bold text-masthead tracking-tight">Morning Briefing</h2>
          {briefing && (
            <p className="text-xs text-ink-muted mt-1.5 font-light">
              {new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {briefing.provider && <>&nbsp;&middot;&nbsp;{briefing.provider}</>}
            </p>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] font-medium cursor-pointer transition-all border border-ink text-ink hover:bg-ink hover:text-paper disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Generating' : 'Generate'}
        </button>
      </div>

      {loading && !briefing && (
        <div className="py-24 text-center">
          <div className="inline-block w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-ink-muted font-light">Generating morning briefing...</p>
        </div>
      )}

      {error && (
        <div className="mt-8 p-5 border border-accent/30 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-accent mt-0.5 shrink-0" />
            <p className="text-sm text-accent">{error}</p>
          </div>
        </div>
      )}

      {briefing && (
        <article className="pt-8 pb-12">
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="text-[17px] leading-[1.85] text-ink mb-5 max-w-[65ch] font-[family-name:var(--font-body)] font-medium">
                  {children}
                </p>
              ),
              strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
              h2: ({ children }) => (
                <h2 className="font-serif text-2xl font-bold text-ink mt-10 mb-3">{children}</h2>
              ),
              hr: () => (
                <div className="my-5 flex items-center gap-4">
                  <div className="flex-1 h-px bg-rule" />
                  <div className="w-1 h-1 bg-ink-muted rotate-45" />
                  <div className="flex-1 h-px bg-rule" />
                </div>
              ),
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
