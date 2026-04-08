import { useState, useRef, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Clock, ArrowRight, AlertTriangle, History } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';

interface Campaign {
  year: number;
  name: string;
  description: string;
  tactic: string;
  target: string;
  outcome: string;
  modernParallel: string;
  modernTactic: string;
}

export function PropagandaTimeline() {
  const selectedLlm = useLlm();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    setCampaigns([]);
    setExpandedIdx(null);

    try {
      const res = await fetch(`${API_BASE}/propaganda-timeline/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 8, provider: selectedLlm }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate');
      const data = await res.json();
      if (!ctrl.signal.aborted) setCampaigns(data.campaigns || []);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to generate timeline');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [selectedLlm]);

  return (
    <Card className="p-5 md:p-6 flex flex-col gap-4">
      <FeaturePanelHeader
        icon={<History size={20} className="text-outrage shrink-0" />}
        title="Propaganda Timeline"
        infoTitle="Propaganda Timeline"
        researcher="Edward Bernays · Hannah Arendt · Noam Chomsky"
        summary="Disinformation tactics are not new — they are ancient patterns adapted to new technology. This timeline maps historical propaganda campaigns to their modern equivalents, revealing the recurring playbook."
        sections={[
          { heading: 'Why History Matters', content: 'The same psychological mechanisms exploited in 1930s propaganda are at work in 2020s social media manipulation. Recognizing historical patterns is one of the strongest defenses against modern disinfo.' },
        ]}
      />

      <Button onClick={generate} disabled={loading} className="gap-2 h-11 w-full">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Generating timeline...</> : <><Clock size={16} /> Generate Timeline</>}
      </Button>

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-200 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-rule" />

          <div className="space-y-0">
            {campaigns.map((c, i) => {
              const expanded = expandedIdx === i;
              return (
                <div key={i} className="relative pl-12 pb-6">
                  {/* Timeline dot */}
                  <div className={`absolute left-3.5 top-1 w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                    expanded ? 'bg-outrage border-outrage' : 'bg-paper border-ink-muted'
                  }`} />

                  {/* Year badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] font-mono">{c.year}</Badge>
                    <span className="text-xs text-ink-muted">{c.tactic}</span>
                  </div>

                  {/* Main content */}
                  <button
                    onClick={() => setExpandedIdx(expanded ? null : i)}
                    className="w-full text-left cursor-pointer group"
                  >
                    <h4 className="text-sm font-serif font-bold text-ink group-hover:text-outrage transition-colors">
                      {c.name}
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{c.description}</p>
                  </button>

                  {expanded && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">Target</p>
                          <p className="text-sm text-ink">{c.target}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">Outcome</p>
                          <p className="text-sm text-ink">{c.outcome}</p>
                        </div>
                      </div>

                      {/* Modern parallel */}
                      <div className="p-3 rounded-lg border-2 border-dashed border-outrage/30 bg-outrage-muted/50">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <ArrowRight size={12} className="text-outrage" />
                          <span className="text-xs font-semibold text-outrage uppercase tracking-wide">Modern Parallel</span>
                        </div>
                        <p className="text-sm text-ink leading-relaxed">{c.modernParallel}</p>
                        {c.modernTactic && (
                          <p className="text-xs text-ink-muted mt-1.5">Same mechanism: {c.modernTactic}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
