import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip';
import { Search, Loader2, AlertTriangle, Brain, History, ChevronDown, ChevronUp, Info, FlaskConical } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import type { ForensicResult, ForensicFallacy, ForensicEntry } from '../../../types';
import { StudyStressTester } from './StudyStressTester';

const FALLACY_DEFINITIONS: Record<string, string> = {
  'Ad Hominem': 'Attacking the person making the argument rather than the argument itself.',
  'False Dichotomy': 'Presenting only two options when more exist. Also called false dilemma or black-and-white thinking.',
  'Appeal to Nature': 'Arguing that something is good because it is "natural" or bad because it is "unnatural."',
  'Post Hoc': 'Assuming that because B followed A, A must have caused B. Correlation is not causation.',
  'Appeal to Emotion': 'Using emotional manipulation (fear, pity, outrage) instead of logical argument.',
  'Straw Man': 'Misrepresenting someone\'s argument to make it easier to attack.',
  'Bandwagon': 'Arguing something is true or good because many people believe or do it.',
  'Slippery Slope': 'Claiming one event will inevitably lead to extreme consequences without justification.',
  'Appeal to Authority': 'Using an authority figure\'s opinion as evidence, especially outside their expertise.',
  'Red Herring': 'Introducing an irrelevant topic to divert attention from the original issue.',
  'Appeal to Tradition': 'Arguing something is better because it has always been done that way.',
  'False Equivalence': 'Treating two things as equal when they differ in important ways.',
  "Gambler's Fallacy": 'Believing independent random events balance out (e.g., a win is "due").',
  'Cherry Picking': 'Selecting only data that supports your claim while ignoring contradicting evidence.',
};

