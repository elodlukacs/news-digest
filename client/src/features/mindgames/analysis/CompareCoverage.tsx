import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Loader2, Link2, Search, AlertTriangle, Scale, Quote, ChevronDown, ChevronUp, History } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';

interface OutletCoverage {
  name: string;
  bias: string;
  headline: string;
  keyQuotes: string[];
  framing: string;
  emphasized: string[];
  omitted: string[];
  tone: string;
}

interface CoverageResult {
  topic: string;
  outlets: OutletCoverage[];
  commonFacts: string[];
  framingDifferences: string;
  narrativeDivergenceScore: number;
  summary: string;
  provider?: string;
}

const BIAS_COLORS: Record<string, string> = {
  'Far Left': '#8B5CF6',
  'Left': '#A855F7',
  'Center-Left': '#3B82F6',
  'Center': '#10B981',
  'Center-Right': '#F59E0B',
  'Right': '#EF4444',
  'Far Right': '#DC2626',
};

const BIAS_ORDER = ['Far Left', 'Left', 'Center-Left', 'Center', 'Center-Right', 'Right', 'Far Right'];

export function CompareCoverage() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'url' | 'topic'>('topic');
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CoverageResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedOutlets, setExpandedOutlets] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { return () => abortRef.current?.abort(); }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const stored = localStorage.getItem('compareCoverageHistory');
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(Array.isArray(parsed) ? parsed.slice(0, 10) : []);
      }
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  }, []);

  const toggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(h => !h);
  };

  const saveToHistory = (data: CoverageResult) => {
    try {
      const stored = localStorage.getItem('compareCoverageHistory');
      const existing: CoverageResult[] = stored ? JSON.parse(stored) : [];
      const updated = [data, ...existing.filter(h => h.topic !== data.topic)].slice(0, 10);
      localStorage.setItem('compareCoverageHistory', JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  const analyze = async () => {
    if (!input.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/compare/coverage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputType === 'url' ? input.trim() : undefined, topic: inputType === 'topic' ? input.trim() : undefined }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Analysis failed');
      const data: CoverageResult = await res.json();
      if (!ctrl.signal.aborted) {
        setResult(data);
        saveToHistory(data);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  const toggleOutlet = (idx: number) => {
    setExpandedOutlets(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const sortedOutlets = result?.outlets
    ? [...result.outlets].sort((a, b) => {
        const idxA = BIAS_ORDER.indexOf(a.bias);
        const idxB = BIAS_ORDER.indexOf(b.bias);
        return idxA - idxB;
      })
    : [];

  const getBiasColor = (bias: string) => BIAS_COLORS[bias] || '#6B7280';

  return (
    <Card className="p-5 h-full flex flex-col gap-4">
      <FeaturePanelHeader
        icon={<Scale size={20} className="text-observation shrink-0" />}
        title="Compare Coverage"
        infoTitle="Compare Coverage"
        researcher="Modelled after Ground News"
        summary="The same event can be a hero story or a villain story depending on who is writing it. This tool makes those framing choices impossible to ignore."
        sections={[
          { heading: 'The Core Insight', content: 'Research shows that the same event is framed fundamentally differently across partisan outlets. "Blindspots" — stories ignored by one side — are as revealing as how stories are covered.' },
          { heading: 'What It Analyses', items: [
            'Framing — what angle or narrative is chosen to present the story',
            'Tone — neutral, alarmist, reassuring, or adversarial',
            'Omissions — what facts each outlet leaves out',
            'Loaded language — emotionally charged words used to prime the reader',
          ]},
          { heading: 'Real Example', content: 'Left: "New Climate Policy to Save Millions of Jobs" · Center: "Government Proposes Carbon Tax Initiative" · Right: "Radical Carbon Tax Threatens Energy Independence." Same event — three entirely different emotional realities.' },
          { heading: 'Narrative Divergence Score', content: 'Measures how far apart the framings are. A high score means the outlets are presenting effectively different realities to their audiences.' },
        ]}
        right={
          <button onClick={toggleHistory} className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer">
            <History size={14} />
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        }
      />

      <p className="text-sm text-ink-muted leading-relaxed">
        Compare how Left, Center, and Right outlets cover the same story. Paste a URL or topic to analyze framing differences.
      </p>

      <Tabs value={inputType} onValueChange={(v) => setInputType(v as 'url' | 'topic')} className="w-full">
        <TabsList className="w-full h-9">
          <TabsTrigger value="topic" className="flex-1 text-sm gap-1.5">
            <Search size={14} />
            Topic
          </TabsTrigger>
          <TabsTrigger value="url" className="flex-1 text-sm gap-1.5">
            <Link2 size={14} />
            URL
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inputType === 'url' ? 'https://example.com/article...' : 'e.g., climate policy, Ukraine war, election...'}
          className="text-[13px] flex-1 border-ink/20 focus:border-masthead h-10"
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
        />
        <Button onClick={analyze} disabled={loading || !input.trim()} className="gap-2 text-[13px] h-10 px-4">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Scale size={15} />}
          Analyze
        </Button>
      </div>

      {showHistory && (
        <div className="max-h-[150px] overflow-y-auto space-y-1.5 border border-rule rounded-md p-2.5 bg-paper-dark">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Recent Comparisons</p>
          {historyLoading && <p className="text-[12px] text-ink-muted">Loading…</p>}
          {!historyLoading && history.length === 0 && <p className="text-[12px] text-ink-muted">No history yet.</p>}
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => { setInput(h.topic); setResult(h); setShowHistory(false); }}
              className="w-full text-left p-2 rounded hover:bg-paper border border-rule/50 cursor-pointer transition-colors"
            >
              <span className="text-[12px] text-ink truncate flex-1 block">{h.topic}</span>
              <span className="text-[11px] text-ink-muted">{h.outlets.length} outlets • divergence {h.narrativeDivergenceScore}%</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-serif font-bold text-ink">{result.topic}</h4>
            {result.narrativeDivergenceScore > 0 && (
              <Badge
                variant="outline"
                className="text-[11px]"
                style={{ borderColor: result.narrativeDivergenceScore > 60 ? 'var(--color-outrage)' : result.narrativeDivergenceScore > 40 ? 'var(--color-curiosity)' : 'var(--color-observation)' }}
              >
                Divergence: {result.narrativeDivergenceScore}%
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {sortedOutlets.map((outlet, idx) => (
              <div
                key={idx}
                className="border border-rule rounded-md bg-paper-dark overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer transition-colors hover:bg-paper-dark/70"
                  onClick={() => toggleOutlet(idx)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[13px] font-serif font-bold text-ink leading-tight">{outlet.name}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0"
                      style={{ color: getBiasColor(outlet.bias), borderColor: getBiasColor(outlet.bias) }}
                    >
                      {outlet.bias}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-ink italic mb-2 leading-relaxed">"{outlet.headline}"</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{outlet.tone}</Badge>
                    {outlet.keyQuotes.length > 0 && (
                      <span className="text-[10px] text-ink-muted flex items-center gap-1">
                        <Quote size={10} /> {outlet.keyQuotes.length} quotes
                      </span>
                    )}
                  </div>
                </div>

                {expandedOutlets.has(idx) && (
                  <div className="border-t border-rule p-3 space-y-3 bg-paper">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">Framing</span>
                      <p className="text-[12px] text-ink leading-relaxed">{outlet.framing}</p>
                    </div>

                    {outlet.emphasized.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">What They Emphasized</span>
                        <ul className="space-y-1">
                          {outlet.emphasized.map((item, i) => (
                            <li key={i} className="text-[12px] text-ink leading-relaxed flex items-start gap-1.5">
                              <span className="text-curiosity mt-0.5">+</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {outlet.omitted.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">What They Omitted</span>
                        <ul className="space-y-1">
                          {outlet.omitted.map((item, i) => (
                            <li key={i} className="text-[12px] text-ink leading-relaxed flex items-start gap-1.5">
                              <span className="text-outrage mt-0.5">−</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {outlet.keyQuotes.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1.5">Key Quotes</span>
                        {outlet.keyQuotes.map((q, i) => (
                          <blockquote key={i} className="text-[12px] text-ink italic border-l-2 border-masthead pl-2 mb-1.5">
                            "{q}"
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {result.framingDifferences && (
            <div className="border-t border-rule pt-4">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block mb-2">Framing Analysis</span>
              <p className="text-[13px] text-ink leading-relaxed">{result.framingDifferences}</p>
            </div>
          )}

          {result.commonFacts.length > 0 && (
            <div className="border-t border-rule pt-4">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block mb-2">Common Facts Across All Coverage</span>
              <ul className="space-y-1.5">
                {result.commonFacts.map((fact, i) => (
                  <li key={i} className="text-[12px] text-ink leading-relaxed flex items-start gap-2">
                    <span className="text-observation mt-0.5">•</span>
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.summary && (
            <div className="border-t border-rule pt-4">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block mb-2">Summary</span>
              <p className="text-[13px] text-ink-light leading-relaxed">{result.summary}</p>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-[12px] text-ink-muted text-center max-w-[280px]">
            Enter a topic or paste a URL to see how different outlets frame the same story.
          </p>
        </div>
      )}
    </Card>
  );
}
