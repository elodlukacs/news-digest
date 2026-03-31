import { useState, useEffect, useRef, useCallback, useOptimistic } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip';
import { Loader2, Shield, Zap, CheckCircle, XCircle, AlertTriangle, Trophy, Eye, RotateCcw } from 'lucide-react';
import { API_BASE } from '../../../config';
import type { InoculationHeadline } from '../../../types';
import { FeaturePanelHeader } from '../common';

/* ─── Types ─── */

interface GameSession {
  sessionId: number;
  level: string;
  topic: string;
  headlines: InoculationHeadline[];
  targetIndex: number;
  targetTactic: string;
  score: number;
}

interface SessionHistory {
  id: number;
  level: string;
  score: number;
  created_at: string;
}

interface CdoTactic {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface CraftResult {
  neutral_headline: string;
  manipulated_headline: string;
  mechanism: string;
  red_flags: string[];
  tactic: string;
}

/* ─── Constants ─── */

const LEVELS = ['trolling', 'emotional', 'amplification', 'escalation'];
const LEVEL_ICONS: Record<string, string> = {
  trolling: '🎭', emotional: '🔥', amplification: '📢', escalation: '⚡',
};
const LEVEL_LABELS: Record<string, string> = {
  trolling: 'Trolling',
  emotional: 'Emotional',
  amplification: 'Amplification',
  escalation: 'Escalation',
};
const LEVEL_DESCRIPTIONS: Record<string, string> = {
  trolling: 'Spot deliberate provocation and insults designed to derail conversations.',
  emotional: 'Catch fear-inducing, outrage-driven language that bypasses rational thinking.',
  amplification: 'Detect fake consensus, bandwagon appeals, and artificial social proof.',
  escalation: 'Recognize advanced multi-layered manipulation combining all tactics.',
};

/* ─── Component ─── */

export function InoculationPanel() {
  const [mode, setMode] = useState<'detective' | 'cdo'>('detective');

  // Detective mode state
  const [topic, setTopic] = useState('');
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    correct: boolean; points: number; targetTactic: string;
    explanation: string; nextLevel?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [highestLevel, setHighestLevel] = useState('trolling');

  // CDO mode state
  const [cdoTopic, setCdoTopic] = useState('');
  const [cdoTactics, setCdoTactics] = useState<CdoTactic[]>([]);
  const [selectedTactic, setSelectedTactic] = useState<string | null>(null);
  const [craftResult, setCraftResult] = useState<CraftResult | null>(null);
  const [cdoLoading, setCdoLoading] = useState(false);
  const [cdoError, setCdoError] = useState('');

  // useOptimistic for instant score feedback
  const [optimisticScore, addOptimisticScore] = useOptimistic(
    session?.score ?? 0,
    (current: number, delta: number) => current + delta
  );

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { return () => abortRef.current?.abort(); }, []);

