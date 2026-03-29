import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../../config';
import type { SteelmanResponse } from '../../types/lens';

interface BiasRadarSteelmanProps {
  headline: string;
  content: string;
  language?: string;
}

type SteelState = 'input' | 'loading' | 'result' | 'rebuttal' | 'challenge' | 'error';

export default function BiasRadarSteelman({ headline, content, language }: BiasRadarSteelmanProps) {
  const [position, setPosition] = useState('');
  const [state, setState] = useState<SteelState>('input');
  const [result, setResult] = useState<SteelmanResponse | null>(null);
  const [rebuttal, setRebuttal] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function submitPosition() {
    if (!position.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState('loading');

    const articleContext = `${headline}\n\n${content.slice(0, 1500)}`;

    try {
      const res = await fetch(`${API_BASE}/bias-radar/steelman`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPosition: position, articleContext, language }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SteelmanResponse = await res.json();
      if (!data.counterArgument) throw new Error('Invalid response');
      setResult(data);
      setState('result');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setState('error');
    }
  }

  // Input step
  if (state === 'input') {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="rounded-lg bg-paper-dark border border-rule px-4 py-3">
          <p className="text-sm font-medium text-ink mb-1">How this works</p>
          <p className="text-xs text-ink-muted leading-relaxed">
            State your view on this story. We will generate the strongest possible
            counter-argument — not to change your mind, but to sharpen it.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Your position on this story:
          </label>
          <textarea
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g. 'I think the government's policy here is misguided because…'"
            rows={3}
            maxLength={300}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:border-ink transition-colors"
          />
          <p className="mt-1 text-right text-xs text-ink-muted">{position.length}/300</p>
        </div>

        <button
          onClick={submitPosition}
          disabled={!position.trim()}
          className="w-full rounded-lg bg-ink py-3 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Challenge my view
        </button>
      </div>
    );
  }

  // Loading
  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm text-ink-muted" role="status">
        <span className="animate-pulse text-2xl mb-3">🤔</span>
        Building the strongest counter-argument…
      </div>
    );
  }

  // Error
  if (state === 'error') {
    return (
      <div
        className="rounded-lg border px-4 py-4 mx-4 my-4"
        style={{ backgroundColor: 'var(--accent-error-bg)', borderColor: 'var(--accent-error-border)' }}
        role="alert"
      >
        <p className="text-sm mb-3" style={{ color: 'var(--accent-error-text-strong)' }}>
          Something went wrong.
        </p>
        <button
          onClick={() => submitPosition()}
          className="text-sm underline"
          style={{ color: 'var(--accent-error-text)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Result, rebuttal, challenge
  if ((state === 'result' || state === 'rebuttal' || state === 'challenge') && result) {
    return (
      <div className="px-4 py-4 space-y-4">
        {/* User's position */}
        <div className="rounded-lg bg-paper-dark border border-rule px-4 py-3">
          <p className="text-xs text-ink-muted mb-1">Your position</p>
          <p className="text-sm text-ink break-words">"{position}"</p>
        </div>

        {/* Steelman counter-argument */}
        <div style={{ backgroundColor: 'var(--accent-info-bg)', borderColor: 'var(--accent-info-border)' }} className="rounded-lg border px-4 py-3 space-y-2">
          <p style={{ color: 'var(--accent-info-text)' }} className="text-xs font-semibold uppercase tracking-wide">
            Counter-argument (steelman)
          </p>
          <p style={{ color: 'var(--accent-info-text-strong)' }} className="text-sm leading-relaxed">
            {result.counterArgument}
          </p>
        </div>

        {/* How convincing was it? */}
        {state === 'result' && (
          <div>
            <p className="text-sm text-ink mb-2">How convincing was that?</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  aria-label={`Rate ${n} out of 5`}
                  onClick={() => { setState('rebuttal'); }}
                  className="flex-1 rounded-md border border-rule py-2 text-xs hover:bg-paper-dark transition-colors"
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-ink-muted mt-1 px-0.5">
              <span>Not at all</span>
              <span>Very</span>
            </div>
          </div>
        )}

        {/* Rebuttal step */}
        {state === 'rebuttal' && (
          <div className="space-y-2">
            <label className="block text-sm text-ink">
              Your one-sentence rebuttal (optional):
            </label>
            <textarea
              value={rebuttal}
              onChange={(e) => setRebuttal(e.target.value)}
              placeholder="What's the flaw in that argument?"
              rows={2}
              maxLength={200}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:border-ink transition-colors"
            />
            <button
              onClick={() => setState('challenge')}
              className="w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-paper hover:opacity-90 transition-opacity"
            >
              {rebuttal.trim() ? 'See follow-up →' : 'Skip to follow-up →'}
            </button>
          </div>
        )}

        {/* Follow-up question */}
        {state === 'challenge' && (
          result.followUpQuestion ? (
            <div style={{ backgroundColor: 'var(--accent-warn-bg)', borderColor: 'var(--accent-warn-border)' }} className="rounded-lg border px-4 py-3">
              <p style={{ color: 'var(--accent-warn-text)' }} className="text-xs font-semibold uppercase tracking-wide mb-1">
                Sit with this question
              </p>
              <p style={{ color: 'var(--accent-warn-text-strong)' }} className="text-sm">{result.followUpQuestion}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-paper-dark border border-rule px-4 py-3">
              <p className="text-sm text-ink-muted">
                No follow-up question this time. Reflect on the counter-argument above — what would you need to see to change your mind?
              </p>
            </div>
          )
        )}

        {/* Start over */}
        {(state === 'challenge' || state === 'rebuttal') && (
          <button
            onClick={() => {
              setPosition('');
              setResult(null);
              setRebuttal('');
              setState('input');
            }}
            className="w-full text-xs text-ink-muted underline hover:text-ink transition-colors"
          >
            Try a different position
          </button>
        )}
      </div>
    );
  }

  return null;
}
