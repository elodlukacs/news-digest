import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { AlertTriangle, Loader2, AlertCircle, GitBranch, ShieldAlert } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';
import { escapeHtml } from '../../../utils/escapeHtml';

interface GatewayTopic {
  id: string;
  name: string;
  description: string;
  examples: string[];
  leakageRisk: 'low' | 'medium' | 'high';
  commonClaims: string[];
}

interface BridgeFigure {
  id: string;
  name: string;
  type: 'influencer' | 'doctor' | 'media' | 'celebrity';
  followers: string;
  transitionPattern: string;
  gatewayTopics: string[];
  targetConspiracies: string[];
  leakageLevel: 'low' | 'medium' | 'high';
}

interface ConspiracyCore {
  id: string;
  name: string;
  description: string;
  coreNarratives: string[];
  connectedGateways: string[];
  radicalizationPotential: 'low' | 'medium' | 'high';
}

interface Pathway {
  from: string;
  to: string;
  mechanism: string;
  warningSigns: string[];
  leakagePoint: string;
}

interface WarningBanner {
  type: 'gateway' | 'bridge' | 'conspiracy';
  title: string;
  message: string;
}

interface DisinfoMapData {
  gatewayTopics: GatewayTopic[];
  bridgeFigures: BridgeFigure[];
  conspiracyCores: ConspiracyCore[];
  pathways: Pathway[];
  warningBanners: WarningBanner[];
  generatedAt?: string;
}

const RISK_COLORS = {
  low: 'var(--color-curiosity)',
  medium: '#D97706',
  high: 'var(--color-outrage)',
};

const TIER_COLORS = {
  gateway: 'var(--color-observation)',
  bridge: '#8B5CF6',
  conspiracy: 'var(--color-outrage)',
};

