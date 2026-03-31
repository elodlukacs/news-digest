import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Slider } from '../../../components/ui/slider';
import { Badge } from '../../../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Loader2, Microscope, MessageSquare, AlertTriangle, Brain, History, ChevronDown, ChevronUp, Info, TrendingUp } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import type { DebateResponse, RethinkingEntry } from '../../../types';
import { JournalTrends } from './JournalTrends';

interface Props {
  selectedLlm?: string;
}

type ThinkingMode = 'scientist' | 'preacher' | 'prosecutor' | 'politician' | 'unknown';

const THINKING_MODES: Record<ThinkingMode, { label: string; color: string; description: string; shortLabel: string }> = {
  scientist: { label: 'Scientist', color: 'var(--color-observation)', description: 'Searching for reality. Questioning assumptions, iterating on data, and embracing doubt.', shortLabel: 'Open to evidence' },
  preacher: { label: 'Preacher', color: 'var(--color-outrage)', description: 'Defending the Truth. Delivering sermons to protect ideals and ignoring contradictions.', shortLabel: 'Certain of the truth' },
  prosecutor: { label: 'Prosecutor', color: 'var(--color-outrage)', description: "Winning the Argument. Marshalling evidence only to prove the opponent's flaws.", shortLabel: 'Attacking the other side' },
  politician: { label: 'Politician', color: 'var(--color-curiosity)', description: 'Gaining Approval. Campaigning for support, often by flip-flopping.', shortLabel: 'Seeking approval' },
  unknown: { label: 'Enter a claim', color: 'var(--color-ink-muted)', description: '', shortLabel: '' },
};

function detectThinkingMode(claim: string, confidence: number): ThinkingMode {
  if (!claim.trim()) return 'unknown';
  const lower = claim.toLowerCase();

  if (confidence >= 95) return 'preacher';

  const prosecutorSignals = ['wrong', 'stupid', 'idiotic', 'obviously', 'clearly wrong', 'proven false', 'debunked', 'anyone who', 'people who believe'];
  if (prosecutorSignals.some(s => lower.includes(s))) return 'prosecutor';

  const preacherSignals = ['must', 'should always', 'the truth is', 'undeniably', 'without question', 'absolutely', 'everyone knows', 'it is certain'];
  if (preacherSignals.some(s => lower.includes(s))) return 'preacher';

  const politicianSignals = ['most people think', 'popular opinion', 'everyone agrees', 'polls show', 'the majority'];
  if (politicianSignals.some(s => lower.includes(s))) return 'politician';

  const scientistSignals = ['i think', 'i believe', 'might', 'perhaps', 'seems like', 'evidence suggests', 'research shows', 'could be', 'hypothesis'];
  if (scientistSignals.some(s => lower.includes(s))) return 'scientist';

  if (confidence > 80) return 'preacher';
  if (confidence < 30) return 'scientist';

  return 'unknown';
}

