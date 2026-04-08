import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Eye, RotateCcw, Brain } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';

interface QuizQuestion {
  id: number;
  bias: string;
  biasLabel: string;
  scenario: string;
  options: string[];
  biasedIndex: number;
}

interface BiasProfile {
  [key: string]: number;
}

type Stage = 'intro' | 'quiz' | 'loading' | 'result';

const BIAS_KEYS = [
  'confirmation-bias', 'anchoring-bias', 'availability-heuristic',
  'dunning-kruger', 'sunk-cost-fallacy', 'bandwagon-effect',
  'authority-bias', 'negativity-bias', 'in-group-bias', 'framing-effect',
];

const BIAS_SHORT: Record<string, string> = {
  'confirmation-bias': 'Confirmation',
  'anchoring-bias': 'Anchoring',
  'availability-heuristic': 'Availability',
  'dunning-kruger': 'Dunning-Kruger',
  'sunk-cost-fallacy': 'Sunk Cost',
  'bandwagon-effect': 'Bandwagon',
  'authority-bias': 'Authority',
  'negativity-bias': 'Negativity',
  'in-group-bias': 'In-Group',
  'framing-effect': 'Framing',
};

function RadarChart({ profile }: { profile: BiasProfile }) {
  const cx = 125;
  const cy = 125;
  const maxR = 100;
  const levels = 5;

  const axes = BIAS_KEYS.map((key, i) => {
    const angle = (i / BIAS_KEYS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      key,
      label: BIAS_SHORT[key] || key,
      angle,
      x: cx + Math.cos(angle) * maxR,
      y: cy + Math.sin(angle) * maxR,
    };
  });

  const dataPoints = axes.map((axis) => {
    const value = profile[axis.key] || 0;
    const r = (value / 10) * maxR;
    return {
      x: cx + Math.cos(axis.angle) * r,
      y: cy + Math.sin(axis.angle) * r,
    };
  });

  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 250 250" className="w-full max-w-[280px] mx-auto">
      {/* Grid rings */}
      {Array.from({ length: levels }, (_, i) => {
        const r = ((i + 1) / levels) * maxR;
        const points = axes.map((a) => {
          const px = cx + Math.cos(a.angle) * r;
          const py = cy + Math.sin(a.angle) * r;
          return `${px},${py}`;
        }).join(' ');
        return (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="var(--color-rule)"
            strokeWidth={0.5}
            opacity={0.6}
          />
        );
      })}

      {/* Axis lines */}
      {axes.map((axis) => (
        <line
          key={axis.key}
          x1={cx}
          y1={cy}
          x2={axis.x}
          y2={axis.y}
          stroke="var(--color-rule)"
          strokeWidth={0.5}
          opacity={0.4}
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={polygon}
        fill="var(--color-outrage)"
        fillOpacity={0.15}
        stroke="var(--color-outrage)"
        strokeWidth={1.5}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-outrage)" />
      ))}

      {/* Labels */}
      {axes.map((axis) => {
        const labelR = maxR + 18;
        const lx = cx + Math.cos(axis.angle) * labelR;
        const ly = cy + Math.sin(axis.angle) * labelR;
        return (
          <text
            key={axis.key}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[8px] fill-ink-muted font-sans"
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

export function BiasMirrorPanel() {
  const [stage, setStage] = useState<Stage>('intro');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<{ bias: string; selectedIndex: number; biasedIndex: number }[]>([]);
  const [profile, setProfile] = useState<BiasProfile | null>(null);
  const [biasLabels, setBiasLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Load existing profile on mount
    fetch(`${API_BASE}/bias-mirror/profile`)
      .then(r => r.json())
      .then(data => {
        if (data.hasData) {
          setProfile(data.profile);
          setBiasLabels(data.biasLabels || {});
          setStage('result');
        }
      })
      .catch(() => {});
  }, []);

  const startQuiz = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStage('loading');
    setError('');

    try {
      const res = await fetch(`${API_BASE}/bias-mirror/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('Failed to load quiz');
      const data = await res.json();
      setQuestions(data.questions);
      setCurrentQ(0);
      setAnswers([]);
      setStage('quiz');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError('Failed to load quiz');
      setStage('intro');
    }
  }, []);

  const handleAnswer = async (selectedIndex: number) => {
    const q = questions[currentQ];
    const newAnswers = [...answers, { bias: q.bias, selectedIndex, biasedIndex: q.biasedIndex }];
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
    } else {
      // Submit all answers
      setStage('loading');
      try {
        const res = await fetch(`${API_BASE}/bias-mirror/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: newAnswers }),
        });
        const data = await res.json();
        setProfile(data.profile);
        setBiasLabels(data.biasLabels || {});
        setStage('result');
      } catch {
        setError('Failed to save profile');
        setStage('intro');
      }
    }
  };

  return (
    <Card className="p-5 md:p-6 flex flex-col gap-4">
      <FeaturePanelHeader
        icon={<Eye size={20} className="text-curiosity shrink-0" />}
        title="Bias Mirror"
        infoTitle="Bias Mirror"
        researcher="Daniel Kahneman · Amos Tversky · Dan Ariely"
        summary="Discover your cognitive bias fingerprint. Answer 10 quick scenarios, each testing susceptibility to a different bias. The result is a personalized radar chart showing where your thinking is most vulnerable."
        sections={[
          { heading: '10 Biases Profiled', items: [
            'Confirmation — seeking info that confirms beliefs',
            'Anchoring — over-relying on first info received',
            'Availability — judging frequency by how easily examples come to mind',
            'Dunning-Kruger — overestimating knowledge in unfamiliar areas',
            'Sunk Cost — continuing because of past investment',
            'Bandwagon — following the crowd',
            'Authority — deferring to perceived experts',
            'Negativity — weighting negative info more heavily',
            'In-Group — favoring your group over outsiders',
            'Framing — being swayed by how info is presented',
          ]},
        ]}
      />

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-200">{error}</div>
      )}

      {/* Intro */}
      {stage === 'intro' && (
        <div className="text-center space-y-4">
          <Brain size={48} className="text-ink-muted/40 mx-auto" />
          <p className="text-sm text-ink-muted">
            10 quick scenarios. Each tests a different cognitive bias. Takes about 2 minutes.
          </p>
          <Button onClick={startQuiz} className="gap-2 h-11">
            <Eye size={16} /> Take the Quiz
          </Button>
        </div>
      )}

      {/* Loading */}
      {stage === 'loading' && (
        <div className="flex items-center justify-center py-12 gap-2 text-ink-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">{questions.length === 0 ? 'Loading quiz...' : 'Analyzing your bias fingerprint...'}</span>
        </div>
      )}

      {/* Quiz */}
      {stage === 'quiz' && questions[currentQ] && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {currentQ + 1} / {questions.length}
            </Badge>
            <span className="text-xs text-ink-muted">{questions[currentQ].biasLabel}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-ink/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-masthead rounded-full transition-all duration-300"
              style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
            />
          </div>

          <div className="p-4 rounded-lg border border-rule bg-paper-dark">
            <p className="text-sm font-serif text-ink leading-relaxed">{questions[currentQ].scenario}</p>
          </div>

          <div className="space-y-2">
            {questions[currentQ].options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="w-full text-left p-3 rounded-lg border border-rule hover:border-ink hover:shadow-sm transition-all cursor-pointer text-sm text-ink"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {stage === 'result' && profile && (
        <div className="space-y-4">
          <RadarChart profile={profile} />

          <div className="grid grid-cols-2 gap-2">
            {BIAS_KEYS.map((key) => {
              const score = profile[key] || 0;
              const label = biasLabels[key] || BIAS_SHORT[key];
              const level = score <= 3 ? 'Low' : score <= 6 ? 'Medium' : 'High';
              const color = score <= 3 ? 'text-green-600' : score <= 6 ? 'text-yellow-600' : 'text-red-600';
              return (
                <div key={key} className="flex items-center justify-between p-2 rounded-md border border-rule text-xs">
                  <span className="text-ink">{label}</span>
                  <span className={`font-semibold ${color}`}>{score}/10 {level}</span>
                </div>
              );
            })}
          </div>

          <Button onClick={startQuiz} variant="outline" className="w-full gap-2 h-11">
            <RotateCcw size={16} /> Retake Quiz
          </Button>
        </div>
      )}
    </Card>
  );
}
