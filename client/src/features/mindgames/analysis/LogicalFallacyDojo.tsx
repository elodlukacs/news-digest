import { useState, useRef, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Loader2, Sword, CheckCircle, XCircle, Zap, RotateCcw,
  ChevronDown, ChevronUp, Trophy,
} from 'lucide-react';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';
import { FeaturePanelHeader } from '../common';

interface DojoRound {
  sessionId: string;
  difficulty: string;
  topic: string;
  argument: string;
  fallacies: { name: string; evidence: string; explanation: string }[];
  hint: string;
  provider?: string;
}

interface DojoScore {
  hits: number;
  totalActual: number;
  totalIdentified: number;
  precision: number;
  recall: number;
  allCorrect: boolean;
  antibodiesEarned: number;
}

type Stage = 'config' | 'loading' | 'reading' | 'guessing' | 'result';

const FALLACY_OPTIONS = [
  'Ad Hominem', 'False Dichotomy', 'Appeal to Nature', 'Post Hoc',
  'Appeal to Emotion', 'Straw Man', 'Bandwagon', 'Slippery Slope',
  'Appeal to Authority', 'Red Herring', 'Appeal to Tradition',
  'False Equivalence', "Gambler's Fallacy", 'Cherry Picking',
];

const DIFFICULTY_INFO: Record<string, { label: string; desc: string; fallacies: number }> = {
  beginner: { label: 'Beginner', desc: 'One obvious fallacy', fallacies: 1 },
  intermediate: { label: 'Intermediate', desc: 'Two fallacies, one subtle', fallacies: 2 },
  expert: { label: 'Expert', desc: '2-3 fallacies, deeply embedded', fallacies: 3 },
};

