import { useState, useRef, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Loader2, FlaskConical, AlertTriangle, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';

interface Dimension {
  name: string;
  analysis: string;
  score: number;
}

interface AnatomyResult {
  claim: string;
  dimensions: Dimension[];
  overallVulnerability: number;
  antibody: string;
  relatedConspiracies: string[];
  provider?: string;
}

const DIMENSION_COLORS: Record<string, string> = {
  'Emotional Need': 'border-purple-300 bg-purple-50',
  'Kernel of Truth': 'border-blue-300 bg-blue-50',
  'Logical Leap': 'border-orange-300 bg-orange-50',
  'Unfalsifiability Trap': 'border-red-300 bg-red-50',
  'Social Function': 'border-green-300 bg-green-50',
};

const DIMENSION_ICONS: Record<string, string> = {
  'Emotional Need': '💜',
  'Kernel of Truth': '🔵',
  'Logical Leap': '🟠',
  'Unfalsifiability Trap': '🔴',
  'Social Function': '🟢',
};

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score <= 3 ? 'bg-green-500' : score <= 6 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-ink/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-ink w-6 text-right">{score}/10</span>
    </div>
  );
}

export function ConspiracyAnatomyPanel() {
  const selectedLlm = useLlm();
  const [claim, setClaim] = useState('');
  const [result, setResult] = useState<AnatomyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async () => {
    if (claim.trim().length < 10) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    setResult(null);
    setExpandedDim(null);

    try {
      const res = await fetch(`${API_BASE}/conspiracy-anatomy/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: claim.trim(), provider: selectedLlm }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Analysis failed');
      const data = await res.json();
      if (!ctrl.signal.aborted) setResult(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [claim, selectedLlm]);

  return (
    <Card className="p-5 md:p-6 flex flex-col gap-4">
      <FeaturePanelHeader
        icon={<FlaskConical size={20} className="text-outrage shrink-0" />}
        title="Conspiracy Anatomy Lab"
        infoTitle="Conspiracy Anatomy Lab"
        researcher="Karen Douglas · Jan-Willem van Prooijen"
        summary="Conspiracy theories are psychological ecosystems — they survive not because of evidence, but because they serve deep emotional and social needs. This tool deconstructs any claim across 5 dimensions identified by conspiracy psychology research."
        sections={[
          { heading: '5 Dimensions', items: [
            'Emotional Need — What void does this narrative fill? (fear, control, belonging)',
            'Kernel of Truth — What legitimate grievance does it build on?',
            'Logical Leap — Where does reasoning break from evidence to speculation?',
            'Unfalsifiability Trap — How is it structured so disproof becomes proof?',
            'Social Function — What group identity does it reinforce?',
          ]},
          { heading: 'How To Use', content: 'Paste any conspiracy claim — from flat earth to QAnon to wellness conspiracies. The AI analyzes it across all 5 dimensions and gives you an "antibody" — how to engage constructively with believers.' },
        ]}
      />

      <div className="space-y-2">
        <Textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="Paste a conspiracy claim to deconstruct (e.g., 'The moon landing was faked by NASA')"
          className="text-sm min-h-[80px] resize-none"
        />
        <Button
          onClick={analyze}
          disabled={loading || claim.trim().length < 10}
          className="w-full gap-2 h-11"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Analyzing anatomy...</> : <><FlaskConical size={16} /> Deconstruct</>}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-200 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Overall score */}
          <div className="text-center p-4 rounded-lg border border-rule bg-paper-dark">
            <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">Overall Vulnerability</p>
            <ScoreBar score={result.overallVulnerability} />
            <p className="text-xs text-ink-muted mt-1.5">
              {result.overallVulnerability <= 3 ? 'Low emotional grip' : result.overallVulnerability <= 6 ? 'Moderate psychological appeal' : 'High cognitive vulnerability'}
            </p>
          </div>

          {/* 5 dimensions */}
          <div className="space-y-2">
            {result.dimensions.map((dim) => {
              const expanded = expandedDim === dim.name;
              return (
                <div key={dim.name} className={`rounded-lg border ${DIMENSION_COLORS[dim.name] || 'border-rule bg-paper-dark'}`}>
                  <button
                    onClick={() => setExpandedDim(expanded ? null : dim.name)}
                    className="w-full flex items-center justify-between p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span>{DIMENSION_ICONS[dim.name] || '📊'}</span>
                      <span className="text-sm font-semibold text-ink">{dim.name}</span>
                      <span className="text-xs text-ink-muted ml-1">{dim.score}/10</span>
                    </div>
                    {expanded ? <ChevronUp size={14} className="text-ink-muted" /> : <ChevronDown size={14} className="text-ink-muted" />}
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3 border-t border-rule/30 pt-2">
                      <p className="text-sm text-ink leading-relaxed">{dim.analysis}</p>
                      <div className="mt-2"><ScoreBar score={dim.score} /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Antibody */}
          {result.antibody && (
            <div className="p-4 rounded-lg bg-curiosity-muted border border-curiosity/30">
              <div className="flex items-center gap-2 mb-1.5">
                <Shield size={14} className="text-curiosity" />
                <p className="text-xs font-semibold text-curiosity uppercase tracking-wide">The Antibody</p>
              </div>
              <p className="text-sm text-ink leading-relaxed">{result.antibody}</p>
            </div>
          )}

          {/* Related conspiracies */}
          {result.relatedConspiracies.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">Related conspiracy ecosystems</p>
              <div className="flex flex-wrap gap-1.5">
                {result.relatedConspiracies.map((c, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
