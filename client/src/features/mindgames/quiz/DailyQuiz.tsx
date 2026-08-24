import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';
import TechniquePicker from '../bias-radar/TechniquePicker';
import TechniqueCard from '../bias-radar/TechniqueCard';
import type { TechniqueName, TechniqueResult } from '../../../types/lens';
import { safeHref } from '../../../utils/safeHref';

interface QuizArticle {
  id: number;
  headline: string;
  content: string;
  source: string;
  url: string;
  biasRating: string;
}

type Stage = 'loading' | 'reading' | 'guessing' | 'scanning' | 'result';

interface DailyQuizProps {
  onCorrect?: () => void;
}

export function DailyQuiz({ onCorrect }: DailyQuizProps) {
  const selectedLlm = useLlm();
  const [stage, setStage] = useState<Stage>('loading');
  const [article, setArticle] = useState<QuizArticle | null>(null);
  const [userGuess, setUserGuess] = useState<TechniqueName | null>(null);
  const [result, setResult] = useState<TechniqueResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rewardedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`${API_BASE}/bias-radar/daily-quiz`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load daily quiz');
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.error) {
          setError(data.error);
          setStage('result');
        } else {
          setArticle(data.article);
          setStage('reading');
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError('Failed to load daily quiz');
          setStage('result');
        }
      });

    return () => controller.abort();
  }, []);

  async function handleGuess(guess: TechniqueName) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    
    if (!article) return;
    setUserGuess(guess);
    setStage('scanning');
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/bias-radar/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: article.headline, content: article.content, provider: selectedLlm }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error('Failed to analyze');
      const data = await res.json();
      if (!data.technique) {
        setError(data.error || 'Failed to analyze article');
        setStage('result');
        return;
      }
      setResult(data as TechniqueResult);
      setStage('result');

      const correct = guess === data.technique;
      if (correct && onCorrect && !rewardedRef.current) {
        rewardedRef.current = true;
        onCorrect();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Failed to analyze article');
      setStage('result');
    }
  }

  if (stage === 'loading') {
    return (
      <div className="p-8 text-center text-ink-muted">
        Loading today's quiz...
      </div>
    );
  }

  if (stage === 'result' && error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-center">
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm underline text-ink-muted"
        >
          Try again tomorrow
        </button>
      </div>
    );
  }

  if (stage === 'reading' && article) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-1">Daily Technique Quiz</p>
          <h1 className="text-xl font-serif font-bold text-ink">What technique is this?</h1>
        </div>

        <div className="rounded-xl border-2 border-rule bg-paper-dark px-5 py-5 space-y-3">
          <p className="text-xs text-ink-muted">{article.source}</p>
          <p className="text-lg font-serif font-semibold text-ink leading-snug">{article.headline}</p>
          <p className="text-sm text-ink-muted line-clamp-4">{article.content?.slice(0, 300)}</p>
          <a 
            href={safeHref(article.url)} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-blue-600 underline"
          >
            Read full article →
          </a>
          <button
            onClick={() => setStage('guessing')}
            className="mt-3 w-full rounded-lg bg-ink py-3 text-sm font-semibold text-paper hover:bg-ink/90 transition-colors cursor-pointer"
          >
            I have read it — guess the technique →
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'guessing') {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-1">Daily Technique Quiz</p>
          <h1 className="text-xl font-serif font-bold text-ink">What technique is this?</h1>
          <p className="text-sm text-ink-muted mt-1">{article?.headline}</p>
        </div>
        <TechniquePicker onSelect={handleGuess} />
      </div>
    );
  }

  if (stage === 'scanning') {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-center text-ink-muted">
        <span className="text-2xl block mb-2">Scanning...</span>
      </div>
    );
  }

  if (stage === 'result' && result && userGuess) {
    const correct = userGuess === result.technique;

    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-1">Daily Technique Quiz</p>
        </div>

        <div className={`rounded-lg border px-4 py-3 ${
          correct 
            ? 'border-green-200 bg-green-50' 
            : 'border-orange-200 bg-orange-50'
        }`}>
          <p className={`text-sm font-semibold ${
            correct ? 'text-green-800' : 'text-orange-800'
          }`}>
            {correct ? 'Correct!' : 'Close — here is what it was'}
          </p>
          {userGuess !== result.technique && (
            <p className="text-xs text-orange-600 mt-0.5">
              You guessed: {userGuess} · Answer: {result.technique}
            </p>
          )}
        </div>

        <TechniqueCard result={result} />
        <p className="text-center text-xs text-ink-muted">Come back tomorrow for a new one.</p>
      </div>
    );
  }

  return null;
}
