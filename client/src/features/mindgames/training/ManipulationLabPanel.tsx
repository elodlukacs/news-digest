import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Target, Zap, Shield, CheckCircle, XCircle, ArrowRight, RotateCcw, Users, Flame, Search, Theater } from 'lucide-react';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';
import { FeaturePanelHeader } from '../common';

interface AudienceTarget {
  id: string;
  label: string;
  bias: string;
}

interface TechniqueUsed {
  id: string;
  name: string;
  how_its_used: string;
}

interface CampaignRound {
  round: number;
  totalRounds: number;
  target: AudienceTarget;
  scenario: string;
  headline: string;
  techniques_used: TechniqueUsed[];
  target_vulnerability: string;
  antibody: string;
  provider?: string;
}

interface RoundScore {
  hits: number;
  totalActual: number;
  totalIdentified: number;
  precision: number;
  recall: number;
  chaosScore: number;
  antibodiesEarned: number;
}

type Stage = 'select-target' | 'loading' | 'reading' | 'guessing' | 'result' | 'simulation';

const TECHNIQUE_ICONS: Record<string, typeof Target> = {
  impersonation: Users,
  emotion: Flame,
  polarization: Zap,
  conspiracy: Search,
  discredit: Shield,
  trolling: Theater,
};

export function ManipulationLabPanel() {
  const selectedLlm = useLlm();
  const [stage, setStage] = useState<Stage>('select-target');
  const [targets, setTargets] = useState<AudienceTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<AudienceTarget | null>(null);
  const [topic] = useState('');
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds] = useState(3);
  const [roundData, setRoundData] = useState<CampaignRound | null>(null);
  const [selectedTechniques, setSelectedTechniques] = useState<Set<string>>(new Set());
  const [roundScores, setRoundScores] = useState<RoundScore[]>([]);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const loadTargets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/inoculation/targets`);
      const data = await res.json();
      setTargets(data);
    } catch {
      setTargets([
        { id: 'health-parents', label: 'Health-Conscious Parents', bias: 'Appeal to Fear for Children' },
        { id: 'political-activists', label: 'Political Activists', bias: 'In-Group Polarization' },
        { id: 'tech-enthusiasts', label: 'Tech Enthusiasts', bias: 'Appeal to Novelty' },
        { id: 'seniors', label: 'Senior Citizens', bias: 'Authority Trust + Nostalgia' },
        { id: 'investors', label: 'Retail Investors', bias: 'Greed + FOMO' },
        { id: 'students', label: 'University Students', bias: 'Social Proof + Peer Pressure' },
      ]);
    }
  }, []);

  useEffect(() => {
    loadTargets();
    // abortRef was declared but never aborted, so every in-flight campaign
    // request resolved into an unmounted component.
    return () => abortRef.current?.abort();
  }, [loadTargets]);

  const startCampaign = async (target: AudienceTarget) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSelectedTarget(target);
    setStage('loading');
    setError('');
    setCurrentRound(1);
    setRoundScores([]);

    try {
      const res = await fetch(`${API_BASE}/inoculation/campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: target.id, round: 1, totalRounds, topic: topic || undefined, provider: selectedLlm }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate campaign');
      const data = await res.json();
      setRoundData(data);
      setSelectedTechniques(new Set());
      setStage('reading');
      startTimeRef.current = 0;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to generate campaign');
      setStage('select-target');
    }
  };

  const nextRound = async () => {
    if (!selectedTarget || currentRound >= totalRounds) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStage('loading');
    const next = currentRound + 1;
    setCurrentRound(next);

    try {
      const res = await fetch(`${API_BASE}/inoculation/campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: selectedTarget.id, round: next, totalRounds, topic: topic || undefined, provider: selectedLlm }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate round');
      const data = await res.json();
      setRoundData(data);
      setSelectedTechniques(new Set());
      setStage('reading');
      startTimeRef.current = 0;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to generate round');
      setStage('result');
      setCurrentRound(currentRound);
    }
  };

  const toggleTechnique = (id: string) => {
    setSelectedTechniques(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitGuess = async () => {
    if (!roundData || selectedTechniques.size === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStage('loading');
    const timeToIdentify = startTimeRef.current ? Date.now() - startTimeRef.current : 30000;

    try {
      const res = await fetch(`${API_BASE}/inoculation/campaign/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correctTechniques: [...selectedTechniques],
          actualTechniques: roundData.techniques_used.map(t => t.id),
          timeToIdentify,
        }),
        signal: ctrl.signal,
      });
      // res.ok was unchecked, so an error body was pushed into roundScores as
      // if it were a score.
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to score answer');
      const score = await res.json();
      setRoundScores(prev => [...prev, score]);
      setStage('result');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to score answer');
      // Without this the panel stayed on the loading spinner with no way back.
      setStage('guessing');
    }
  };

  const reset = () => {
    setStage('select-target');
    setSelectedTarget(null);
    setRoundData(null);
    setSelectedTechniques(new Set());
    setRoundScores([]);
    setCurrentRound(1);
    setError('');
  };

  const totalChaos = roundScores.reduce((sum, s) => sum + s.chaosScore, 0);
  const avgChaos = roundScores.length > 0 ? Math.round(totalChaos / roundScores.length) : 0;
  const totalAntibodies = roundScores.reduce((sum, s) => sum + s.antibodiesEarned, 0);

  return (
    <Card className="p-5 md:p-6 flex flex-col gap-5">
      <FeaturePanelHeader
        icon={<Target size={22} className="text-outrage shrink-0" />}
        title="Manipulation Lab"
        subtitle="Design a disinformation campaign and learn how professional operators combine techniques."
        infoTitle="Manipulation Lab"
        researcher="Sander van der Linden · Cambridge University"
        summary="Step into the shoes of a disinformation operator. Choose a target audience, then face 3 rounds of escalating multi-technique campaigns. Identify which manipulation tactics are being combined to build your cognitive defenses."
        sections={[
          { heading: 'How It Works', content: 'You select a vulnerable target audience. The AI generates 3 campaign rounds, each combining 2-3 manipulation techniques. Your job is to identify which techniques are being used simultaneously.' },
          { heading: 'Chaos Score', content: 'Calculated from precision (what you identified vs what was actually used) and speed. Higher scores mean you spotted the manipulation faster and more accurately.' },
        ]}
      />

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-200">{error}</div>
      )}

      {/* Target Selection */}
      {stage === 'select-target' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-ink mb-3">Choose your target audience</p>
            <div className="grid grid-cols-2 gap-2">
              {targets.map(t => (
                <button
                  key={t.id}
                  onClick={() => startCampaign(t)}
                  className="text-left p-3 rounded-lg border border-rule hover:border-ink hover:shadow-sm transition-all cursor-pointer"
                >
                  <p className="text-sm font-semibold text-ink">{t.label}</p>
                  <p className="text-xs text-ink-muted mt-0.5">Vulnerability: {t.bias}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {stage === 'loading' && (
        <div className="flex items-center justify-center py-12 gap-2 text-ink-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Designing campaign round {currentRound}...</span>
        </div>
      )}

      {/* Reading / Guessing */}
      {(stage === 'reading' || stage === 'guessing') && roundData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              Round {currentRound}/{totalRounds} — {roundData.target.label}
            </Badge>
            {currentRound > 1 && roundScores.length > 0 && (
              <span className="text-xs text-ink-muted">Avg chaos: {avgChaos}/100</span>
            )}
          </div>

          <div className="p-4 rounded-lg border border-rule bg-paper-dark">
            <p className="text-xs text-ink-muted mb-1">Campaign scenario</p>
            <p className="text-sm text-ink leading-relaxed">{roundData.scenario}</p>
          </div>

          <div className="p-4 rounded-lg border-2 border-outrage/30 bg-outrage-muted">
            <p className="text-xs font-semibold text-outrage mb-1.5 uppercase tracking-wide">Manipulated Headline</p>
            <p className="text-base font-serif font-semibold text-ink leading-snug">{roundData.headline}</p>
          </div>

          <div className="p-3 rounded-lg border border-rule text-sm">
            <p className="text-xs text-ink-muted mb-1">Target vulnerability</p>
            <p className="text-ink font-medium">{roundData.target_vulnerability}</p>
          </div>

          {stage === 'reading' && (
            <Button
              onClick={() => { setStage('guessing'); startTimeRef.current = Date.now(); }}
              className="w-full gap-2 h-11"
            >
              I see the techniques — let me guess <ArrowRight size={16} />
            </Button>
          )}

          {stage === 'guessing' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ink">Which techniques are combined in this headline?</p>
              <div className="grid grid-cols-2 gap-2">
                {['impersonation', 'emotion', 'polarization', 'conspiracy', 'discredit', 'trolling'].map(id => {
                  const Icon = TECHNIQUE_ICONS[id] || Shield;
                  const isSelected = selectedTechniques.has(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleTechnique(id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm border transition-all cursor-pointer capitalize ${
                        isSelected
                          ? 'border-ink bg-ink text-paper font-semibold'
                          : 'border-rule bg-paper text-ink hover:border-ink-muted'
                      }`}
                    >
                      <Icon size={14} />
                      {id}
                    </button>
                  );
                })}
              </div>
              <Button onClick={submitGuess} disabled={selectedTechniques.size === 0} className="w-full gap-2 h-11">
                <Zap size={16} /> Score my guess
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {stage === 'result' && roundData && roundScores.length > 0 && (
        <div className="space-y-4">
          {(() => {
            const score = roundScores[roundScores.length - 1];
            return (
              <>
                <div className="text-center p-5 rounded-lg border border-rule bg-paper-dark">
                  <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">Chaos Score</p>
                  <p className="text-4xl font-bold text-ink">{score.chaosScore}</p>
                  <p className="text-xs text-ink-muted mt-1">
                    {score.hits}/{score.totalActual} techniques identified · {score.precision}% precision
                  </p>
                  {score.antibodiesEarned > 0 && (
                    <Badge className="mt-2 bg-curiosity text-white">+{score.antibodiesEarned} antibodies</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Techniques used</p>
                  {roundData.techniques_used.map((t, i) => {
                    const found = selectedTechniques.has(t.id);
                    const Icon = TECHNIQUE_ICONS[t.id] || Shield;
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${found ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
                        {found ? <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-orange-600 mt-0.5 shrink-0" />}
                        <div>
                          <p className="text-sm font-semibold text-ink flex items-center gap-1.5"><Icon size={14} /> {t.name}</p>
                          <p className="text-xs text-ink-muted mt-0.5">{t.how_its_used}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {roundData.antibody && (
                  <div className="p-3 rounded-lg bg-curiosity-muted border border-curiosity/30">
                    <p className="text-xs font-semibold text-curiosity uppercase tracking-wide mb-1">The Antibody</p>
                    <p className="text-sm text-ink leading-relaxed">{roundData.antibody}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {currentRound < totalRounds ? (
                    <Button onClick={nextRound} className="flex-1 gap-2 h-11">
                      <ArrowRight size={16} /> Next Round
                    </Button>
                  ) : (
                    <Button onClick={() => setStage('simulation')} className="flex-1 gap-2 h-11">
                      <Zap size={16} /> See Viral Spread
                    </Button>
                  )}
                  <Button onClick={reset} variant="outline" className="gap-2 h-11">
                    <RotateCcw size={16} /> Restart
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Viral Simulation */}
      {stage === 'simulation' && (
        <div className="space-y-4">
          <div className="text-center p-4 rounded-lg border border-rule bg-paper-dark">
            <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">Campaign Complete</p>
            <p className="text-3xl font-bold text-ink">{avgChaos}</p>
            <p className="text-xs text-ink-muted">Average Chaos Score across {totalRounds} rounds</p>
            <div className="flex justify-center gap-4 mt-2">
              <Badge variant="outline">+{totalAntibodies} antibodies</Badge>
              <Badge variant="outline">{selectedTarget?.label}</Badge>
            </div>
          </div>

          <ViralSpread scores={roundScores} />

          <Button onClick={reset} variant="outline" className="w-full gap-2 h-11">
            <RotateCcw size={16} /> New Campaign
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ─── Viral Spread Visualization ─── */

function ViralSpread({ scores }: { scores: RoundScore[] }) {
  const nodes = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: 50 + 40 * Math.cos((i / 12) * Math.PI * 2),
    y: 50 + 40 * Math.sin((i / 12) * Math.PI * 2),
  }));

  const infectedCount = Math.round(scores.reduce((s, sc) => s + sc.chaosScore, 0) / scores.length / 10);

  return (
    <div className="relative">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Simulated Spread</p>
      <svg viewBox="0 0 100 100" className="w-full max-w-xs mx-auto">
        {nodes.map((n, i) => {
          const infected = i < infectedCount;
          const delay = i * 0.15;
          return (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={infected ? 6 : 4}
                className={infected ? 'fill-red-400' : 'fill-green-400'}
                style={{
                  opacity: infected ? 1 : 0.4,
                  animation: infected ? `pulse 2s ${delay}s infinite` : 'none',
                }}
              />
              {i > 0 && (
                <line
                  x1={nodes[i - 1].x}
                  y1={nodes[i - 1].y}
                  x2={n.x}
                  y2={n.y}
                  stroke={infected && i - 1 < infectedCount ? '#f87171' : '#d1d5db'}
                  strokeWidth={0.5}
                  style={{
                    animation: infected ? `fadeIn 0.5s ${delay}s both` : 'none',
                  }}
                />
              )}
            </g>
          );
        })}
        <circle cx={50} cy={50} r={8} className="fill-outrage" style={{ animation: 'pulse 1.5s infinite' }} />
        <text x={50} y={52} textAnchor="middle" className="fill-white text-[5px] font-bold">SOURCE</text>
      </svg>
      <div className="flex justify-between text-[10px] text-ink-muted mt-1 px-4">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-400" /> Safe</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" /> Infected</span>
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
