import { useState, useRef, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Search, StopCircle, Eye, FileSearch, Link, CheckCircle, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';

interface OutletFound {
  name: string;
  stance: 'supports' | 'contradicts' | 'neutral';
  excerpt: string;
}

interface SiftResult {
  input: string;
  stop: { initialReaction: string; gutCheck: string; pauseAdvice: string };
  investigate: { sourceName: string; credibility: number; bias: string; expertise: string; agenda: string };
  findCoverage: { outletsFound: OutletFound[] };
  traceClaims: { originalSource: string; evidenceQuality: string; chainIntact: boolean | null };
  overallCredibility: number;
  verdict: string;
  siftTips: string[];
  provider?: string;
}

const SIFT_STEPS = [
  { key: 'stop', label: 'S — Stop', icon: StopCircle, color: 'text-red-500', desc: 'Pause before reacting' },
  { key: 'investigate', label: 'I — Investigate', icon: Eye, color: 'text-blue-500', desc: 'Who is behind this?' },
  { key: 'find', label: 'F — Find Coverage', icon: FileSearch, color: 'text-green-500', desc: 'What do others say?' },
  { key: 'trace', label: 'T — Trace Claims', icon: Link, color: 'text-purple-500', desc: 'Where does it come from?' },
];

function CredibilityMeter({ score }: { score: number }) {
  const color = score <= 3 ? 'bg-red-500' : score <= 6 ? 'bg-yellow-500' : 'bg-green-500';
  const label = score <= 2 ? 'Very Low' : score <= 4 ? 'Low' : score <= 6 ? 'Moderate' : score <= 8 ? 'High' : 'Very High';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-ink-muted">
        <span>Credibility</span>
        <span className="font-semibold text-ink">{score}/10 — {label}</span>
      </div>
      <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score * 10}%` }} />
      </div>
    </div>
  );
}

export function SourceCredibilityLab() {
  const selectedLlm = useLlm();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<SiftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revealedSteps, setRevealedSteps] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async () => {
    if (input.trim().length < 5) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    setResult(null);
    setRevealedSteps(new Set());

    try {
      const res = await fetch(`${API_BASE}/source-lab/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), provider: selectedLlm }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Analysis failed');
      const data = await res.json();
      if (!ctrl.signal.aborted) {
        setResult(data);
        // Reveal first step automatically
        setRevealedSteps(new Set(['stop']));
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [input, selectedLlm]);

  const revealNext = () => {
    if (!result) return;
    const order = ['stop', 'investigate', 'find', 'trace'];
    const current = order.findIndex(k => !revealedSteps.has(k));
    if (current >= 0) setRevealedSteps(prev => new Set([...prev, order[current]]));
  };

  const allRevealed = result && revealedSteps.size >= 4;

  return (
    <Card className="p-5 md:p-6 flex flex-col gap-4">
      <FeaturePanelHeader
        icon={<Search size={20} className="text-curiosity shrink-0" />}
        title="Source Credibility Lab"
        infoTitle="Source Credibility Lab"
        researcher="Mike Caulfield · SIFT Method"
        summary="Every source has an agenda. The SIFT method (Stop, Investigate, Find coverage, Trace claims) gives you a repeatable framework to evaluate any URL or claim in under 60 seconds."
        sections={[
          { heading: 'SIFT Method', items: [
            'STOP — Pause before sharing. Check your emotional reaction.',
            'INVESTIGATE — Who published this? What is their track record and agenda?',
            'FIND — What do other credible outlets say about the same topic?',
            'TRACE — Where does the original claim come from? Is the evidence chain intact?',
          ]},
          { heading: 'When To Use', content: 'Use SIFT whenever a headline makes you feel strong emotion — outrage, fear, vindication. That emotional spike is exactly when you\'re most likely to share without checking.' },
        ]}
      />

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a URL or claim to evaluate"
          className="flex-1 text-sm h-11"
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
        />
        <Button onClick={analyze} disabled={loading || input.trim().length < 5} className="gap-2 text-sm h-11">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          <span>SIFT it</span>
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-200 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Step-by-step reveal */}
          {SIFT_STEPS.map((step) => {
            if (!revealedSteps.has(step.key)) return null;

            const Icon = step.icon;
            return (
              <div key={step.key} className="rounded-lg border border-rule bg-paper-dark overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-rule/50">
                  <Icon size={16} className={step.color} />
                  <span className="text-sm font-semibold text-ink">{step.label}</span>
                  <span className="text-xs text-ink-muted ml-auto">{step.desc}</span>
                </div>
                <div className="p-4 space-y-3">
                  {step.key === 'stop' && (
                    <>
                      <div>
                        <p className="text-xs text-ink-muted mb-0.5">Your gut reaction</p>
                        <p className="text-sm text-ink">{result.stop.initialReaction}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted mb-0.5">Gut check</p>
                        <p className="text-sm text-ink">{result.stop.gutCheck}</p>
                      </div>
                      <div className="p-2.5 rounded bg-curiosity-muted border border-curiosity/20">
                        <p className="text-xs font-semibold text-curiosity mb-0.5">Pause advice</p>
                        <p className="text-sm text-ink">{result.stop.pauseAdvice}</p>
                      </div>
                    </>
                  )}

                  {step.key === 'investigate' && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">Source</p>
                          <p className="text-sm font-semibold text-ink">{result.investigate.sourceName}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{result.investigate.bias}</Badge>
                      </div>
                      <CredibilityMeter score={result.investigate.credibility} />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">Expertise</p>
                          <p className="text-sm text-ink">{result.investigate.expertise}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">Agenda</p>
                          <p className="text-sm text-ink">{result.investigate.agenda}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {step.key === 'find' && (
                    <>
                      <p className="text-xs text-ink-muted">Other outlets covering this topic:</p>
                      {result.findCoverage.outletsFound.length === 0 ? (
                        <p className="text-sm text-ink-muted italic">No other coverage found — this is itself a red flag.</p>
                      ) : (
                        <div className="space-y-2">
                          {result.findCoverage.outletsFound.map((o, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded border border-rule">
                              {o.stance === 'supports'
                                ? <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                                : o.stance === 'contradicts'
                                  ? <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                  : <AlertTriangle size={14} className="text-yellow-500 mt-0.5 shrink-0" />
                              }
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-ink">{o.name}</span>
                                  <Badge variant="outline" className="text-[10px]">{o.stance}</Badge>
                                </div>
                                <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{o.excerpt}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {step.key === 'trace' && (
                    <>
                      <div>
                        <p className="text-xs text-ink-muted mb-0.5">Original source</p>
                        <p className="text-sm text-ink">{result.traceClaims.originalSource}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted mb-0.5">Evidence quality</p>
                        <p className="text-sm text-ink">{result.traceClaims.evidenceQuality}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-muted">Evidence chain intact:</span>
                        {result.traceClaims.chainIntact === true
                          ? <CheckCircle size={14} className="text-green-500" />
                          : result.traceClaims.chainIntact === false
                            ? <XCircle size={14} className="text-red-500" />
                            : <AlertTriangle size={14} className="text-yellow-500" />
                        }
                        <span className="text-sm text-ink">
                          {result.traceClaims.chainIntact === true ? 'Yes' : result.traceClaims.chainIntact === false ? 'No' : 'Unclear'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Reveal next step button */}
          {!allRevealed && (
            <Button onClick={revealNext} variant="outline" className="w-full gap-2 h-10">
              <ChevronRight size={16} />
              Next SIFT step
            </Button>
          )}

          {/* Final verdict */}
          {allRevealed && (
            <div className="space-y-3">
              <CredibilityMeter score={result.overallCredibility} />
              <div className="p-4 rounded-lg border border-rule bg-paper-dark">
                <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">Verdict</p>
                <p className="text-sm text-ink leading-relaxed">{result.verdict}</p>
              </div>

              {result.siftTips.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">SIFT Tips</p>
                  <ul className="space-y-1.5">
                    {result.siftTips.map((tip, i) => (
                      <li key={i} className="text-sm text-ink pl-3 border-l-2 border-curiosity/30">{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
