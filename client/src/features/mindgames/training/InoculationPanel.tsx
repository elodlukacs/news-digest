import { useState, useEffect, useRef, useCallback } from 'react';
import type React from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip';
import { Loader2, Shield, Zap, CheckCircle, XCircle, AlertTriangle, Trophy, Eye, RotateCcw, Syringe, Droplet, Users, Flame, Search, Theater } from 'lucide-react';
import { API_BASE } from '../../../config';
import type { InoculationHeadline } from '../../../types';
import { FeaturePanelHeader } from '../common';

/* ─── Types ─── */

interface GameSession {
  sessionId: number;
  dose: number;
  topic: string;
  headlines: InoculationHeadline[];
  targetIndex: number;
  targetTactic: string;
  targetBias: string;
  theAntibody: string;
  score: number;
}

interface ViralAntigen {
  id: string;
  label: string;
  icon: string;
  description: string;
  bias: string;
}

/* ─── Constants ─── */

const DOSE_LABELS: Record<number, string> = {
  1: 'Micro-dose',
  2: 'Active',
  3: 'Full Virus',
};
const DOSE_ICONS: Record<number, React.ComponentType<{ size?: number; className?: string }>> = {
  1: Droplet,
  2: Syringe,
  3: Zap,
};
const DOSE_DESCRIPTIONS: Record<number, string> = {
  1: 'Subtle manipulation — can you catch the faint signal?',
  2: 'Standard dose — the tactics are clearly present.',
  3: 'Full-strength virus — the manipulation is obvious. Can you name the tactic?',
};

const ANTIGEN_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Users,
  Flame,
  Zap,
  Search,
  Shield,
  Theater,
};

/* ─── Component ─── */