export function ScientistPanel({ selectedLlm }: Props) {
  const [claim, setClaim] = useState('');
  const [debate, setDebate] = useState<DebateResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialConfidence, setInitialConfidence] = useState(50);
  const [postSlider, setPostSlider] = useState([50]);
  const [recorded, setRecorded] = useState<{ initial: number; final: number } | null>(null);
  const [showJournal, setShowJournal] = useState(false);
  const [journal, setJournal] = useState<RethinkingEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const loadJournal = useCallback(async () => {
    setJournalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/scientist/journal`);
      setJournal(await res.json());
    } catch { /* ignore */ } finally {
      setJournalLoading(false);
    }
  }, []);

  const toggleJournal = () => {
    if (!showJournal) loadJournal();
    setShowJournal(j => !j);
  };

  const runDebate = async () => {
    if (claim.trim().length < 10) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setDebate(null);
    setError('');
    setRecorded(null);
    setPostSlider([50]);

    try {
      const res = await fetch(`${API_BASE}/scientist/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim, provider: selectedLlm || null }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Debate failed');
      const data = await res.json();
      setDebate(data.debate || data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Debate failed');
    } finally {
      setLoading(false);
    }
  };

  const recordShift = async () => {
    const final = postSlider[0];
    const mode = detectThinkingMode(claim, initialConfidence);

    try {
      await fetch(`${API_BASE}/scientist/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: claim,
          initialConfidence,
          finalConfidence: final,
          shiftingEvidence: initialConfidence === 100 && final === 100 ? 'PROVE_IT_FALSE: user said nothing would change their mind' : '',
          mode: mode === 'unknown' ? 'scientist' : mode,
        }),
      });
    } catch { /* ignore */ }

    setRecorded({ initial: initialConfidence, final });
  };

  const personaColors: Record<string, string> = {
    'The Evidence Skeptic': 'var(--color-observation)',
    'The Institutionalist': 'var(--color-curiosity)',
    'The Moralist': 'var(--color-outrage)',
  };

  const thinkingMode = detectThinkingMode(claim, initialConfidence);
  const modeInfo = THINKING_MODES[thinkingMode];

  return (
    <Card className="p-5 md:p-6 h-full flex flex-col gap-5">
      {/* Header */}
      <div className="space-y-1.5">
          <FeaturePanelHeader
            icon={<Microscope size={20} className="text-curiosity shrink-0" />}
            title="Scientist's Sandbox"
            infoTitle="Scientist's Sandbox"
            researcher="Adam Grant · Think Again"
            summary="Most of us debate in Preacher, Prosecutor, or Politician mode — all counterproductive. This tool shifts you into Scientist mode: treating your beliefs as hypotheses, not identities."
            sections={[
              { heading: 'The Four Thinking Modes', items: [
                'Preacher — goal: defend sacred truth. Delivers sermons; ignores contradictions',
                'Prosecutor — goal: win the argument. Marshals evidence only to prove others wrong',
                'Politician — goal: gain approval. Campaigns for support, often flip-flopping',
                'Scientist — goal: search for reality. Questions assumptions; embraces doubt; iterates on evidence',
              ]},
              { heading: 'The ADEPT Debate', content: 'Three parallel AI personas — The Sceptic, The Institutionalist, The Moralist — simultaneously challenge your belief from different angles, like a stress test for your reasoning.' },
              { heading: '"Prove It False" Test', content: 'When you express a strong opinion, the system asks: "What specific evidence would it take to change your mind?" If the answer is "nothing," you\'ve moved from Scientist mode into Preacher or Prosecutor mode.' },
              { heading: 'Rethinking Journal', content: 'Track your confidence before and after each debate. The change in confidence is the learning. Grant\'s insight: detaching opinions from identity is crucial — define yourself by your values, not your current beliefs.' },
              { heading: 'Counterintuitive Finding', content: 'When experts admit uncertainty, they become MORE persuasive — people pay more attention to the substance of arguments rather than dismissing them.' },
            ]}
            right={<button onClick={toggleJournal} aria-label="Toggle journal history" className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer px-1">
              <History size={14} />
              {showJournal ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>}
          />
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Enter a belief, set your confidence, then see three AI personas challenge it — like Adam Grant's "Think Again."
      </p>

      {/* Journal */}
      {showJournal && (
        <div className="max-h-[180px] overflow-y-auto space-y-1.5 border border-rule rounded-lg p-2.5 bg-paper-dark">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Rethinking Journal</p>
          {journalLoading && <p className="text-sm text-ink-muted">Loading…</p>}
          {!journalLoading && journal.length === 0 && <p className="text-sm text-ink-muted">No entries yet. Complete a debate to record belief shifts.</p>}
          {journal.map(j => {
            const shifted = j.final_confidence !== j.initial_confidence;
            const direction = j.final_confidence > j.initial_confidence ? 'up' : j.final_confidence < j.initial_confidence ? 'down' : 'same';
            return (
              <div key={j.id} className="p-2 rounded border border-rule/50 text-sm">
                <p className="text-ink font-medium truncate">{j.topic}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-muted">
                  <span>{j.initial_confidence}% {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'} {j.final_confidence}%</span>
                  {shifted && <Badge variant="outline" className="text-[10px] px-1.5" style={{ borderColor: 'var(--color-observation)' }}>shifted</Badge>}
                  {j.mode && <Badge variant="outline" className="text-[10px] px-1.5">{j.mode}</Badge>}
                  <span className="ml-auto">{new Date(j.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Tabs defaultValue="debate" className="flex-1 flex flex-col">
        <TabsList className="h-9 p-1 gap-1">
          <TabsTrigger value="debate" className="text-[11px] h-7 px-3 gap-1.5">
            <MessageSquare size={12} /> Debate
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-[11px] h-7 px-3 gap-1.5">
            <TrendingUp size={12} /> Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debate" className="flex-1 flex flex-col gap-3 mt-0">
          {/* Claim textarea */}
          <Textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="I believe that [claim]..."
            className="flex-1 min-h-[100px] text-sm resize-none border-ink/20 focus:border-masthead"
          />

      {/* Confidence slider (before debate) */}
      {!debate && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Your Confidence</span>
              <span className="text-[13px] font-bold text-ink">{initialConfidence}%</span>
            </div>
            <Slider value={[initialConfidence]} onValueChange={(v) => setInitialConfidence(v[0])} min={0} max={100} step={5} />
          </div>

          {thinkingMode !== 'unknown' && (
            <div className="p-3 rounded-md border text-[12px]" style={{ borderColor: modeInfo.color, backgroundColor: `color-mix(in oklch, ${modeInfo.color} 8%, transparent)` }}>
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[11px]" style={{ color: modeInfo.color }}>
                  {modeInfo.label} Mode
                </span>
                {modeInfo.shortLabel && (
                  <span className="text-[11px] text-ink-muted">{modeInfo.shortLabel}</span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-ink-muted"><Info size={12} /></span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-[11px]">{modeInfo.description}</TooltipContent>
                </Tooltip>
              </div>
              {thinkingMode !== 'scientist' && (
                <p className="text-ink-muted mt-1">Try shifting to Scientist mode: treat your belief as a hypothesis to test.</p>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Deliberate button */}
      <Button onClick={runDebate} disabled={loading || claim.trim().length < 10} className="w-full gap-2 text-sm h-11">
        {loading ? <><Loader2 size={15} className="animate-spin" /> Deliberating…</> : <><MessageSquare size={15} /> Deliberate</>}
      </Button>

      {/* Debate results */}
      {debate && (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {debate.map((d, i) => (
            <div key={i} className="border-l-2 pl-3 py-1" style={{ borderColor: personaColors[d.persona] || 'var(--color-rule)' }}>
              <p className="text-[11px] uppercase tracking-wider font-bold" style={{ color: personaColors[d.persona] || 'var(--color-ink-muted)' }}>
                {d.persona}
              </p>
              <p className="text-[13px] text-ink leading-relaxed mt-1 whitespace-pre-line">{d.response}</p>
            </div>
          ))}

          {recorded === null && (
            <div className="pt-3 border-t border-rule space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Confidence After</span>
                <span className="text-[13px] font-bold text-ink">{postSlider[0]}%</span>
              </div>
              <Slider value={postSlider} onValueChange={setPostSlider} min={0} max={100} step={5} />
              <Button onClick={recordShift} variant="outline" className="w-full text-sm h-11 gap-2">
                <Brain size={15} /> Record Belief Shift
              </Button>
              {postSlider[0] === 100 && initialConfidence === 100 && (
                <p className="text-[12px] text-outrage text-center">Still at 100%? If nothing could change your mind, you may be in Preacher mode.</p>
              )}
            </div>
          )}

          {recorded !== null && (
            <div className="pt-3 border-t border-rule text-center">
              <p className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Belief Shift Recorded</p>
              <p className="text-[15px] text-ink mt-1 font-semibold">
                {recorded.final > recorded.initial ? '↑' : recorded.final < recorded.initial ? '↓' : '→'} {recorded.initial}% → {recorded.final}%
              </p>
            </div>
          )}
        </div>
      )}
        </TabsContent>

        <TabsContent value="trends" className="flex-1 mt-0">
          <JournalTrends compact />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
