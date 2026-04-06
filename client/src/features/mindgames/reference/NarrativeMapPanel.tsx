import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Map, Loader2, AlertTriangle, Play, ChevronLeft, ChevronRight, TrendingUp, Users, Clock } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface PlatformNode {
  id: string;
  name: string;
  virality: number;
  role: 'origin' | 'amplifier' | 'bridge' | 'mainstream' | 'decline';
  description: string;
  keyAccounts: string[];
}

interface Connection {
  from: string;
  to: string;
  weight: number;
  description: string;
  stage: string;
}

interface Stage {
  id: string;
  label: string;
  date: string;
  description: string;
  platforms: string[];
  mutations: string[];
}

interface NarrativeMapData {
  narrative: string;
  description: string;
  stage: string;
  viralityScore: number;
  stages: Stage[];
  platforms: PlatformNode[];
  connections: Connection[];
  keyAccounts: { platform: string; handle: string; role: string; followers: string }[];
  mutationHistory: { stage: string; original: string; current: string; date: string }[];
  summary: string;
  provider?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  'Twitter/X': '#1DA1F2',
  'Facebook': '#4267B2',
  'Reddit': '#FF4500',
  'News sites': '#8B4513',
  'YouTube': '#FF0000',
  'TikTok': '#000000',
  'Instagram': '#E4405F'
};

const ROLE_LABELS: Record<string, string> = {
  origin: 'Origin',
  amplifier: 'Amplifier',
  bridge: 'Bridge',
  mainstream: 'Mainstream',
  decline: 'Decline'
};

const STAGE_COLORS: Record<string, string> = {
  'Emerging': 'var(--color-curiosity)',
  'Circulating': 'var(--color-observation)',
  'Mainstreamed': 'var(--color-outrage)',
  'Declining': 'var(--color-ink-muted)'
};