  // Load session history + CDO tactics on mount
  const loadSessions = useCallback(async () => {
    try {
      const [sessRes, tacticRes] = await Promise.all([
        fetch(`${API_BASE}/inoculation/sessions`),
        fetch(`${API_BASE}/inoculation/tactics`),
      ]);
      const data: SessionHistory[] = await sessRes.json();
      const tactics: CdoTactic[] = await tacticRes.json();
      setCdoTactics(tactics);
      if (data.length > 0) {
        const best = data.reduce(
          (a, b) => LEVELS.indexOf(b.level) > LEVELS.indexOf(a) ? b.level : a,
          'trolling'
        );
        setHighestLevel(best);
        setRoundsPlayed(data.length);
        setCorrectCount(data.reduce((s, d) => s + Math.floor(d.score / 10), 0));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  /* ─── Detective mode ─── */

  const generate = async () => {
    if (!topic.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    const prevSession = session;
    setSession(null);
    setSelected(null);
    setFeedback(null);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/inoculation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level: prevSession?.level }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate round');
      const data = await res.json();
      setSession({ ...data, score: prevSession?.score ?? 0 });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to generate round');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (idx: number) => {
    if (!session || selected !== null) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSelected(idx);
    setError('');

    // Optimistically assume correct (+10) — will revert if wrong
    addOptimisticScore(10);

    try {
      const res = await fetch(`${API_BASE}/inoculation/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, selectedIndex: idx }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to record answer');
      const data = await res.json();

      setRoundsPlayed(r => r + 1);
      if (data.correct) setCorrectCount(c => c + 1);

      setFeedback({
        correct: data.correct,
        points: data.points,
        targetTactic: session.targetTactic,
        explanation: session.headlines[idx].flaw_explanation,
        nextLevel: data.nextLevel !== session.level ? data.nextLevel : undefined,
      });

      const newLevel = data.nextLevel || session.level;
      if (LEVELS.indexOf(newLevel) > LEVELS.indexOf(highestLevel)) setHighestLevel(newLevel);
      // Update real score — this makes useOptimistic revert/confirm
      setSession(prev => prev ? { ...prev, score: data.newScore, level: newLevel } : null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to record answer');
      setSelected(null);
    }
  };

  const playAgain = () => {
    setSelected(null);
    setFeedback(null);
    generate();
  };

  const resetSession = () => {
    setSession(null);
    setTopic('');
    setSelected(null);
    setFeedback(null);
    setRoundsPlayed(0);
    setCorrectCount(0);
    setHighestLevel('trolling');
    setError('');
  };

  /* ─── CDO mode ─── */

  const craftHeadline = async () => {
    if (!cdoTopic.trim() || !selectedTactic) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setCdoLoading(true);
    setCraftResult(null);
    setCdoError('');

    try {
      const res = await fetch(`${API_BASE}/inoculation/craft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: cdoTopic, tactic: selectedTactic }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Craft failed');
      setCraftResult(await res.json());
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setCdoError(err instanceof Error ? err.message : 'Craft failed');
    } finally {
      setCdoLoading(false);
    }
  };

  /* ─── Render ─── */

  const levelIdx = LEVELS.indexOf(session?.level || highestLevel);
  const accuracy = roundsPlayed > 0 ? Math.round((correctCount / roundsPlayed) * 100) : 0;

  return (
    <Card className="p-5 md:p-6 h-full flex flex-col gap-5">
      {/* Header */}
      <FeaturePanelHeader
        icon={<Shield size={22} className="text-outrage shrink-0" />}
        title="Spot the Trick"
        subtitle="Can you tell which headline has been manipulated? Pick a topic, and we'll test your instincts."
        infoTitle="Spot the Trick"
        researcher="Sander van der Linden · Cambridge University"
        summary="Like a vaccine, you're exposed to a weakened dose of manipulation so your mind builds immunity before encountering the real thing in the wild."
        sections={[
          { heading: 'The Science', content: 'Psychological Inoculation Theory — validated across 5,061 participants across multiple cultures. Perceived reliability of manipulative content decreases significantly post-play, regardless of age, education, or political ideology.' },
          { heading: 'How It Works', content: 'You play the role of a Chief Disinformation Officer — crafting manipulation in a fictional social media environment. Active production is far more effective than passively reading about manipulation tactics.' },
          { heading: 'Tactics You\'ll Master', items: [
            'Emotional Manipulation — using fear, outrage, or anger instead of evidence',
            'Trolling — deliberate provocation designed to trigger defensive reactions and stifle discourse',
            'Conspiracy Construction — manufacturing secret agendas to explain complex or random events',
            'Artificial Amplification — bots and fake engagement creating an illusion of consensus',
            'Impersonation — fake accounts mimicking credible sources to borrow their authority',
            'Polarisation — reframing neutral topics as divisive intergroup conflicts',
          ]},
          { heading: 'The Levels', content: 'Trolling → Emotional Manipulation → Artificial Amplification → Escalation. Each level adds complexity and builds on the resistance you developed in the previous round.' },
        ]}
        right={
          <div className="flex items-center gap-2">
            {roundsPlayed > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 text-sm text-curiosity font-bold cursor-help">
                    <Trophy size={15} /> {optimisticScore}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {roundsPlayed} rounds · {accuracy}% accuracy
                </TooltipContent>
              </Tooltip>
            )}
            {(session || roundsPlayed > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={resetSession}
                    className="p-1.5 rounded-md hover:bg-paper-dark transition-colors cursor-pointer text-ink-muted hover:text-ink"
                    aria-label="Reset session"
                  >
                    <RotateCcw size={15} />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Reset session</TooltipContent>
              </Tooltip>
            )}
          </div>
        }
      />

      {/* Mode switch */}
      <div className="flex rounded-lg border border-rule overflow-hidden">
        <button
          onClick={() => setMode('detective')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mode === 'detective'
              ? 'bg-ink text-paper'
              : 'bg-paper text-ink-muted hover:text-ink hover:bg-paper-dark'
          }`}
        >
          <Eye size={15} /> Catch It
        </button>
        <button
          onClick={() => setMode('cdo')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border-l border-rule ${
            mode === 'cdo'
              ? 'bg-ink text-paper'
              : 'bg-paper text-ink-muted hover:text-ink hover:bg-paper-dark'
          }`}
        >
          <Shield size={15} /> Write It Yourself
        </button>
      </div>

      {/* ─── Detective mode ─── */}
      {mode === 'detective' && (
        <>
          {/* Level progress */}
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {LEVELS.map((lvl, i) => {
                const reached = i <= levelIdx;
                const isCurrent = i === levelIdx;
                return (
                  <Tooltip key={lvl}>
                    <TooltipTrigger asChild>
                      <div
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-help transition-all ${
                          isCurrent
                            ? 'bg-ink text-paper'
                            : reached
                              ? 'bg-paper-dark text-ink'
                              : 'text-ink-muted/40'
                        }`}
                      >
                        <span className="text-sm">{LEVEL_ICONS[lvl]}</span>
                        <span className="hidden sm:inline">{LEVEL_LABELS[lvl]}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">{LEVEL_DESCRIPTIONS[lvl]}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Topic input */}
          <div className="flex gap-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic — e.g. vaccines, climate, elections..."
              className="text-sm flex-1 h-11"
              onKeyDown={(e) => e.key === 'Enter' && generate()}
            />
            <Button onClick={generate} disabled={loading || !topic.trim()} className="gap-2 text-sm shrink-0 h-11 px-5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {session ? 'New Round' : 'Start'}
            </Button>
          </div>

          {error && (
            <div className="p-3.5 bg-outrage-muted rounded-lg text-sm text-outrage flex items-center gap-2.5 border border-outrage/20">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {session && (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {/* Round info bar */}
              <div className="flex items-center justify-between py-2 border-b border-rule">
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-semibold text-ink cursor-help">
                        {LEVEL_ICONS[session.level]} {LEVEL_LABELS[session.level]}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">{LEVEL_DESCRIPTIONS[session.level]}</TooltipContent>
                  </Tooltip>
                  {roundsPlayed > 0 && (
                    <Badge variant="outline" className="text-xs">{accuracy}% accuracy</Badge>
                  )}
                </div>
                <span className="text-sm font-bold text-curiosity">{optimisticScore} pts</span>
              </div>

              {/* Instruction */}
              <p className="text-sm text-ink-muted leading-relaxed">
                Which headline uses <span className="font-bold text-outrage">{session.targetTactic}</span>?
              </p>

              {/* Feedback */}
              {feedback && (
                <div className={`p-4 rounded-lg text-sm border ${feedback.correct ? 'bg-curiosity-muted border-curiosity/30' : 'bg-outrage-muted border-outrage/30'}`}>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    {feedback.correct
                      ? <CheckCircle size={18} className="text-curiosity shrink-0" />
                      : <XCircle size={18} className="text-outrage shrink-0" />}
                    <span className="font-bold text-ink text-base">
                      {feedback.correct ? 'Correct! +10 points' : 'Not quite'}
                    </span>
                    {!feedback.correct && <span className="text-outrage font-semibold">— it was {feedback.targetTactic}</span>}
                  </div>
                  <p className="text-sm text-ink-muted leading-relaxed">{feedback.explanation}</p>
                  {feedback.nextLevel && (
                    <p className="text-sm text-curiosity font-bold mt-2">
                      Level up! {LEVEL_ICONS[feedback.nextLevel]} {LEVEL_LABELS[feedback.nextLevel]}
                    </p>
                  )}
                </div>
              )}

              {/* Headline cards */}
              {session.headlines.map((h: InoculationHeadline, i: number) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={selected !== null}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                    selected === i
                      ? feedback?.correct
                        ? 'border-curiosity bg-curiosity-muted'
                        : 'border-outrage bg-outrage-muted'
                      : selected !== null
                        ? i === session.targetIndex
                          ? 'border-curiosity bg-curiosity-muted'
                          : 'border-rule/50 bg-paper-dark opacity-40'
                        : 'border-rule hover:border-ink hover:shadow-sm cursor-pointer'
                  }`}
                >
                  <span className="text-xs font-semibold text-outrage uppercase tracking-wide">{h.tactic}</span>
                  <p className="text-base font-serif font-semibold text-ink mt-1.5 leading-snug">{h.headline}</p>
                </button>
              ))}

              {selected !== null && (
                <Button onClick={playAgain} className="w-full gap-2 text-sm h-11 mt-1">
                  <Zap size={16} /> Next Round
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── CDO mode ─── */}
      {mode === 'cdo' && (
        <div className="flex flex-col flex-1 overflow-y-auto gap-4">
          <div className="p-4 rounded-lg border border-rule bg-paper-dark text-sm text-ink leading-relaxed">
            <p className="font-serif font-bold text-base text-ink mb-1">Write It Yourself</p>
            <p className="text-ink-muted">Pick a topic and a manipulation tactic. See how a neutral headline gets weaponized — and learn to spot the red flags.</p>
          </div>

          <Input
            value={cdoTopic}
            onChange={(e) => setCdoTopic(e.target.value)}
            placeholder="Pick a topic — e.g. vaccine safety, housing prices..."
            className="text-sm h-11"
            onKeyDown={(e) => e.key === 'Enter' && selectedTactic && craftHeadline()}
          />

          <div>
            <p className="text-xs font-semibold text-ink-muted mb-2.5 uppercase tracking-wide">Choose a tactic</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {cdoTactics.map((t) => (
                <Tooltip key={t.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSelectedTactic(prev => prev === t.id ? null : t.id)}
                      className={`text-left p-3 rounded-lg border-2 text-sm transition-all cursor-pointer ${
                        selectedTactic === t.id
                          ? 'border-ink bg-paper-dark font-semibold text-ink'
                          : 'border-rule hover:border-ink/40 text-ink-muted hover:text-ink'
                      }`}
                    >
                      <span className="mr-1.5">{t.icon}</span>{t.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">{t.description}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <Button
            onClick={craftHeadline}
            disabled={cdoLoading || !cdoTopic.trim() || !selectedTactic}
            className="w-full gap-2 text-sm h-11"
          >
            {cdoLoading ? <><Loader2 size={16} className="animate-spin" /> Crafting...</> : <><Shield size={16} /> Craft Headline</>}
          </Button>

          {cdoError && (
            <div className="p-3.5 bg-outrage-muted rounded-lg text-sm text-outrage flex items-center gap-2.5 border border-outrage/20">
              <AlertTriangle size={16} /> {cdoError}
            </div>
          )}

          {craftResult && (
            <div className="space-y-3">
              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg border-2 border-curiosity/40 bg-curiosity-muted">
                  <p className="text-xs font-semibold text-curiosity mb-2 uppercase tracking-wide">Neutral</p>
                  <p className="text-base font-serif text-ink leading-snug">{craftResult.neutral_headline}</p>
                </div>
                <div className="p-4 rounded-lg border-2 border-outrage/40 bg-outrage-muted">
                  <p className="text-xs font-semibold text-outrage mb-2 uppercase tracking-wide">Manipulated — {craftResult.tactic}</p>
                  <p className="text-base font-serif font-semibold text-ink leading-snug">{craftResult.manipulated_headline}</p>
                </div>
              </div>

              {/* Mechanism */}
              <div className="p-4 rounded-lg bg-paper-dark border border-rule">
                <p className="text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">Why this works</p>
                <p className="text-sm text-ink leading-relaxed">{craftResult.mechanism}</p>
              </div>

              {/* Red flags */}
              {craftResult.red_flags?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-2.5 uppercase tracking-wide">Red flags to watch for</p>
                  <ul className="space-y-2">
                    {craftResult.red_flags.map((flag, i) => (
                      <li key={i} className="text-sm text-ink pl-4 border-l-2 border-curiosity leading-relaxed">{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                onClick={() => { setCraftResult(null); setSelectedTactic(null); }}
                variant="outline"
                className="w-full text-sm h-11 gap-2"
              >
                <Zap size={16} /> Try Another Tactic
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
