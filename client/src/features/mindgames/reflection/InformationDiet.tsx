import { useState, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Loader2, PieChart, Plus, X, AlertTriangle } from 'lucide-react';
import { useInformationDiet } from '../../../hooks/useApi';
import type { DietSource, InformationDietResult } from '../../../types';

interface Props {
  existingSources?: { name: string; url?: string }[];
  onAnalyze?: (sources: { name: string; url?: string }[]) => void;
}

const BIAS_COLORS: Record<string, string> = {
  'Far Left': 'oklch(0.65 0.2 300)',
  'Left': 'oklch(0.7 0.15 280)',
  'Center-Left': 'oklch(0.75 0.12 220)',
  'Center': 'oklch(0.75 0.08 180)',
  'Center-Right': 'oklch(0.75 0.12 60)',
  'Right': 'oklch(0.7 0.15 30)',
  'Far Right': 'oklch(0.65 0.2 15)',
};

const BIAS_ORDER = ['Far Left', 'Left', 'Center-Left', 'Center', 'Center-Right', 'Right', 'Far Right'];

const FREQUENCY_OPACITY = { high: 1, medium: 0.7, low: 0.4 };

export function InformationDiet({ existingSources = [], onAnalyze }: Props) {
  const [sources, setSources] = useState<{ name: string; url?: string }[]>(existingSources);
  const [newSource, setNewSource] = useState('');
  const { result, loading, error, analyze } = useInformationDiet(sources);

  const addSource = useCallback(() => {
    if (!newSource.trim() || sources.some(s => s.name.toLowerCase() === newSource.trim().toLowerCase())) return;
    setSources(prev => [...prev, { name: newSource.trim() }]);
    setNewSource('');
  }, [newSource, sources]);

  const removeSource = useCallback((idx: number) => {
    setSources(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const runAnalysis = useCallback(() => {
    if (sources.length === 0) return;
    if (onAnalyze) onAnalyze(sources);
    analyze();
  }, [sources, analyze, onAnalyze]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newSource}
          onChange={e => setNewSource(e.target.value)}
          placeholder="Add news source (e.g., BBC, Fox News, Reuters)..."
          className="text-sm flex-1 border-ink/20 focus:border-masthead h-11"
          onKeyDown={e => e.key === 'Enter' && addSource()}
          aria-label="Add news source"
        />
        <Button onClick={addSource} disabled={!newSource.trim()} variant="outline" className="px-3 h-11" aria-label="Add source">
          <Plus size={15} />
        </Button>
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-paper-dark rounded-md text-[12px] text-ink border border-rule">
              {s.name}
              <button onClick={() => removeSource(i)} className="text-ink-muted hover:text-ink cursor-pointer" aria-label={`Remove ${s.name}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      <Button onClick={runAnalysis} disabled={loading || sources.length === 0} className="w-full gap-2 text-sm h-11">
        {loading ? <><Loader2 size={15} className="animate-spin" /> Analyzing…</> : <><PieChart size={15} /> Analyze Information Diet</>}
      </Button>

      {error && (
        <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && <DietVisualization result={result} />}
    </div>
  );
}

function DietVisualization({ result }: { result: InformationDietResult }) {
  const { sources, diversityScore, dominantBias, echoChamberRisk, recommendations, biasDistribution } = result;
  const total = Object.values(biasDistribution).reduce((a, b) => a + b, 0) || 1;

  const centerX = 200;
  const centerY = 200;
  const maxRadius = 170;
  const ringWidth = maxRadius / 7;

  const getBiasPosition = (bias: string): { ring: number; angle: number } => {
    const ringIndex = BIAS_ORDER.indexOf(bias);
    const ring = ringIndex >= 0 ? ringIndex + 1 : 4;
    const angle = (ringIndex / 7) * 360 - 90;
    return { ring, angle };
  };

  const getPointOnRing = (angle: number, radius: number): { x: number; y: number } => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad),
    };
  };

  const getSourcePosition = (source: DietSource): { x: number; y: number } => {
    const { ring, angle } = getBiasPosition(source.bias);
    const radius = ring * ringWidth;
    const jitter = ((source.name.charCodeAt(0) % 20) - 10) * 2;
    const finalAngle = angle + jitter;
    return getPointOnRing(finalAngle, radius);
  };

  const riskColor = echoChamberRisk === 'high' ? 'var(--color-outrage)' : echoChamberRisk === 'medium' ? 'var(--color-curiosity)' : 'var(--color-observation)';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-md bg-paper-dark border border-rule">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Diversity Score</p>
          <p className="text-xl font-bold text-ink" style={{ color: diversityScore > 60 ? 'var(--color-observation)' : diversityScore > 30 ? 'var(--color-curiosity)' : 'var(--color-outrage)' }}>
            {diversityScore}
          </p>
        </div>
        <div className="p-3 rounded-md bg-paper-dark border border-rule">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Dominant Bias</p>
          <p className="text-lg font-bold text-ink" style={{ color: BIAS_COLORS[dominantBias] || 'var(--color-ink)' }}>
            {dominantBias}
          </p>
        </div>
        <div className="p-3 rounded-md bg-paper-dark border border-rule">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Echo Chamber Risk</p>
          <Badge variant="outline" className="mt-1 text-[11px]" style={{ backgroundColor: riskColor, color: 'white', borderColor: riskColor }}>
            {echoChamberRisk.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="relative bg-paper-dark rounded-lg border border-rule p-2">
        <svg viewBox="0 0 400 400" className="w-full h-auto max-h-[400px]" aria-label="Information diet visualization showing source bias distribution">
          <defs>
            {BIAS_ORDER.map((bias, i) => (
              <radialGradient key={bias} id={`gradient-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={BIAS_COLORS[bias]} stopOpacity="0.15" />
                <stop offset="100%" stopColor={BIAS_COLORS[bias]} stopOpacity="0.05" />
              </radialGradient>
            ))}
          </defs>

          {BIAS_ORDER.map((bias, i) => {
            const radius = (i + 1) * ringWidth;
            return (
              <circle
                key={bias}
                cx={centerX}
                cy={centerY}
                r={radius}
                fill={`url(#gradient-${i})`}
                stroke={BIAS_COLORS[bias]}
                strokeWidth="1"
                strokeOpacity="0.3"
                strokeDasharray={i === 3 ? '4 4' : 'none'}
              />
            );
          })}

          <circle cx={centerX} cy={centerY} r={25} fill="var(--color-masthead)" fillOpacity="0.2" stroke="var(--color-masthead)" strokeWidth="2" />
          <text x={centerX} y={centerY + 4} textAnchor="middle" className="fill-ink" style={{ fontSize: '10px', fontWeight: 'bold' }}>YOU</text>

          {sources.map((source, i) => {
            const pos = getSourcePosition(source);
            const color = BIAS_COLORS[source.bias] || 'var(--color-ink)';
            const opacity = FREQUENCY_OPACITY[source.frequency] || 0.7;
            return (
              <g key={i}>
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={pos.x}
                  y2={pos.y}
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity="0.15"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={source.frequency === 'high' ? 10 : source.frequency === 'medium' ? 7 : 5}
                  fill={color}
                  fillOpacity={opacity}
                  stroke="white"
                  strokeWidth="1.5"
                  className="cursor-pointer"
                >
                  <title>{source.name} ({source.bias})</title>
                </circle>
                <text
                  x={pos.x}
                  y={pos.y - 12}
                  textAnchor="middle"
                  className="fill-ink"
                  style={{ fontSize: '8px', fillOpacity: 0.8 }}
                >
                  {source.name.length > 12 ? source.name.slice(0, 10) + '…' : source.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute bottom-2 left-2 bg-paper/90 rounded px-2 py-1">
          <p className="text-[9px] text-ink-muted">Bias Spectrum</p>
          <div className="flex gap-0.5 mt-0.5">
            {BIAS_ORDER.map(bias => (
              <div
                key={bias}
                className="w-4 h-2 rounded-sm"
                style={{ backgroundColor: BIAS_COLORS[bias] }}
                title={bias}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-paper-dark rounded-md border border-rule p-3">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-2">Recommendations</p>
        <ul className="space-y-1.5">
          {recommendations.map((rec, i) => (
            <li key={i} className="text-[12px] text-ink flex items-start gap-2">
              <span className="text-curiosity shrink-0 mt-0.5">→</span>
              {rec}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-paper-dark rounded-md border border-rule p-3">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-2">Source Breakdown</p>
        <div className="space-y-1.5">
          {BIAS_ORDER.map(bias => {
            const biasKeyMap: Record<string, string> = {
              'Far Left': 'farLeft', 'Left': 'left', 'Center-Left': 'centerLeft',
              'Center': 'center', 'Center-Right': 'centerRight', 'Right': 'right', 'Far Right': 'farRight'
            };
            const key = biasKeyMap[bias] || 'center';
            const count = (biasDistribution as unknown as Record<string, number>)[key] || 0;
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={bias} className="flex items-center gap-2">
                <div className="w-16 text-[11px] text-ink truncate">{bias}</div>
                <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${percentage}%`, backgroundColor: BIAS_COLORS[bias] }}
                  />
                </div>
                <div className="w-8 text-[11px] text-ink-muted text-right">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