export function ForensicPanel() {
  const [activeTab, setActiveTab] = useState<'forensic' | 'study'>('forensic');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ForensicResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamStep, setStreamStep] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ForensicEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { return () => abortRef.current?.abort(); }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/forensics/history?limit=10`);
      setHistory(await res.json());
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  }, []);

  const toggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(h => !h);
  };

  const analyze = async () => {
    if (text.trim().length < 20) return;
    const trimmed = text.trim().slice(0, 5000);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    setResult(null);
    setStreamStep('');

    try {
      const res = await fetch(`${API_BASE}/forensics/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Analysis failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming not supported');

      const decoder = new TextDecoder();
      let buffer = '';
      const partial: Partial<ForensicResult> = { fallacies: [] };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        let event = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) { event = line.slice(7); }
          else if (line.startsWith('data: ') && event) {
            try {
              const data = JSON.parse(line.slice(6));
              if (event === 'status') setStreamStep(data.message || '');
              if (event === 'fallacies') { partial.fallacies = data.fallacies || []; setStreamStep('Fallacies detected…'); }
              if (event === 'intensity') { partial.emotional_intensity = data.emotional_intensity; setStreamStep('Scoring intensity…'); }
              if (event === 'funnel') { partial.funnel_stage = data.funnel_stage; setStreamStep('Mapping funnel…'); }
              if (event === 'done') { partial.summary = data.summary; partial.bias_score = data.bias_score; partial.provider = data.provider; setResult(partial as ForensicResult); setStreamStep(''); }
              if (event === 'error') throw new Error(data.error);
            } catch (e) { if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e; }
            event = '';
          }
        }
      }
      if (!partial.summary && partial.fallacies && partial.fallacies.length > 0) setResult(partial as ForensicResult);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStreamStep('');
    } finally { setLoading(false); }
  };

  const getFallacyTooltip = (name: string) =>
    FALLACY_DEFINITIONS[Object.keys(FALLACY_DEFINITIONS).find(k => name.toLowerCase().includes(k.toLowerCase())) || ''] || '';

  return (
    <Card className="p-5 md:p-6 h-full flex flex-col gap-5">
      <FeaturePanelHeader
        icon={
          activeTab === 'forensic' ? (
            <Search size={20} className="text-observation shrink-0" />
          ) : (
            <FlaskConical size={20} className="text-curiosity shrink-0" />
          )
        }
        title="Take Apart This Article"
        infoTitle="Take Apart This Article"
        researcher="David Robert Grimes · Dan Ariely"
        summary="Paste any article or headline and watch AI deconstruct it — mapping logical fallacies and psychological manipulation stages in real time, with a 0–10 emotional intensity score."
        sections={[
          { heading: 'Fallacies It Detects', items: [
            'Post hoc ergo propter hoc — assuming causation from correlation ("it followed A, so A caused it")',
            'Ad hominem — attacking the person instead of the argument',
            'False dichotomy — presenting only two options when many exist',
            'Appeal to nature — assuming "natural" means better or safer',
            "Gambler's Fallacy — believing independent random events must balance out",
          ]},
          { heading: 'The Funnel of Misbelief (Ariely)', items: [
            'Emotional — acute stress triggers search for simple, deterministic narratives and external villains',
            'Cognitive — confirmation bias kicks in; information is filtered to support the new narrative',
            'Personal — gut feelings and creative pattern-linking override evidence',
            'Social — group belonging is prioritised over factual accuracy',
          ]},
          { heading: 'Why Non-Judgmental', content: 'The analysis is educational, never accusatory. The goal is to make invisible manipulation visible — not to label content as fake or the reader as gullible.' },
        ]}
        right={
          <div className="flex items-center gap-1 bg-paper-dark rounded-md p-0.5 border border-rule">
            <button
              onClick={() => setActiveTab('forensic')}
              aria-label="Forensic analysis"
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'forensic'
                  ? 'bg-ink text-paper'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Search size={13} />
              <span className="hidden sm:inline">Analyze</span>
            </button>
            <button
              onClick={() => setActiveTab('study')}
              aria-label="Study analysis"
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'study'
                  ? 'bg-ink text-paper'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <FlaskConical size={13} />
              <span className="hidden sm:inline">Study</span>
            </button>
          </div>
        }
      />

      {activeTab === 'forensic' ? (
        <>
          <p className="text-sm text-ink-muted leading-relaxed">
            Paste an article or headline to detect logical fallacies, emotional manipulation, and cognitive vulnerabilities.
          </p>

          {/* History */}
          {showHistory && (
            <div className="max-h-[150px] overflow-y-auto space-y-1.5 border border-rule rounded-lg p-2.5 bg-paper-dark">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Recent Analyses</p>
              {historyLoading && <p className="text-sm text-ink-muted">Loading…</p>}
              {!historyLoading && history.length === 0 && <p className="text-sm text-ink-muted">No history yet.</p>}
              {history.map(h => (
                <button key={h.id} onClick={() => { setText(h.raw_text); setShowHistory(false); }}
                  className="w-full text-left p-2 rounded hover:bg-paper border border-rule/50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink truncate flex-1">{h.raw_text.slice(0, 70)}…</span>
                    <span className="text-xs text-ink-muted shrink-0 font-medium">bias {h.bias_score}/10</span>
                  </div>
                  <span className="text-[10px] text-ink-muted">{new Date(h.created_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          )}

          {/* Textarea */}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste an article or headline to analyze…"
            className="flex-1 min-h-[120px] text-sm resize-none border-ink/20 focus:border-masthead"
          />

          {/* Analyze button */}
          <Button onClick={analyze} disabled={loading || text.trim().length < 20} className="w-full gap-2 text-sm h-11">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Analyzing…</> : <><Search size={15} /> Analyze Text</>}
          </Button>

          {streamStep && <p className="text-sm text-observation animate-pulse -mt-1">{streamStep}</p>}

          {error && (
            <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {/* Emotional intensity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Emotional charge</span>
                  <span className="text-[13px] font-bold text-ink">{result.emotional_intensity}/10</span>
                </div>
                <div className="h-2 bg-paper-dark rounded-full overflow-hidden border border-rule/50">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${result.emotional_intensity * 10}%`,
                    backgroundColor: result.emotional_intensity > 7 ? 'var(--color-outrage)' : result.emotional_intensity > 4 ? 'var(--color-curiosity)' : 'var(--color-observation)',
                  }} />
                </div>
              </div>

              {result.funnel_stage && (
                <div className="flex items-center gap-2">
                  <Brain size={13} className="text-curiosity" />
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Persuasion technique:</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span><Badge variant="outline" className="text-[11px] cursor-help px-2">{result.funnel_stage}</Badge></span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px] text-[11px]">
                      Ariely's Funnel of Misbelief: Emotional stress → cognitive shortcuts → pattern-seeking → social isolation in echo chambers.
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              {result.fallacies.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Detected Fallacies</span>
                  {result.fallacies.map((f: ForensicFallacy, i: number) => {
                    const tooltip = getFallacyTooltip(f.name);
                    return (
                      <div key={i} className="p-3 bg-paper-dark rounded-md text-[12px] border-l-2" style={{ borderColor: 'var(--color-outrage)' }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-bold text-ink">{f.name}</span>
                          {tooltip && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help text-ink-muted"><Info size={12} /></span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[240px] text-[11px]">{tooltip}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {f.evidence && <p className="text-ink-muted italic mb-0.5">"{f.evidence}"</p>}
                        {f.explanation && <p className="text-ink-light">{f.explanation}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {result.summary && <p className="text-[13px] text-ink-light leading-relaxed">{result.summary}</p>}
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 min-h-0">
          <StudyStressTester />
        </div>
      )}

      {activeTab === 'forensic' && !result && !loading && (
        <button onClick={toggleHistory} className="flex items-center justify-center gap-1 text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer py-1 -mb-1">
          <History size={13} />
          {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          <span>{showHistory ? 'Hide History' : 'Show History'}</span>
        </button>
      )}
    </Card>
  );
}