export function DisinfoMap() {
  const selectedLlm = useLlm();
  const [data, setData] = useState<DisinfoMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedGateway, setExpandedGateway] = useState<string | null>(null);
  const [expandedFigure, setExpandedFigure] = useState<string | null>(null);
  const [expandedCore, setExpandedCore] = useState<string | null>(null);
  const [hoveredPathway, setHoveredPathway] = useState<Pathway | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'details'>('visual');

  const loadMap = useCallback(async (regenerate = false) => {
    setLoading(true);
    setError('');
    try {
      const url = `${API_BASE}/cognitive/disinfo-map`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate, provider: selectedLlm }),
      });
      
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load map');
      
      const mapData = await res.json();
      setData(mapData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load disinfo map');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMap(false);
  }, [loadMap]);

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => RISK_COLORS[risk];
  const getRiskLabel = (risk: 'low' | 'medium' | 'high') => {
    const labels = { low: 'Low Risk', medium: 'Medium Risk', high: 'High Leakage' };
    return labels[risk];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1.5">
        <FeaturePanelHeader
          icon={<GitBranch size={20} className="text-outrage shrink-0" />}
          title="Disinfo Influencer Map"
          infoTitle="Disinfo Influencer Map"
          researcher="Conspiracy convergence gateway research"
          summary="Health and wellness content is often the 'gateway drug' into deeper conspiracy ecosystems. This map shows the documented radicalization pathways."
          sections={[
            { heading: 'The Gateway Effect', content: 'Health and wellness influencers build large, trusting audiences through legitimate content — then gradually pivot, merging health fears with distrust in scientific institutions. This is a documented and repeatable gateway pattern into radicalization.' },
            { heading: 'The Funnel', items: [
              'Gateway Topics — wellness, anti-vax, natural health, "doing your own research"',
              'Bridge Figures — influencers who straddle wellness and conspiracy, introducing audiences to fringe ideas gradually',
              'Conspiracy Cores — QAnon, climate denial, 5G fears, election fraud narratives',
            ]},
            { heading: 'Why It Matters', content: 'You are not encountering isolated bad actors — you are seeing a structured influence operation with documented network topology. Recognising the funnel helps you identify when you are being walked toward a gateway, not just consuming health content.' },
            { heading: 'Structural Insight', content: 'The same rhetorical techniques appear at every stage of the funnel: appeal to nature, distrust of institutions, "hidden truths" framing. The content changes; the manipulation structure does not.' },
          ]}
          right={<div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMap(false)}
              disabled={loading}
            >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Load Map'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => loadMap(true)}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Regenerate'}
          </Button>
        </div>}
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex rounded-xl border-2 border-rule overflow-hidden">
        <button
          onClick={() => setActiveTab('visual')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'visual'
              ? 'bg-ink text-paper'
              : 'bg-paper text-ink-muted hover:text-ink hover:bg-paper-dark'
          }`}
        >
          Funnel Visualization
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2.5 text-sm font-semibold border-l border-rule transition-all cursor-pointer ${
            activeTab === 'details'
              ? 'bg-ink text-paper'
              : 'bg-paper text-ink-muted hover:text-ink hover:bg-paper-dark'
          }`}
        >
          Detailed View
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded bg-accent-error-bg border border-accent-error-border text-accent-error-text text-xs">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Warning Banners */}
      {data && data.warningBanners.length > 0 && (
        <div className="space-y-2">
          {data.warningBanners.map((banner, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 rounded border-l-2 text-xs"
              style={{ 
                backgroundColor: 'var(--color-outrage-muted, var(--accent-warn-bg))',
                borderColor: TIER_COLORS[banner.type as keyof typeof TIER_COLORS] || 'var(--color-outrage)',
              }}
            >
              <ShieldAlert size={12} className="mt-0.5 flex-shrink-0" style={{ color: TIER_COLORS[banner.type as keyof typeof TIER_COLORS] || 'var(--color-outrage)' }} />
              <div>
                <span className="font-semibold">{banner.title}: </span>
                <span className="text-ink-light">{banner.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-masthead" />
        </div>
      )}

      {data && activeTab === 'visual' && (
        <div className="space-y-3">
          {/* SVG Funnel Visualization */}
          <div className="relative bg-paper-dark/30 rounded p-4 overflow-hidden">
            <svg viewBox="0 0 600 400" className="w-full h-auto">
              {/* Connection Lines */}
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="var(--color-ink-muted)" />
                </marker>
                <marker id="arrowhead-red" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="var(--color-outrage)" />
                </marker>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Tier Labels */}
              <text x="20" y="30" className="fill-ink-muted" style={{ fontSize: '10px', fontFamily: 'var(--font-sans)' }}>
                GATEWAY TOPICS
              </text>
              <text x="20" y="160" className="fill-ink-muted" style={{ fontSize: '10px', fontFamily: 'var(--font-sans)' }}>
                BRIDGE FIGURES
              </text>
              <text x="20" y="320" className="fill-ink-muted" style={{ fontSize: '10px', fontFamily: 'var(--font-sans)' }}>
                CONSPIRACY CORE
              </text>

              {/* Gateway Topics - Tier 1 */}
              <g>
                {data.gatewayTopics.map((topic, i) => {
                  const x = 80 + (i % 3) * 160;
                  const y = 45 + Math.floor(i / 3) * 55;
                  const isExpanded = expandedGateway === topic.id;
                  const isHovered = hoveredPathway?.from === topic.id || hoveredPathway?.to === topic.id;
                  
                  return (
                    <g key={topic.id} transform={`translate(${x}, ${y})`}>
                      <rect
                        x="0"
                        y="0"
                        width="140"
                        height={isExpanded ? '80' : '40'}
                        rx="4"
                        fill="var(--color-paper)"
                        stroke={TIER_COLORS.gateway}
                        strokeWidth={isHovered ? 2 : 1}
                        className="cursor-pointer transition-all"
                        onClick={() => setExpandedGateway(expandedGateway === topic.id ? null : topic.id)}
                      />
                      <rect x="0" y="0" width="4" height="40" rx="2" fill={TIER_COLORS.gateway} />
                      <text x="10" y="18" style={{ fontSize: '11px', fontFamily: 'var(--font-sans)', fontWeight: 600 }} className="fill-ink">
                        {escapeHtml(topic.name)}
                      </text>
                      <text x="10" y="32" style={{ fontSize: '9px', fontFamily: 'var(--font-sans)' }} className="fill-ink-muted">
                        {escapeHtml(topic.leakageRisk)} risk
                      </text>
                      {isExpanded && (
                        <g transform="translate(10, 42)">
                          {topic.examples.slice(0, 3).map((ex, j) => (
                            <text key={j} y={j * 12} style={{ fontSize: '8px', fontFamily: 'var(--font-sans)' }} className="fill-ink-light">
                              • {ex}
                            </text>
                          ))}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Bridge Figures - Tier 2 */}
              <g>
                {data.bridgeFigures.map((figure, i) => {
                  const x = 100 + (i % 2) * 200;
                  const y = 180 + Math.floor(i / 2) * 70;
                  const isExpanded = expandedFigure === figure.id;
                  const isHovered = hoveredPathway?.from === figure.id || hoveredPathway?.to === figure.id;
                  
                  return (
                    <g key={figure.id} transform={`translate(${x}, ${y})`}>
                      <rect
                        x="0"
                        y="0"
                        width="170"
                        height={isExpanded ? '95' : '50'}
                        rx="4"
                        fill="var(--color-paper)"
                        stroke={TIER_COLORS.bridge}
                        strokeWidth={isHovered ? 2 : 1}
                        className="cursor-pointer transition-all"
                        onClick={() => setExpandedFigure(expandedFigure === figure.id ? null : figure.id)}
                      />
                      <rect x="0" y="0" width="4" height="50" rx="2" fill={TIER_COLORS.bridge} />
                      <text x="10" y="18" style={{ fontSize: '11px', fontFamily: 'var(--font-sans)', fontWeight: 600 }} className="fill-ink">
                        {figure.name}
                      </text>
                      <text x="10" y="32" style={{ fontSize: '9px', fontFamily: 'var(--font-sans)' }} className="fill-ink-muted">
                        {figure.type} • {figure.followers}
                      </text>
                      <text x="10" y="44" style={{ fontSize: '9px', fontFamily: 'var(--font-sans)' }} className="fill-ink-muted">
                        {figure.leakageLevel} leakage
                      </text>
                      {isExpanded && (
                        <g transform="translate(10, 52)">
                          <text y="0" style={{ fontSize: '8px', fontFamily: 'var(--font-sans)', fontWeight: 500 }} className="fill-ink">
                            Transition:
                          </text>
                          <text y="12" style={{ fontSize: '8px', fontFamily: 'var(--font-sans)' }} className="fill-ink-light">
                            {figure.transitionPattern.slice(0, 50)}...
                          </text>
                          <text y="24" style={{ fontSize: '8px', fontFamily: 'var(--font-sans)', fontWeight: 500 }} className="fill-ink">
                            Targets: {figure.targetConspiracies.join(', ')}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Conspiracy Core - Tier 3 */}
              <g>
                {data.conspiracyCores.map((core, i) => {
                  const x = 150 + i * 140;
                  const y = 330;
                  const isExpanded = expandedCore === core.id;
                  const isHovered = hoveredPathway?.from === core.id || hoveredPathway?.to === core.id;
                  
                  return (
                    <g key={core.id} transform={`translate(${x}, ${y})`}>
                      <rect
                        x="0"
                        y="0"
                        width="130"
                        height={isExpanded ? '85' : '45'}
                        rx="4"
                        fill="var(--color-paper)"
                        stroke={TIER_COLORS.conspiracy}
                        strokeWidth={isHovered ? 2 : 1}
                        className="cursor-pointer transition-all"
                        onClick={() => setExpandedCore(expandedCore === core.id ? null : core.id)}
                        filter={core.radicalizationPotential === 'high' ? 'url(#glow)' : undefined}
                      />
                      <rect x="0" y="0" width="4" height="45" rx="2" fill={TIER_COLORS.conspiracy} />
                      <text x="10" y="18" style={{ fontSize: '11px', fontFamily: 'var(--font-sans)', fontWeight: 600 }} className="fill-ink">
                        {core.name}
                      </text>
                      <text x="10" y="32" style={{ fontSize: '9px', fontFamily: 'var(--font-sans)' }} className="fill-ink-muted">
                        {core.radicalizationPotential} radicalization
                      </text>
                      {isExpanded && (
                        <g transform="translate(10, 42)">
                          {core.coreNarratives.slice(0, 3).map((narr, j) => (
                            <text key={j} y={j * 12} style={{ fontSize: '8px', fontFamily: 'var(--font-sans)' }} className="fill-ink-light">
                              → {narr}
                            </text>
                          ))}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Pathway Lines */}
              {data.pathways.map((pathway, i) => {
                const fromGateway = data.gatewayTopics.find(t => t.id === pathway.from);
                const fromFigure = data.bridgeFigures.find(f => f.id === pathway.from);
                const toFigure = data.bridgeFigures.find(f => f.id === pathway.to);
                const toCore = data.conspiracyCores.find(c => c.id === pathway.to);

                let x1 = 150, y1 = 85, x2 = 185, y2 = 180;
                
                if (fromGateway && toFigure) {
                  const fi = data.gatewayTopics.indexOf(fromGateway);
                  const ti = data.bridgeFigures.indexOf(toFigure);
                  x1 = 80 + (fi % 3) * 160 + 70;
                  y1 = 45 + Math.floor(fi / 3) * 55 + 40;
                  x2 = 100 + (ti % 2) * 200 + 85;
                  y2 = 180 + Math.floor(ti / 2) * 70;
                } else if (fromFigure && toCore) {
                  const fi = data.bridgeFigures.indexOf(fromFigure);
                  const ci = data.conspiracyCores.indexOf(toCore);
                  x1 = 100 + (fi % 2) * 200 + 85;
                  y1 = 180 + Math.floor(fi / 2) * 70 + 50;
                  x2 = 150 + ci * 140 + 65;
                  y2 = 330;
                } else if (fromGateway && toCore) {
                  const gi = data.gatewayTopics.indexOf(fromGateway);
                  const ci = data.conspiracyCores.indexOf(toCore);
                  x1 = 80 + (gi % 3) * 160 + 70;
                  y1 = 45 + Math.floor(gi / 3) * 55 + 40;
                  x2 = 150 + ci * 140 + 65;
                  y2 = 330;
                }

                const isHovered = hoveredPathway === pathway;

                return (
                  <g key={i} onMouseEnter={() => setHoveredPathway(pathway)} onMouseLeave={() => setHoveredPathway(null)}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isHovered ? 'var(--color-outrage)' : 'var(--color-ink-muted)'}
                      strokeWidth={isHovered ? 2 : 1}
                      strokeDasharray="4 2"
                      markerEnd={isHovered ? 'url(#arrowhead-red)' : 'url(#arrowhead)'}
                      opacity={isHovered ? 1 : 0.4}
                      className="transition-all cursor-pointer"
                    />
                    {isHovered && (
                      <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                        <rect x="-60" y="-25" width="120" height="50" rx="4" fill="var(--color-paper)" stroke="var(--color-outrage)" strokeWidth="1" />
                        <text x="0" y="-10" textAnchor="middle" style={{ fontSize: '8px', fontFamily: 'var(--font-sans)', fontWeight: 600 }} className="fill-outrage">
                          {pathway.leakagePoint.slice(0, 40)}...
                        </text>
                        <text x="0" y="5" textAnchor="middle" style={{ fontSize: '7px', fontFamily: 'var(--font-sans)' }} className="fill-ink-muted">
                          {pathway.mechanism.slice(0, 50)}...
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-ink-muted">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: TIER_COLORS.gateway }} />
              <span>Gateway Topics</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: TIER_COLORS.bridge }} />
              <span>Bridge Figures</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: TIER_COLORS.conspiracy }} />
              <span>Conspiracy Core</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 border-t border-dashed border-ink-muted" />
              <span>Pathway</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-outrage" />
              <span>Click to expand</span>
            </div>
          </div>

          {/* Pathway Details */}
          {hoveredPathway && (
            <Card className="p-3 border-l-4 border-l-outrage">
              <h4 className="text-xs font-semibold text-ink mb-1">Pathway Details</h4>
              <p className="text-[10px] text-ink-light mb-2">
                <span className="font-medium">Leakage Point: </span>{hoveredPathway.leakagePoint}
              </p>
              <p className="text-[10px] text-ink-light mb-2">
                <span className="font-medium">Mechanism: </span>{hoveredPathway.mechanism}
              </p>
              <div className="flex flex-wrap gap-1">
                {hoveredPathway.warningSigns.map((sign, i) => (
                  <Badge key={i} variant="outline" className="text-[8px] px-1.5 py-0.5">
                    {sign}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {data && activeTab === 'details' && (
        <div className="space-y-4">
          {/* Gateway Topics */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded" style={{ backgroundColor: TIER_COLORS.gateway }} />
              Gateway Topics
            </h4>
            <div className="grid gap-2">
              {data.gatewayTopics.map(topic => (
                <Card key={topic.id} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h5 className="text-sm font-semibold text-ink">{topic.name}</h5>
                      <p className="text-[10px] text-ink-muted mt-0.5">{topic.description}</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="text-[8px]"
                      style={{ borderColor: getRiskColor(topic.leakageRisk), color: getRiskColor(topic.leakageRisk) }}
                    >
                      {getRiskLabel(topic.leakageRisk)}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <span className="text-[9px] text-ink-muted">Common claims: </span>
                    <span className="text-[9px] text-ink-light">{topic.commonClaims.join(', ')}</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Bridge Figures */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded" style={{ backgroundColor: TIER_COLORS.bridge }} />
              Bridge Figures
            </h4>
            <div className="grid gap-2">
              {data.bridgeFigures.map(figure => (
                <Card key={figure.id} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h5 className="text-sm font-semibold text-ink">{figure.name}</h5>
                      <p className="text-[10px] text-ink-muted mt-0.5">
                        {figure.type} • {figure.followers}
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="text-[8px]"
                      style={{ borderColor: getRiskColor(figure.leakageLevel as 'low' | 'medium' | 'high'), color: getRiskColor(figure.leakageLevel as 'low' | 'medium' | 'high') }}
                    >
                      {figure.leakageLevel} leakage
                    </Badge>
                  </div>
                  <p className="text-[10px] text-ink-light mb-2">{figure.transitionPattern}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[8px]">From: {figure.gatewayTopics.join(', ')}</Badge>
                    <Badge variant="secondary" className="text-[8px]">To: {figure.targetConspiracies.join(', ')}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Conspiracy Core */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded" style={{ backgroundColor: TIER_COLORS.conspiracy }} />
              Conspiracy Core
            </h4>
            <div className="grid gap-2">
              {data.conspiracyCores.map(core => (
                <Card key={core.id} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h5 className="text-sm font-semibold text-ink">{core.name}</h5>
                      <p className="text-[10px] text-ink-muted mt-0.5">{core.description}</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="text-[8px]"
                      style={{ borderColor: getRiskColor(core.radicalizationPotential as 'low' | 'medium' | 'high'), color: getRiskColor(core.radicalizationPotential as 'low' | 'medium' | 'high') }}
                    >
                      {core.radicalizationPotential} radicalization
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <span className="text-[9px] text-ink-muted">Core narratives: </span>
                    <span className="text-[9px] text-ink-light">{core.coreNarratives.join(' • ')}</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