export function NarrativeMapPanel() {
  const selectedLlm = useLlm();
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState<NarrativeMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStage, setSelectedStage] = useState(0);
  const [hoveredPlatform, setHoveredPlatform] = useState<string | null>(null);
  const [animatedConnections, setAnimatedConnections] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const analyze = useCallback(async () => {
    if (topic.trim().length < 3) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    setResult(null);
    setSelectedStage(0);
    setAnimatedConnections(false);

    try {
      const res = await fetch(`${API_BASE}/cognitive/narrative-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), provider: selectedLlm }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Analysis failed');
      const data = await res.json();
      if (!ctrl.signal.aborted) {
        setResult(data);
        setTimeout(() => setAnimatedConnections(true), 300);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [topic]);

  const handleStageChange = (direction: 'prev' | 'next') => {
    if (!result) return;
    if (direction === 'prev') setSelectedStage(s => Math.max(0, s - 1));
    else setSelectedStage(s => Math.min(result.stages.length - 1, s + 1));
  };

  const platformPositions = useCallback((width: number, height: number) => {
    if (!result) return {};
    const positions: Record<string, { x: number; y: number }> = {};
    const platforms = result.platforms;
    const count = platforms.length;
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = width * 0.38;
    const radiusY = height * 0.38;

    platforms.forEach((p, i) => {
      if (count <= 4) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        positions[p.id] = {
          x: centerX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle) * radiusY
        };
      } else {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const radiusVar = 0.8 + (p.virality / 100) * 0.4;
        positions[p.id] = {
          x: centerX + Math.cos(angle) * radiusX * radiusVar,
          y: centerY + Math.sin(angle) * radiusY * radiusVar
        };
      }
    });
    return positions;
  }, [result]);

  const getNodeSize = (virality: number) => {
    return 18 + (virality / 100) * 28;
  };

  const currentStage = result?.stages[selectedStage];
  const stagePlatformIds = currentStage?.platforms.map(p => {
    const found = result?.platforms.find(pl => pl.name === p || pl.id === p);
    return found?.id || p;
  }) || [];

  return (
    <Card className="p-5 md:p-6 h-full flex flex-col gap-4">
      <div className="space-y-1.5">
        <FeaturePanelHeader
          icon={<Map size={20} className="text-outrage shrink-0" />}
          title="Narrative Map"
          infoTitle="Narrative Map"
          researcher="AI-based narrative cluster analysis"
          summary="Disinformation doesn't spread as isolated hoaxes — it travels in coordinated narrative clusters. This map shows the architecture of how a false idea moves from origin to mainstream."
          sections={[
            { heading: 'The Shift in Fact-Checking', content: 'Researchers are moving from debunking individual claims to dismantling entire "narrative clusters" — interconnected false stories that reinforce each other. Addressing one claim without seeing the cluster leaves the network intact.' },
            { heading: 'What It Visualises', items: [
              'Origin point — where the narrative first appeared',
              'Spread paths — which platforms and communities amplified it',
              'Mutations — how the story changed as it travelled',
              'Mainstream arrival — how it crossed from fringe to mainstream media',
            ]},
            { heading: 'Semantic Clustering', content: 'AI groups misinformation by underlying rhetorical strategy, not just keywords. This reveals patterns that keyword searches miss — for example, how an anti-vaccine narrative and a climate-denial narrative use the exact same "secret agenda" rhetorical structure.' },
            { heading: 'Real Example', content: 'The 2024–2025 trend of wellness influencers pivoting from pandemic conspiracies to climate denial — a documented narrative migration that semantic analysis can track in real time.' },
          ]}
        />
      </div>

      <p className="text-sm text-ink-muted leading-relaxed -mt-1">
        Analyze how narratives spread across social platforms. See the journey from origin to mainstream amplification.
      </p>

      <div className="flex gap-2">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter narrative topic (e.g., 'Election fraud claims')"
          className="flex-1 text-sm border-ink/20 focus:border-masthead h-11"
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
        />
        <Button onClick={analyze} disabled={loading || topic.trim().length < 3} className="gap-2 text-sm h-11">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          <span>Analyze</span>
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] px-2" style={{ borderColor: STAGE_COLORS[result.stage] || 'var(--color-ink-muted)', color: STAGE_COLORS[result.stage] || 'var(--color-ink-muted)' }}>
                {result.stage}
              </Badge>
              <span className="text-[11px] text-ink-muted">Virality: {result.viralityScore}/100</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-ink-muted">
              <Users size={12} />
              <span>{result.platforms.length} platforms</span>
            </div>
          </div>

          <div className="relative flex-1 min-h-[280px] bg-paper-dark rounded-md border border-rule overflow-hidden">
            <svg ref={svgRef} viewBox="0 0 500 300" className="w-full h-full" style={{ maxHeight: '320px' }}>
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="var(--color-ink-muted)" />
                </marker>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {(() => {
                const positions = platformPositions(500, 300);
                const visiblePlatforms = result.platforms.filter(p => 
                  selectedStage === 0 || stagePlatformIds.includes(p.id) || p.role === 'origin'
                );

                return (
                  <>
                    {result.connections
                      .filter(c => {
                        if (selectedStage === 0) return true;
                        const fromPlat = result.platforms.find(p => p.id === c.from);
                        const toPlat = result.platforms.find(p => p.id === c.to);
                        return fromPlat && toPlat && (stagePlatformIds.includes(c.from) || stagePlatformIds.includes(c.to));
                      })
                      .map((conn, i) => {
                        const fromPos = positions[conn.from];
                        const toPos = positions[conn.to];
                        if (!fromPos || !toPos) return null;
                        const isActive = animatedConnections;
                        return (
                          <g key={`conn-${i}`}>
                            <line
                              x1={fromPos.x}
                              y1={fromPos.y}
                              x2={toPos.x}
                              y2={toPos.y}
                              stroke={isActive ? 'var(--color-outrage)' : 'var(--color-rule)'}
                              strokeWidth={conn.weight * 0.5}
                              strokeOpacity={isActive ? 0.6 : 0.3}
                              markerEnd="url(#arrowhead)"
                              style={{
                                transition: 'stroke 0.5s, stroke-opacity 0.5s',
                                strokeDasharray: isActive ? 'none' : '4,4'
                              }}
                            />
                          </g>
                        );
                      })}

                    {visiblePlatforms.map(platform => {
                      const pos = positions[platform.id];
                      if (!pos) return null;
                      const size = getNodeSize(platform.virality);
                      const isHovered = hoveredPlatform === platform.id;
                      const color = PLATFORM_COLORS[platform.name] || 'var(--color-ink-muted)';
                      
                      return (
                        <g
                          key={platform.id}
                          onMouseEnter={() => setHoveredPlatform(platform.id)}
                          onMouseLeave={() => setHoveredPlatform(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={isHovered ? size + 4 : size}
                            fill={color}
                            fillOpacity={isHovered ? 0.9 : 0.7}
                            stroke={isHovered ? 'var(--color-ink)' : color}
                            strokeWidth={isHovered ? 2 : 1}
                            filter={isHovered ? 'url(#glow)' : undefined}
                            style={{ transition: 'all 0.2s' }}
                          />
                          <text
                            x={pos.x}
                            y={pos.y + size + 14}
                            textAnchor="middle"
                            className="text-[9px] font-sans fill-ink"
                            style={{ pointerEvents: 'none' }}
                          >
                            {escapeHtml(platform.name.length > 10 ? platform.name.slice(0, 8) + '…' : platform.name)}
                          </text>
                          {platform.role === 'origin' && (
                            <circle cx={pos.x - size * 0.7} cy={pos.y - size * 0.7} r="6" fill="var(--color-curiosity)" />
                          )}
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>

            {hoveredPlatform && result && (() => {
              const platform = result.platforms.find(p => p.id === hoveredPlatform);
              if (!platform) return null;
              return (
                <div className="absolute top-2 left-2 bg-paper border border-rule rounded-md p-2.5 shadow-md max-w-[200px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform.name] || 'var(--color-ink-muted)' }} />
                    <span className="text-[12px] font-bold text-ink">{platform.name}</span>
                  </div>
                  <div className="text-[10px] text-ink-muted space-y-0.5">
                    <p>Virality: {Math.round(platform.virality)}%</p>
                    <p>Role: {ROLE_LABELS[platform.role] || platform.role}</p>
                    {platform.keyAccounts.length > 0 && (
                      <p>Key accounts: {platform.keyAccounts.slice(0, 2).join(', ')}</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => handleStageChange('prev')}
              disabled={selectedStage === 0}
              className="p-1.5 rounded hover:bg-paper-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              {result.stages.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStage(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === selectedStage ? 'bg-masthead scale-125' : 'bg-ink-muted/40 hover:bg-ink-muted'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => handleStageChange('next')}
              disabled={selectedStage === result.stages.length - 1}
              className="p-1.5 rounded hover:bg-paper-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {currentStage && (
            <div className="bg-paper-dark rounded-md p-3 border border-rule">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[12px] font-bold text-ink">{currentStage.label}</h4>
                <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                  <Clock size={10} />
                  <span>{currentStage.date}</span>
                </div>
              </div>
              <p className="text-[11px] text-ink-light leading-relaxed mb-2">{currentStage.description}</p>
              {currentStage.mutations.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <TrendingUp size={11} className="text-outrage shrink-0 mt-0.5" />
                  <p className="text-[10px] text-ink-muted">{currentStage.mutations[0]}</p>
                </div>
              )}
            </div>
          )}

          {result.summary && (
            <p className="text-[11px] text-ink-muted leading-relaxed italic">{result.summary}</p>
          )}
        </>
      )}

      {!result && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <Map size={40} className="text-ink-muted/40 mb-3" />
          <p className="text-[12px] text-ink-muted">Enter a narrative topic to see how it spreads across platforms</p>
          <p className="text-[11px] text-ink-muted/60 mt-1">Examples: election fraud, COVID origin, climate denial</p>
        </div>
      )}
    </Card>
  );
}