export function InoculationPanel() {
  const [mode, setMode] = useState<'passive' | 'active'>('passive');

  // Passive mode state
  const [topic, setTopic] = useState('');
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    correct: boolean; points: number; targetTactic: string;
    theAntibody: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [currentDose, setCurrentDose] = useState(1);

  // Immunity state
  const [antibodyCount, setAntibodyCount] = useState(0);
  const [needsBooster, setNeedsBooster] = useState(false);

  // Active mode state
  const [activeTopic, setActiveTopic] = useState('');
  const [antigens, setAntigens] = useState<ViralAntigen[]>([]);
  const [selectedTactic, setSelectedTactic] = useState<string | null>(null);
  const [craftResult, setCraftResult] = useState<{
    neutral_headline: string;
    manipulated_headline: string;
    the_antibody: string;
    red_flags: string[];
    tactic: string;
    bias: string;
  } | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeError, setActiveError] = useState('');

  // Display antibody count from server (no optimistic update to avoid stale state on wrong answers)

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { return () => abortRef.current?.abort(); }, []);

  // Load session history + antigens on mount
  const loadSessions = useCallback(async () => {
    try {
      const [sessRes, tacticRes] = await Promise.all([
        fetch(`${API_BASE}/inoculation/sessions`),
        fetch(`${API_BASE}/inoculation/tactics`),
      ]);
      const sessData = await sessRes.json();
      const tactics: ViralAntigen[] = await tacticRes.json();
      setAntigens(tactics);

      // Handle new response shape { sessions, antibodyCount, needsBooster }
      const sessions = Array.isArray(sessData) ? sessData : (sessData.sessions || []);
      if (sessData.antibodyCount !== undefined) setAntibodyCount(sessData.antibodyCount);
      if (sessData.needsBooster !== undefined) setNeedsBooster(sessData.needsBooster);

      if (sessions.length > 0) {
        const bestDose = sessions.reduce(
          (best: number, s: { level: string }) => {
            const d = parseInt(s.level, 10);
            return (!isNaN(d) && d > best) ? d : best;
          },
          1
        );
        setCurrentDose(bestDose);
        setRoundsPlayed(sessions.length);
        setCorrectCount(sessions.reduce((s: number, d: { score: number }) => s + Math.floor(d.score / 10), 0));
      }
    } catch (err) {
      console.error('Failed to load inoculation sessions:', err);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  /* ─── Passive mode ─── */

  const generate = async () => {
    if (!topic.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setSession(null);
    setSelected(null);
    setFeedback(null);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/inoculation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate round');
      const data = await res.json();
      setSession({ ...data, score: session?.score ?? 0 });
      if (data.dose) setCurrentDose(data.dose);
      if (data.needsBooster !== undefined) setNeedsBooster(data.needsBooster);
      if (data.antibodyCount !== undefined) setAntibodyCount(data.antibodyCount);
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
        theAntibody: session.theAntibody,
      });

      if (data.antibodyCount !== undefined) setAntibodyCount(data.antibodyCount);
      setSession(prev => prev ? { ...prev, score: data.newScore } : null);
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
    setCurrentDose(1);
    setError('');
  };

  /* ─── Active mode ─── */

  const craftHeadline = async () => {
    if (!activeTopic.trim() || !selectedTactic) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setActiveLoading(true);
    setCraftResult(null);
    setActiveError('');

    try {
      const res = await fetch(`${API_BASE}/inoculation/craft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: activeTopic, tactic: selectedTactic }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Craft failed');
      setCraftResult(await res.json());
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setActiveError(err instanceof Error ? err.message : 'Craft failed');
    } finally {
      setActiveLoading(false);
    }
  };

  /* ─── Render ─── */

  const accuracy = roundsPlayed > 0 ? Math.round((correctCount / roundsPlayed) * 100) : 0;

  return (
    <Card className="p-5 md:p-6 h-full flex flex-col gap-5">
      {/* Header */}
      <FeaturePanelHeader
        icon={<Shield size={22} className="text-outrage shrink-0" />}
        title="Cognitive Immunity Lab"
        subtitle="Build your psychological defense against the virus of misinformation."
        infoTitle="Cognitive Immunity Lab"
        researcher="Sander van der Linden · Cambridge University · 'Foolproof'"
        summary="Misinformation is a virus. Cognitive biases are your vulnerabilities. This app is your psychological vaccine — exposing you to weakened strains so your mind builds immunity before the real thing."
        sections={[
          { heading: 'The Science', content: 'Based on Sander van der Linden\'s "Foolproof: Why Misinformation Infects Our Minds and How to Build Immunity". Validated across 5,061 participants across multiple cultures. Perceived reliability of manipulative content decreases significantly post-play.' },
          { heading: 'Passive Inoculation', content: 'You\'re exposed to a weakened dose of a viral tactic mixed with neutral headlines. Identify which one is the "virus" — like recognizing an infection before it takes hold.' },
          { heading: 'Active Inoculation', content: 'You step into the shoes of the manipulator and synthesize the virus yourself. Active production builds stronger cognitive antibodies than passive detection.' },
          { heading: '6 Viral Antigens', items: [
            'Impersonation — mimicking credible sources (exploits Authority Bias)',
            'Emotion — fear/outrage language (exploits Emotional Reasoning)',
            'Polarization — us-vs-them framing (exploits In-Group Bias)',
            'Conspiracy — hidden agendas (exploits Pattern Seeking)',
            'Discredit — attacking the source (exploits Confirmation Bias)',
            'Trolling — deliberate provocation (exploits Emotional Reactivity)',
          ]},
          { heading: 'Immune System', content: 'Your antibody count decays 10% after 7 days without training — immunity fades without booster shots. Higher antibody counts increase the dose intensity.' },
        ]}
        howToPlaySections={[
          { heading: '1. Choose Your Inoculation Mode', content: 'Passive mode is like getting a vaccine — you spot the viral headline hiding among clean ones. Active mode is like cooking your own antidote — you craft the manipulation yourself from scratch. Both build immunity, but Active mode gives you superpowers.' },
          { heading: '2. Spot the Virus (Passive)', items: [
            'You\'ll see 3 headlines — only one is infected with a viral tactic.',
            'Tap the headline that feels like it\'s trying to manipulate you.',
            'Wrong? Don\'t worry — your immune system learns from infections too.',
          ]},
          { heading: '3. Craft the Virus (Active)', items: [
            'You pick a topic and receive a real headline to weaponize.',
            'Rewrite it using the viral tactic shown (impersonation, emotion, etc.).',
            'Think like a misinformant — what would make this click? Be devious.',
          ]},
          { heading: '4. Collect Antibodies', content: 'Every correct identification or clever manipulation earns you antibodies. The higher your count, the harder the dose gets. Think of it as leveling up your immune system.' },
          { heading: '5. Stay Immune', content: 'Your antibodies slowly decay after 7 days of inactivity — just like real immunity. Come back for booster shots to keep your defenses sharp.' },
        ]}
        right={
          <div className="flex items-center gap-2">
            {roundsPlayed > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 text-sm text-curiosity font-bold cursor-help">
                    <Trophy size={15} /> {antibodyCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {antibodyCount} antibodies · {roundsPlayed} rounds · {accuracy}% accuracy
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

      {/* Booster warning */}
      {needsBooster && (
        <div className="p-3.5 bg-curiosity-muted rounded-lg text-sm text-curiosity flex items-center gap-2.5 border border-curiosity/20">
          <Syringe size={16} className="shrink-0" />
          <span><strong>Immunity decay detected.</strong> Your antibodies dropped 10% — it&apos;s been over 7 days. Time for a booster shot!</span>
        </div>
      )}

      {/* Mode switch */}
      <div className="flex rounded-lg border border-rule overflow-hidden">
        <button
          onClick={() => setMode('passive')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mode === 'passive'
              ? 'bg-ink text-paper'
              : 'bg-paper text-ink-muted hover:text-ink hover:bg-paper-dark'
          }`}
        >
          <Eye size={15} /> Passive Inoculation
        </button>
        <button
          onClick={() => setMode('active')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border-l border-rule ${
            mode === 'active'
              ? 'bg-ink text-paper'
              : 'bg-paper text-ink-muted hover:text-ink hover:bg-paper-dark'
          }`}
        >
          <Syringe size={15} /> Active Inoculation
        </button>
      </div>

      {/* ─── Passive mode ─── */}
      {mode === 'passive' && (
        <>
          {/* Dose progress */}
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((dose) => {
                const isActive = dose <= currentDose;
                const isCurrent = dose === currentDose;
                return (
                  <Tooltip key={dose}>
                    <TooltipTrigger asChild>
                      <div
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-help transition-all ${
                          isCurrent
                            ? 'bg-ink text-paper'
                            : isActive
                              ? 'bg-paper-dark text-ink'
                              : 'text-ink-muted/40'
                        }`}
                      >
                        <span className="text-sm">{(() => { const Icon = DOSE_ICONS[dose]; return <Icon size={16} />; })()}</span>
                        <span className="hidden sm:inline">{DOSE_LABELS[dose]}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">{DOSE_DESCRIPTIONS[dose]}</TooltipContent>
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
                        {(() => { const Icon = DOSE_ICONS[session.dose]; return <Icon size={14} className="inline mr-1" />; })()}{DOSE_LABELS[session.dose]} dose
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">{DOSE_DESCRIPTIONS[session.dose]}</TooltipContent>
                  </Tooltip>
                  {roundsPlayed > 0 && (
                    <Badge variant="outline" className="text-xs">{accuracy}% accuracy</Badge>
                  )}
                </div>
                <span className="text-sm font-bold text-curiosity">{antibodyCount} <Shield size={14} className="inline" /></span>
              </div>

              {/* Instruction */}
              <p className="text-sm text-ink-muted leading-relaxed">
                Which headline is the <span className="font-bold text-outrage">virus</span>? ({session.targetBias} vulnerability)
              </p>

              {/* Feedback */}
              {feedback && (
                <div className={`p-4 rounded-lg text-sm border ${feedback.correct ? 'bg-curiosity-muted border-curiosity/30' : 'bg-outrage-muted border-outrage/30'}`}>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    {feedback.correct
                      ? <CheckCircle size={18} className="text-curiosity shrink-0" />
                      : <XCircle size={18} className="text-outrage shrink-0" />}
                    <span className="font-bold text-ink text-base">
                      {feedback.correct ? 'Antibody produced! +10' : 'Infection missed'}
                    </span>
                    {!feedback.correct && <span className="text-outrage font-semibold">— it was {feedback.targetTactic}</span>}
                  </div>
                  {feedback.theAntibody && (
                    <div className="mt-2 p-3 rounded-lg bg-paper-dark border border-rule">
                      <p className="text-xs font-semibold text-curiosity uppercase tracking-wide mb-1">The Antibody</p>
                      <p className="text-sm text-ink leading-relaxed">{feedback.theAntibody}</p>
                    </div>
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
                  <p className="text-base font-serif font-semibold text-ink leading-snug">{h.text}</p>
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

      {/* ─── Active mode ─── */}
      {mode === 'active' && (
        <div className="flex flex-col flex-1 overflow-y-auto gap-4">
          <div className="p-4 rounded-lg border border-rule bg-paper-dark text-sm text-ink leading-relaxed">
            <p className="font-serif font-bold text-base text-ink mb-1">Active Inoculation</p>
            <p className="text-ink-muted">Pick a topic and a viral antigen. See how a neutral headline gets weaponized — and build your cognitive antibodies by understanding the mechanism.</p>
          </div>

          <Input
            value={activeTopic}
            onChange={(e) => setActiveTopic(e.target.value)}
            placeholder="Pick a topic — e.g. vaccine safety, housing prices..."
            className="text-sm h-11"
            onKeyDown={(e) => e.key === 'Enter' && selectedTactic && craftHeadline()}
          />

          <div>
            <p className="text-xs font-semibold text-ink-muted mb-2.5 uppercase tracking-wide">Choose a viral antigen</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {antigens.map((t) => (
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
                      <span className="mr-1.5">{(() => { const Icon = ANTIGEN_ICONS[t.icon] || Shield; return <Icon size={14} className="inline" />; })()}</span>{t.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    <strong>{t.bias}</strong>: {t.description}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <Button
            onClick={craftHeadline}
            disabled={activeLoading || !activeTopic.trim() || !selectedTactic}
            className="w-full gap-2 text-sm h-11"
          >
            {activeLoading ? <><Loader2 size={16} className="animate-spin" /> Synthesizing...</> : <><Syringe size={16} /> Synthesize Virus</>}
          </Button>

          {activeError && (
            <div className="p-3.5 bg-outrage-muted rounded-lg text-sm text-outrage flex items-center gap-2.5 border border-outrage/20">
              <AlertTriangle size={16} /> {activeError}
            </div>
          )}

          {craftResult && (
            <div className="space-y-3">
              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg border-2 border-curiosity/40 bg-curiosity-muted">
                  <p className="text-xs font-semibold text-curiosity mb-2 uppercase tracking-wide">Healthy Cell</p>
                  <p className="text-base font-serif text-ink leading-snug">{craftResult.neutral_headline}</p>
                </div>
                <div className="p-4 rounded-lg border-2 border-outrage/40 bg-outrage-muted">
                  <p className="text-xs font-semibold text-outrage mb-2 uppercase tracking-wide">Virus — {craftResult.tactic}</p>
                  <p className="text-base font-serif font-semibold text-ink leading-snug">{craftResult.manipulated_headline}</p>
                </div>
              </div>

              {/* The Antibody */}
              {craftResult.the_antibody && (
                <div className="p-4 rounded-lg bg-curiosity-muted border border-curiosity/30">
                  <p className="text-xs font-semibold text-curiosity uppercase tracking-wide mb-2">The Antibody</p>
                  <p className="text-sm text-ink leading-relaxed">{craftResult.the_antibody}</p>
                </div>
              )}

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
                <Zap size={16} /> Try Another Antigen
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
