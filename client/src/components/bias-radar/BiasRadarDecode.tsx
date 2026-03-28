import { useState } from 'react';
import TechniqueCard from './TechniqueCard';
import type { TechniqueResult } from '../../types/lens';
import { API_BASE } from '../../config';

interface BiasRadarDecodeProps {
  headline: string;
  content: string;
}

type State = 'idle' | 'loading' | 'done' | 'error';

export default function BiasRadarDecode({ headline, content }: BiasRadarDecodeProps) {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<TechniqueResult | null>(null);
  const [feedback, setFeedback] = useState<'obvious' | 'surprising' | null>(null);

  async function analyze() {
    setState('loading');
    try {
      const res = await fetch(`${API_BASE}/bias-radar/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, content }),
      });
      if (!res.ok) throw new Error('API error');
      const data: TechniqueResult = await res.json();
      setResult(data);
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-sm text-ink-muted">
        This article will be analyzed for common manipulation techniques — framing choices, emotional language, logical gaps.
      </p>

      {state === 'idle' && (
        <button
          onClick={analyze}
          className="w-full py-3 bg-ink text-paper text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Scan this article
        </button>
      )}

      {state === 'loading' && (
        <div className="text-center py-8 text-sm text-ink-muted">Scanning…</div>
      )}

      {state === 'error' && (
        <div className="text-center py-4">
          <p className="text-sm text-red-500">Something went wrong. Try again?</p>
          <button onClick={analyze} className="mt-2 text-sm underline text-ink-muted">
            Retry
          </button>
        </div>
      )}

      {state === 'done' && result && (
        <>
          <TechniqueCard result={result} />

          {!feedback && (
            <div className="pt-2">
              <p className="text-xs text-ink-muted mb-2">Was this obvious to you before you read the analysis?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeedback('obvious')}
                  className="flex-1 py-2 text-xs border border-rule rounded-md hover:bg-paper-dark"
                >
                  👍 I saw it
                </button>
                <button
                  onClick={() => setFeedback('surprising')}
                  className="flex-1 py-2 text-xs border border-rule rounded-md hover:bg-paper-dark"
                >
                  💡 Didn't notice
                </button>
              </div>
            </div>
          )}

          {feedback === 'surprising' && (
            <p className="text-xs text-ink bg-paper-dark rounded-md p-3">
              That's the point — these techniques work <em>because</em> they're subtle. You'll spot it faster next time.
            </p>
          )}
        </>
      )}
    </div>
  );
}