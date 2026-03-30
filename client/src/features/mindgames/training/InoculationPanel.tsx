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
const LEVEL_DESCRIPTIONS: Record<string, string> = {
  trolling: 'Identify deliberate provocation, whataboutism, and insults designed to derail discussion.',
  emotional: 'Spot high-outrage, fear-inducing language designed to bypass rational thinking.',
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
    <Card className="p-4 md:p-5 h-full flex flex-col gap-3">
      {/* Header */}
      <FeaturePanelHeader
        icon={<Shield size={17} className="text-outrage shrink-0" />}
        title="Inoculation Lab"
        infoTitle="Inoculation Lab"
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
          <div className="flex items-center gap-1">
            {roundsPlayed > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 text-[12px] text-curiosity font-semibold cursor-help">
                    <Trophy size={13} /> {optimisticScore}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-[11px]">
                  {roundsPlayed} rounds · {accuracy}% accuracy
                </TooltipContent>
              </Tooltip>
            )}
            {(session || roundsPlayed > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={resetSession}
                    className="p-1.5 rounded hover:bg-paper-dark transition-colors cursor-pointer text-ink-muted hover:text-ink"
                    aria-label="Reset session"
                  >
                    <RotateCcw size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[11px]">Reset session</TooltipContent>
              </Tooltip>
            )}
          </div>
        }
      />

      {/* Mode tabs */}
      <div className="flex gap-1 p-0.5 bg-paper-dark rounded-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setMode('detective')}
              className={`flex-1 py-1.5 text-[12px] font-medium uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${mode === 'detective' ? 'bg-masthead text-white' : 'text-ink-muted hover:text-ink'}`}
            >
              <Eye size={13} /> Detective
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[11px]">Spot the manipulation tactic in AI-generated headlines</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setMode('cdo')}
              className={`flex-1 py-1.5 text-[12px] font-medium uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${mode === 'cdo' ? 'bg-outrage text-white' : 'text-ink-muted hover:text-ink'}`}
            >
              <Shield size={13} /> CDO Mode
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[11px]">Play the manipulator — craft disinformation to understand it from the inside</TooltipContent>
        </Tooltip>
      </div>

      {/* ─── Detective mode ─── */}
      {mode === 'detective' && (
        <>
          <p className="text-[13px] text-ink-muted leading-relaxed -mt-1">
            Build "mental antibodies" — identify the manipulation tactic used in each headline.
          </p>

          {/* Level progress */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              {LEVELS.map((lvl, i) => {
                const reached = i <= levelIdx;
                return (
                  <Tooltip key={lvl}>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center gap-1 text-[11px] uppercase tracking-wider font-medium cursor-help transition-all ${reached ? 'text-ink' : 'text-ink-muted/40'}`}>
                        <span>{LEVEL_ICONS[lvl]}</span>
                        <span className="hidden sm:inline">{lvl}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-[11px]">{LEVEL_DESCRIPTIONS[lvl]}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="h-2 bg-paper-dark rounded-full overflow-hidden border border-rule/50">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${((levelIdx + 1) / LEVELS.length) * 100}%`, backgroundColor: 'var(--color-outrage)' }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (e.g., vaccines, climate)..."
              className="text-[13px] flex-1 border-ink/20 focus:border-masthead h-10"
              onKeyDown={(e) => e.key === 'Enter' && generate()}
            />
            <Button onClick={generate} disabled={loading || !topic.trim()} className="gap-1.5 text-[13px] shrink-0 h-10">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              {session ? 'New' : 'Start'}
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {session && (
            <div className="space-y-2.5 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Level</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[13px] font-bold text-ink cursor-help">
                        {LEVEL_ICONS[session.level] || '🎯'} {session.level}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-[11px]">{LEVEL_DESCRIPTIONS[session.level]}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Score</span>
                    <span className="text-[13px] font-bold text-curiosity transition-all">{optimisticScore}</span>
                  </div>
                  {roundsPlayed > 0 && (
                    <Badge variant="outline" className="text-[11px] px-1.5">{accuracy}%</Badge>
                  )}
                </div>
              </div>

              <p className="text-[12px] text-ink-muted italic">
                Find the headline using: <span className="font-semibold text-outrage">{session.targetTactic}</span>
              </p>

              {feedback && (
                <div className={`p-3 rounded-md text-[13px] border ${feedback.correct ? 'bg-observation-muted border-observation/20' : 'bg-outrage-muted border-outrage/20'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {feedback.correct
                      ? <CheckCircle size={15} className="text-curiosity" />
                      : <XCircle size={15} className="text-outrage" />}
                    <span className="font-semibold text-ink">
                      {feedback.correct ? 'Correct! +10 points' : 'Not quite — it was:'}
                    </span>
                    {!feedback.correct && <span className="text-outrage font-bold">{feedback.targetTactic}</span>}
                  </div>
                  <p className="text-[12px] text-ink-muted">{feedback.explanation}</p>
                  {feedback.nextLevel && (
                    <p className="text-[12px] text-curiosity font-semibold mt-1.5">
                      Level up! {LEVEL_ICONS[feedback.nextLevel]} {feedback.nextLevel}
                    </p>
                  )}
                </div>
              )}

              {session.headlines.map((h: InoculationHeadline, i: number) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={selected !== null}
                  className={`w-full text-left p-3 rounded-md border transition-all duration-200 ${
                    selected === i
                      ? feedback?.correct
                        ? 'border-curiosity bg-curiosity-muted'
                        : 'border-outrage bg-outrage-muted'
                      : selected !== null
                        ? i === session.targetIndex
                          ? 'border-curiosity bg-curiosity-muted'
                          : 'border-rule bg-paper-dark opacity-40'
                        : 'border-rule hover:border-observation hover:bg-observation-muted/50 cursor-pointer'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-outrage">{h.tactic}</span>
                  <p className="text-[13px] font-medium text-ink mt-1 leading-relaxed">{h.headline}</p>
                </button>
              ))}

              {selected !== null && (
                <Button onClick={playAgain} className="w-full gap-2 text-[13px] h-10 mt-1">
                  <Zap size={15} /> Next Round
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── CDO mode ─── */}
      {mode === 'cdo' && (
        <div className="flex flex-col flex-1 overflow-y-auto gap-3">
          <div className="p-3 rounded-md border border-outrage/30 bg-outrage-muted text-[13px] text-ink leading-relaxed">
            <span className="font-bold text-outrage uppercase tracking-wider text-[11px]">Chief Disinformation Officer</span>
            <p className="mt-1 text-ink-muted">You are now a disinformation operator. Pick a topic and a tactic — see how manipulation is constructed. Understanding the craft builds immunity to it.</p>
          </div>

          <Input
            value={cdoTopic}
            onChange={(e) => setCdoTopic(e.target.value)}
            placeholder="Topic to weaponize (e.g., vaccine safety, housing prices)..."
            className="text-[13px] border-ink/20 focus:border-masthead h-10"
            onKeyDown={(e) => e.key === 'Enter' && selectedTactic && craftHeadline()}
          />

          <p className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold -mb-1">Choose your tactic:</p>
          <div className="grid grid-cols-2 gap-2">
            {cdoTactics.map((t) => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSelectedTactic(prev => prev === t.id ? null : t.id)}
                    className={`text-left p-2.5 rounded-md border text-[12px] transition-all cursor-pointer ${
                      selectedTactic === t.id
                        ? 'border-outrage bg-outrage-muted font-semibold text-outrage'
                        : 'border-rule hover:border-outrage/40 text-ink-muted hover:text-ink'
                    }`}
                  >
                    <span className="mr-1.5">{t.icon}</span>{t.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px] text-[11px]">{t.description}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <Button
            onClick={craftHeadline}
            disabled={cdoLoading || !cdoTopic.trim() || !selectedTactic}
            className="w-full gap-2 text-[13px] h-10"
            style={selectedTactic ? { backgroundColor: 'var(--color-outrage)' } : {}}
          >
            {cdoLoading ? <><Loader2 size={15} className="animate-spin" /> Crafting…</> : <><Shield size={15} /> Craft Disinformation</>}
          </Button>

          {cdoError && (
            <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
              <AlertTriangle size={14} /> {cdoError}
            </div>
          )}

          {craftResult && (
            <div className="space-y-3">
              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-md border border-observation bg-observation-muted">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-observation mb-1.5">Neutral</p>
                  <p className="text-[13px] text-ink leading-relaxed">{craftResult.neutral_headline}</p>
                </div>
                <div className="p-3 rounded-md border border-outrage bg-outrage-muted">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-outrage mb-1.5">Weaponized ({craftResult.tactic})</p>
                  <p className="text-[13px] text-ink leading-relaxed font-medium">{craftResult.manipulated_headline}</p>
                </div>
              </div>

              {/* Mechanism */}
              <div className="p-3 rounded-md bg-paper-dark border border-rule">
                <p className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Why it works</p>
                <p className="text-[13px] text-ink leading-relaxed">{craftResult.mechanism}</p>
              </div>

              {/* Red flags */}
              {craftResult.red_flags?.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Red flags to spot it</p>
                  <ul className="space-y-1.5">
                    {craftResult.red_flags.map((flag, i) => (
                      <li key={i} className="text-[13px] text-ink pl-3 border-l-2 border-curiosity leading-relaxed">{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                onClick={() => { setCraftResult(null); setSelectedTactic(null); }}
                variant="outline"
                className="w-full text-[13px] h-10 gap-2"
              >
                <Zap size={15} /> Try Another Tactic
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
