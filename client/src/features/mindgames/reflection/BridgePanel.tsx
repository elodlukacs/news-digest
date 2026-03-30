import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Heart, Plus, X, Globe, AlertTriangle, Check, History, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import type { SchwartzValue, BridgeAudit } from '../../../types';
import { InformationDiet } from './InformationDiet';

interface BridgeResult {
  sorting_analysis: string;
  how_questions: string[];
  shared_value: string;
  bridge_summary: string;
  provider?: string;
}

interface AuditHistoryEntry {
  id: number;
  sources: string;
  siloing_score: number;
  shared_values: string;
  questions: string;
  created_at: string;
}

type Tab = 'audit' | 'bridge' | 'diet';

export function BridgePanel() {
  const [tab, setTab] = useState<Tab>('audit');

  // SOS Audit state
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [audit, setAudit] = useState<BridgeAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Values quiz state
  const [showValues, setShowValues] = useState(false);
  const [values, setValues] = useState<SchwartzValue[]>([]);
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
  const [savedValues, setSavedValues] = useState(false);

  // Bridge builder state
  const [viewA, setViewA] = useState('');
  const [viewB, setViewB] = useState('');
  const [bridgeResult, setBridgeResult] = useState<BridgeResult | null>(null);
  const [bridgeLoading, setBridgeLoading] = useState(false);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AuditHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bridge/audits`);
      setHistory(await res.json());
    } catch { /* ignore */ } finally {
      setHistoryLoading(false);
    }
  }, []);

  const toggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(h => !h);
  };

  const addSource = () => {
    if (!newSource.trim() || sources.includes(newSource.trim())) return;
    setSources([...sources, newSource.trim()]);
    setNewSource('');
  };

  const removeSource = (idx: number) => {
    setSources(sources.filter((_, i) => i !== idx));
  };

  const runAudit = async () => {
    if (sources.length === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setAudit(null);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/bridge/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Audit failed');
      setAudit(await res.json());
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setLoading(false);
    }
  };

  const runBridge = async () => {
    if (!viewA.trim() || !viewB.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBridgeLoading(true);
    setBridgeResult(null);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/bridge/bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewA, viewB }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Bridge analysis failed');
      setBridgeResult(await res.json());
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Bridge analysis failed');
    } finally {
      setBridgeLoading(false);
    }
  };

  const loadValues = async () => {
    try {
      const res = await fetch(`${API_BASE}/bridge/values`);
      setValues(await res.json());
      setShowValues(true);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleValue = (id: string) => {
    setSelectedValues(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSavedValues(false);
  };

  const saveValues = async () => {
    try {
      await fetch(`${API_BASE}/bridge/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: Array.from(selectedValues) }),
      });
      setSavedValues(true);
    } catch { /* ignore */ }
  };

  const isLoading = loading || bridgeLoading;

  return (
    <Card className="p-4 md:p-5 h-full flex flex-col gap-3">
      {/* Header */}
      <FeaturePanelHeader
        icon={<Heart size={17} className="text-curiosity shrink-0" />}
        title="Bridge Builder"
        infoTitle="Bridge Builder"
        researcher="Monica Guzman · I Never Thought of It That Way"
        summary="Disinformation thrives on division. This tool reveals that people across political lines often share the same core values — they just apply them differently."
        sections={[
          { heading: 'The SOS Pattern', items: [
            'Sorting — choosing homogeneous social circles; surrounding yourself with like minds',
            'Othering — dehumanising those on the opposite side; viewing them as an existential threat',
            'Siloing — sinking into exclusive groups where only tribal narratives are reinforced',
          ]},
          { heading: '"How" vs "Why" Questions', content: '"Why do you believe that?" triggers defensiveness and entrenchment. "How did you come to see it that way?" opens curiosity and uncovers personal experience. The AI generates "How" questions to find the human story behind each position.' },
          { heading: 'Schwartz\'s 10 Universal Values', content: 'People often hold the same values — Security, Universalism, Benevolence, Achievement, Self-Direction — but prioritise them differently. The Values Quiz shows two disagreeing people that they share the same core, but diverge only in how they apply those values to a specific issue.' },
          { heading: 'SOS Audit', content: 'Analyse your information diet for echo-chamber patterns. Enter your news sources and the AI measures the degree of siloing — how many genuinely different perspectives you are actually being exposed to.' },
        ]}
        right={
          <button onClick={toggleHistory} aria-label="Toggle audit history" className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer px-1">
            <History size={13} />
            {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 p-0.5 bg-paper-dark rounded-md">
        <button
          onClick={() => setTab('audit')}
          className={`flex-1 py-1.5 text-[11px] md:text-[12px] font-medium uppercase tracking-wider rounded transition-all cursor-pointer ${tab === 'audit' ? 'bg-masthead text-white' : 'text-ink-muted hover:text-ink'}`}
        >
          <span className="md:hidden">SOS</span>
          <span className="hidden md:inline">SOS Audit</span>
        </button>
        <button
          onClick={() => setTab('bridge')}
          className={`flex-1 py-1.5 text-[11px] md:text-[12px] font-medium uppercase tracking-wider rounded transition-all cursor-pointer ${tab === 'bridge' ? 'bg-masthead text-white' : 'text-ink-muted hover:text-ink'}`}
        >
          <span className="md:hidden">Bridge</span>
          <span className="hidden md:inline">Bridge Views</span>
        </button>
        <button
          onClick={() => setTab('diet')}
          className={`flex-1 py-1.5 text-[11px] md:text-[12px] font-medium uppercase tracking-wider rounded transition-all cursor-pointer ${tab === 'diet' ? 'bg-masthead text-white' : 'text-ink-muted hover:text-ink'}`}
        >
          <span className="md:hidden">Diet</span>
          <span className="hidden md:inline">Info Diet</span>
        </button>
      </div>

      {/* History */}
      {showHistory && (
        <div className="max-h-[150px] overflow-y-auto space-y-1.5 border border-rule rounded-md p-2.5 bg-paper-dark">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Past Audits</p>
          {historyLoading && <p className="text-[12px] text-ink-muted">Loading…</p>}
          {!historyLoading && history.length === 0 && <p className="text-[12px] text-ink-muted">No audits yet.</p>}
          {history.map(h => {
            let srcList: string[] = [];
            try { srcList = JSON.parse(h.sources); } catch { /* ignore */ }
            return (
              <div key={h.id} className="p-2 rounded border border-rule/50 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink truncate flex-1">{srcList.join(', ')}</span>
                  <Badge variant="outline" className="text-[11px] px-1.5 shrink-0">
                    Silo: {h.siloing_score}/10
                  </Badge>
                </div>
                <span className="text-[11px] text-ink-muted">{new Date(h.created_at).toLocaleDateString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {tab === 'audit' && (
        <>
          <p className="text-[13px] text-ink-muted leading-relaxed -mt-1">
            Detect Sorting, Othering, and Siloing patterns in your information diet. Discover shared values across divides.
          </p>

          <div className="flex gap-2">
            <Input
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder="Add news source (e.g., BBC, Fox News)..."
              className="text-[13px] flex-1 border-ink/20 focus:border-masthead h-10"
              onKeyDown={(e) => e.key === 'Enter' && addSource()}
              aria-label="Add news source"
            />
            <Button onClick={addSource} disabled={!newSource.trim()} variant="outline" className="px-3 h-10" aria-label="Add source">
              <Plus size={15} />
            </Button>
          </div>

          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-paper-dark rounded-md text-[12px] text-ink border border-rule">
                  {s}
                  <button onClick={() => removeSource(i)} className="text-ink-muted hover:text-ink cursor-pointer" aria-label={`Remove ${s}`}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={runAudit} disabled={isLoading || sources.length === 0} className="flex-1 gap-2 text-[13px] h-10">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Auditing…</> : <><Globe size={15} /> Run SOS Audit</>}
            </Button>
            <Button onClick={loadValues} variant="outline" className="text-[13px] h-10">Values Quiz</Button>
          </div>

          {audit && (
            <div className="space-y-3 flex-1 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Siloing Score</span>
                  <span className="text-[13px] font-bold text-ink">{audit.siloing_score}/10</span>
                </div>
                <div className="h-2 bg-paper-dark rounded-full overflow-hidden border border-rule/50">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${audit.siloing_score * 10}%`,
                      backgroundColor: audit.siloing_score > 7 ? 'var(--color-outrage)' : audit.siloing_score > 4 ? 'var(--color-curiosity)' : 'var(--color-observation)',
                    }}
                  />
                </div>
              </div>

              {audit.sorting_examples && audit.sorting_examples.length > 0 && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">Sorting Patterns</span>
                  {audit.sorting_examples.map((s, i) => (
                    <p key={i} className="text-[12px] text-ink pl-3 border-l-2 border-outrage mb-1.5">{s}</p>
                  ))}
                </div>
              )}

              {audit.how_questions.length > 0 && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">Bridge-Building Questions</span>
                  <ul className="space-y-1.5">
                    {audit.how_questions.map((q, i) => (
                      <li key={i} className="text-[13px] text-ink leading-relaxed pl-3 border-l-2 border-curiosity">"{q}"</li>
                    ))}
                  </ul>
                </div>
              )}

              {audit.shared_values.length > 0 && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">Shared Values</span>
                  <div className="space-y-1.5">
                    {audit.shared_values.map((v, i) => (
                      <div key={i} className="text-[13px]">
                        <span className="font-semibold text-curiosity">{v.value}</span>
                        <span className="text-ink-muted"> — {v.explanation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'bridge' && (
        <>
          <p className="text-[13px] text-ink-muted leading-relaxed -mt-1">
            Enter two opposing viewpoints to find common ground and bridge-building questions.
          </p>

          <Textarea
            value={viewA}
            onChange={(e) => setViewA(e.target.value)}
            placeholder='View A: e.g., "We need stricter climate regulations..."'
            className="text-[13px] resize-none border-ink/20 focus:border-masthead min-h-[80px]"
          />
          <Textarea
            value={viewB}
            onChange={(e) => setViewB(e.target.value)}
            placeholder='View B: e.g., "Climate regulations will destroy jobs..."'
            className="text-[13px] resize-none border-ink/20 focus:border-masthead min-h-[80px]"
          />

          <Button onClick={runBridge} disabled={isLoading || !viewA.trim() || !viewB.trim()} className="w-full gap-2 text-[13px] h-10">
            {bridgeLoading ? <><Loader2 size={15} className="animate-spin" /> Analyzing…</> : <><MessageSquare size={15} /> Find Bridges</>}
          </Button>

          {bridgeResult && (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {bridgeResult.sorting_analysis && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">Sorting Analysis</span>
                  <p className="text-[13px] text-ink leading-relaxed pl-3 border-l-2 border-outrage">{bridgeResult.sorting_analysis}</p>
                </div>
              )}

              {bridgeResult.how_questions.length > 0 && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">Bridge-Building Questions</span>
                  <ul className="space-y-1.5">
                    {bridgeResult.how_questions.map((q, i) => (
                      <li key={i} className="text-[13px] text-ink leading-relaxed pl-3 border-l-2 border-curiosity">"{q}"</li>
                    ))}
                  </ul>
                </div>
              )}

              {bridgeResult.shared_value && (
                <div className="p-3 rounded-md bg-curiosity-muted border border-curiosity/30">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-curiosity">Shared Value</span>
                  <p className="text-[13px] text-ink mt-1">{bridgeResult.shared_value}</p>
                </div>
              )}

              {bridgeResult.bridge_summary && (
                <p className="text-[13px] text-ink-light leading-relaxed">{bridgeResult.bridge_summary}</p>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'diet' && (
        <>
          <p className="text-[13px] text-ink-muted leading-relaxed -mt-1">
            Visualize your news diet as a radial echo-chamber diagram. Discover bias gaps and get recommendations for a healthier information mix.
          </p>
          <InformationDiet />
        </>
      )}

      {showValues && (
        <div className="pt-3 border-t border-rule space-y-2.5 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Schwartz Values Quiz</span>
            <Button onClick={saveValues} size="sm" variant="ghost" className="text-[12px] gap-1 h-7 px-2" disabled={selectedValues.size === 0 || savedValues}>
              {savedValues ? <><Check size={13} /> Saved</> : 'Save'}
            </Button>
          </div>
          <p className="text-[12px] text-ink-muted">Select the values that matter most to you.</p>
          {values.map((v) => (
            <button
              key={v.id}
              onClick={() => toggleValue(v.id)}
              className={`w-full text-left p-3 rounded-md border transition-all text-[13px] cursor-pointer ${
                selectedValues.has(v.id)
                  ? 'border-curiosity bg-curiosity-muted'
                  : 'border-rule hover:border-curiosity/40 bg-paper-dark'
              }`}
            >
              <span className="font-semibold text-ink">{v.name}</span>
              <p className="text-[12px] text-ink-muted mt-0.5">{v.description}</p>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
