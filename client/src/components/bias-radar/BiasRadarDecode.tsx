import { useState, useEffect, useRef } from 'react';
import TechniquePicker from './TechniquePicker';
import TechniqueCard from './TechniqueCard';
import type { TechniqueResult, TechniqueName } from '../../types/lens';
import { API_BASE } from '../../config';

interface BiasRadarDecodeProps {
  headline: string;
  content: string;
}

type State = 'idle' | 'loading' | 'done' | 'error';
type Stage = 'scanning' | 'guess' | 'result';

export default function BiasRadarDecode({ headline, content }: BiasRadarDecodeProps) {
  const [scanState, setScanState] = useState<State>('idle');
  const [stage, setStage] = useState<Stage>('scanning');
  const [result, setResult] = useState<TechniqueResult | null>(null);
  const [userGuess, setUserGuess] = useState<TechniqueName | null>(null);
  const [feedback, setFeedback] = useState<'obvious' | 'surprising' | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  async function analyze() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    
    setScanState('loading');
    try {
      const res = await fetch(`${API_BASE}/bias-radar/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, content }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error('API error');
      const data: TechniqueResult = await res.json();
      if (!data.technique) throw new Error('Invalid response');
      setResult(data);
      setScanState('done');
      setStage('guess');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setScanState('error');
    }
  }

  function handleGuess(guess: TechniqueName) {
    setUserGuess(guess);
    setStage('result');
  }

  if (scanState === 'idle') {
    return (
      <div className="px-4 py-4 space-y-4">
        <p className="text-sm text-ink-muted">
          This article will be analyzed for common manipulation techniques — framing choices, emotional language, logical gaps.
        </p>
        <button
          onClick={analyze}
          className="w-full py-3 bg-ink text-paper text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Scan this article
        </button>
      </div>
    );
  }

  if (scanState === 'loading') {
    return (
      <div className="px-4 py-4 text-center text-sm text-ink-muted">
        Scanning…
      </div>
    );
  }

  if (scanState === 'error') {
    return (
      <div className="px-4 py-4 text-center">
        <p className="text-sm text-red-500">Something went wrong. Try again?</p>
        <button onClick={analyze} className="mt-2 text-sm underline text-ink-muted">
          Retry
        </button>
      </div>
    );
  }

  if (scanState === 'done' && result) {
    if (stage === 'guess') {
      return (
        <div className="px-4 pt-4">
          <div className="rounded-lg bg-paper-dark border border-rule px-4 py-3 mb-2">
            <p className="text-xs text-ink-muted mb-1">Article scanned</p>
            <p className="text-sm font-medium text-ink">{headline}</p>
          </div>
          <TechniquePicker onSelect={handleGuess} />
        </div>
      );
    }

    if (stage === 'result' && userGuess) {
      const correct = userGuess === result.technique;

      return (
        <div className="px-4 py-4 space-y-4">
          <div className={`rounded-lg border px-4 py-3 ${
            correct 
              ? 'border-green-200 bg-green-50' 
              : 'border-orange-200 bg-orange-50'
          }`}>
            <p className={`text-sm font-medium ${
              correct ? 'text-green-800' : 'text-orange-800'
            }`}>
              {correct ? 'You got it!' : 'Not quite'}
            </p>
            <p className={`text-xs mt-0.5 ${
              correct ? 'text-green-600' : 'text-orange-600'
            }`}>
              You guessed: <strong>{userGuess}</strong>
              {!correct && <> · Answer: <strong>{result.technique}</strong></>}
            </p>
          </div>

          <TechniqueCard result={result} />

          {!feedback && (
            <div className="pt-2">
              <p className="text-xs text-ink-muted mb-2">Was this obvious to you before you read the analysis?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeedback('obvious')}
                  className="flex-1 py-2 text-xs border border-rule rounded-md hover:bg-paper-dark"
                >
                  I saw it
                </button>
                <button
                  onClick={() => setFeedback('surprising')}
                  className="flex-1 py-2 text-xs border border-rule rounded-md hover:bg-paper-dark"
                >
                  Did not notice
                </button>
              </div>
            </div>
          )}

          {feedback === 'obvious' && (
            <p className="text-xs text-ink bg-paper-dark rounded-md p-3">
              Good eye! You spotted it without help.
            </p>
          )}

          {feedback === 'surprising' && (
            <p className="text-xs text-ink bg-paper-dark rounded-md p-3">
              That is the point — these techniques work because they are subtle. You will spot it faster next time.
            </p>
          )}
        </div>
      );
    }
  }

  return null;
}