export function LogicalFallacyDojo() {
  const selectedLlm = useLlm();
  const [stage, setStage] = useState<Stage>('config');
  const [difficulty, setDifficulty] = useState<string>('beginner');
  const [round, setRound] = useState<DojoRound | null>(null);
  const [selectedFallacies, setSelectedFallacies] = useState<Set<string>>(new Set());
  const [score, setScore] = useState<DojoScore | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [expandedFallacy, setExpandedFallacy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [roundCount, setRoundCount] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const generateRound = useCallback(async (diff: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStage('loading');
    setError('');
    setScore(null);
    setSelectedFallacies(new Set());
    setShowHint(false);
    setExpandedFallacy(null);

    try {
      const res = await fetch(`${API_BASE}/fallacy-dojo/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: diff, provider: selectedLlm }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate');
      const data = await res.json();
      setRound(data);
      setStage('reading');
      startTimeRef.current = 0;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to generate');
      setStage('config');
    }
  }, [selectedLlm]);

  const toggleFallacy = (name: string) => {
    setSelectedFallacies(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const submitGuess = async () => {
    if (!round || selectedFallacies.size === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStage('loading');
    const timeToIdentify = startTimeRef.current ? Date.now() - startTimeRef.current : 30000;

    try {
      const res = await fetch(`${API_BASE}/fallacy-dojo/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: round.sessionId,
          userFallacies: [...selectedFallacies],
          actualFallacies: round.fallacies.map(f => f.name),
          timeToIdentify,
          difficulty: round.difficulty,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('Failed to score answer');
      const data = await res.json();
      setScore(data);
      setRoundCount(c => c + 1);
      if (data.allCorrect) setTotalCorrect(c => c + 1);
      setStage('result');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('Dojo answer error:', err);
      setError('Failed to score answer');
      setStage('result');
    }
  };

  const nextRound = () => {
    generateRound(difficulty);
  };

  const reset = () => {
    setStage('config');
    setRound(null);
    setScore(null);
    setSelectedFallacies(new Set());
    setRoundCount(0);
    setTotalCorrect(0);
    setError('');
  };

  return (
    <Card className="p-5 md:p-6 flex flex-col gap-5">
      <FeaturePanelHeader
        icon={<Sword size={22} className="text-curiosity shrink-0" />}
        title="Logical Fallacy Dojo"
        subtitle="Spar with an AI that crafts arguments hiding logical fallacies."
        infoTitle="Logical Fallacy Dojo"
        researcher="David Robert Grimes · Critical Thinking"
        summary="The AI generates persuasive arguments with deliberately embedded logical fallacies. Your job is to identify which fallacies are being used. Three difficulty tiers: from obvious to deeply embedded."
        sections={[
          { heading: 'How It Works', content: 'The Sensei generates an argument on a random topic. Hidden inside are 1-3 logical fallacies depending on difficulty. Pick the correct fallacy types from the list to earn points.' },
          { heading: 'Difficulty Tiers', items: [
            'Beginner: One obvious fallacy (ad hominem, false dichotomy, bandwagon)',
            'Intermediate: Two fallacies, one subtle (post hoc, cherry picking, straw man)',
            'Expert: 2-3 fallacies woven into sophisticated rhetoric',
          ]},
        ]}
      />

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-200">{error}</div>
      )}

      {/* Config */}
      {stage === 'config' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-ink mb-2">Choose difficulty</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DIFFICULTY_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                    difficulty === key
                      ? 'border-ink bg-paper-dark'
                      : 'border-rule hover:border-ink-muted'
                  }`}
                >
                  <p className="text-sm font-semibold text-ink">{info.label}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{info.desc}</p>
                  <p className="text-xs text-ink-muted">{info.fallacies} fallacy/fallacies</p>
                </button>
              ))}
            </div>
          </div>

          {roundCount > 0 && (
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <Trophy size={14} />
              <span>{totalCorrect}/{roundCount} perfect rounds</span>
            </div>
          )}

          <Button onClick={() => generateRound(difficulty)} className="w-full gap-2 h-11">
            <Sword size={16} /> Start Sparring
          </Button>
        </div>
      )}

      {/* Loading */}
      {stage === 'loading' && (
        <div className="flex items-center justify-center py-12 gap-2 text-ink-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">The Sensei is crafting an argument...</span>
        </div>
      )}

      {/* Reading */}
      {stage === 'reading' && round && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs capitalize">
              {round.difficulty} — {round.topic}
            </Badge>
            {roundCount > 0 && (
              <span className="text-xs text-ink-muted">{totalCorrect}/{roundCount} perfect</span>
            )}
          </div>

          <div className="p-4 rounded-lg border-2 border-rule bg-paper-dark">
            <p className="text-base font-serif text-ink leading-relaxed whitespace-pre-wrap">{round.argument}</p>
          </div>

          {round.hint && (
            <div>
              <button
                onClick={() => setShowHint(h => !h)}
                className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                {showHint ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showHint ? 'Hide hint' : 'Show hint'}
              </button>
              {showHint && (
                <p className="text-xs text-curiosity mt-1 pl-4 border-l-2 border-curiosity/30">{round.hint}</p>
              )}
            </div>
          )}

          <Button
            onClick={() => { setStage('guessing'); startTimeRef.current = Date.now(); }}
            className="w-full gap-2 h-11"
          >
            I see the fallacies <Zap size={16} />
          </Button>
        </div>
      )}

      {/* Guessing */}
      {stage === 'guessing' && round && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink">
            Which fallacies are hidden in this argument?{' '}
            <span className="text-ink-muted font-normal">
              (select {DIFFICULTY_INFO[round.difficulty].fallacies})
            </span>
          </p>

          <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
            {FALLACY_OPTIONS.map(name => {
              const isSelected = selectedFallacies.has(name);
              return (
                <button
                  key={name}
                  onClick={() => toggleFallacy(name)}
                  className={`text-left px-3 py-2 rounded-md text-xs border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-ink bg-ink text-paper font-semibold'
                      : 'border-rule bg-paper text-ink hover:border-ink-muted'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <Button
            onClick={submitGuess}
            disabled={selectedFallacies.size === 0}
            className="w-full gap-2 h-11"
          >
            <Sword size={16} /> Score my guess
          </Button>
        </div>
      )}

      {/* Result */}
      {stage === 'result' && round && score && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border text-center ${
            score.allCorrect
              ? 'border-green-200 bg-green-50'
              : score.hits > 0
                ? 'border-orange-200 bg-orange-50'
                : 'border-red-200 bg-red-50'
          }`}>
            {score.allCorrect ? (
              <>
                <CheckCircle size={24} className="text-green-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-800">Perfect!</p>
              </>
            ) : (
              <>
                <XCircle size={24} className="text-orange-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-orange-800">
                  {score.hits}/{score.totalActual} identified
                </p>
              </>
            )}
            <p className="text-xs text-ink-muted mt-1">
              {score.precision}% precision · {score.recall}% recall
              {score.antibodiesEarned > 0 && ` · +${score.antibodiesEarned} antibodies`}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Fallacies in this argument</p>
            {round.fallacies.map((f, i) => {
              const found = selectedFallacies.has(f.name);
              const expanded = expandedFallacy === f.name;
              return (
                <div
                  key={i}
                  className={`rounded-lg border ${found ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}
                >
                  <button
                    onClick={() => setExpandedFallacy(expanded ? null : f.name)}
                    className="w-full flex items-center justify-between p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {found
                        ? <CheckCircle size={14} className="text-green-600" />
                        : <XCircle size={14} className="text-orange-600" />
                      }
                      <span className="text-sm font-semibold text-ink">{f.name}</span>
                    </div>
                    {expanded ? <ChevronUp size={14} className="text-ink-muted" /> : <ChevronDown size={14} className="text-ink-muted" />}
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-rule/50 pt-2">
                      <div>
                        <p className="text-xs text-ink-muted mb-0.5">Evidence</p>
                        <p className="text-sm text-ink italic">&ldquo;{f.evidence}&rdquo;</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted mb-0.5">Why this is a fallacy</p>
                        <p className="text-sm text-ink">{f.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button onClick={nextRound} className="flex-1 gap-2 h-11">
              <Zap size={16} /> Next Round
            </Button>
            <Button onClick={reset} variant="outline" className="gap-2 h-11">
              <RotateCcw size={16} />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
