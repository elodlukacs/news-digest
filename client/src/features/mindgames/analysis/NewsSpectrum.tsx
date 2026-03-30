import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Slider } from '../../../components/ui/slider';
import {
  Scale,
  Search,
  Loader2,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  XCircle,
  MinusCircle
} from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';

interface OutletRating {
  id: string;
  name: string;
  url: string;
  bias: string;
  biasScore: number;
  credibility: number;
  factCheckGrade: string;
  reliability: string;
  ownership: string;
  coverage: string;
  strongAreas: string[];
  weakAreas: string[];
  notable: string;
}

interface CoverageItem {
  outlet: string;
  headline: string;
  bias: string;
  keyQuote: string;
  emphasis: string[];
  omissions: string[];
}

interface SpectrumComparison {
  topic: string;
  outlets: OutletRating[];
  coverage: CoverageItem[];
  commonFacts: string[];
  framingDifferences: { dimension: string; spectrum: string[] }[];
  narrativeDivergenceScore: number;
  summary: string;
  provider: string;
}

const BIAS_COLORS: Record<string, string> = {
  'Far Left': '#8B5CF6',
  'Left': '#A855F7',
  'Center-Left': '#3B82F6',
  'Center': '#22C55E',
  'Center-Right': '#F97316',
  'Right': '#EF4444',
  'Far Right': '#DC2626'
};

const BIAS_POSITIONS: Record<string, number> = {
  'Far Left': -3,
  'Left': -2,
  'Center-Left': -1,
  'Center': 0,
  'Center-Right': 1,
  'Right': 2,
  'Far Right': 3
};

export function NewsSpectrum() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [outlets, setOutlets] = useState<OutletRating[]>([]);
  const [spectrumData, setSpectrumData] = useState<SpectrumComparison | null>(null);
  const [selectedBiasRange, setSelectedBiasRange] = useState<number[]>([-3, 3]);
  const [showOutletDetails, setShowOutletDetails] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'headlines' | 'facts' | 'analysis'>('headlines');

  const loadOutlets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/spectrum/outlet-ratings`);
      const data = await res.json();
      setOutlets(data.outlets || []);
    } catch (err) {
      console.error('Failed to load outlets:', err);
    }
  }, []);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  const compareCoverage = async () => {
    if (!topic.trim()) return;
    
    setLoading(true);
    setError('');
    setSpectrumData(null);
    
    try {
      const res = await fetch(`${API_BASE}/spectrum/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() })
      });
      
      if (!res.ok) {
        throw new Error((await res.json()).error || 'Analysis failed');
      }
      
      const data = await res.json();
      setSpectrumData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredOutlets = outlets.filter(outlet => {
    const pos = BIAS_POSITIONS[outlet.bias] ?? 0;
    return pos >= selectedBiasRange[0] && pos <= selectedBiasRange[1];
  });

  const getCredibilityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-emerald-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getReliabilityIcon = (reliability: string) => {
    switch (reliability) {
      case 'Very High':
      case 'High':
        return <CheckCircle size={14} className="text-green-600" />;
      case 'Medium-High':
      case 'Medium':
        return <MinusCircle size={14} className="text-yellow-600" />;
      default:
        return <XCircle size={14} className="text-red-600" />;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <FeaturePanelHeader
          icon={<Scale size={17} className="text-curiosity shrink-0" />}
          title="News Spectrum"
          infoTitle="News Spectrum"
          researcher="Based on media bias and credibility research"
          summary="See your trusted outlets placed on a credibility and bias map — then compare how they cover the same story."
          sections={[
            { heading: 'What It Shows Per Outlet', items: [
              'Political lean — from Far Left to Far Right on the spectrum',
              'Credibility rating — independent of political lean (a source can be highly credible and strongly partisan)',
              'Fact-check grade — based on third-party verification track record',
              'Known strong and weak areas of coverage',
            ]},
            { heading: 'Key Insight', content: 'Credibility and political bias are separate dimensions. A highly partisan outlet can be factually rigorous, while a centrist-appearing outlet can be unreliable. The Spectrum separates these two axes.' },
            { heading: 'Story Comparison', content: 'Enter any topic to see how outlets across the spectrum frame it — what they emphasise, what they omit, and how their narrative diverges from those on the other side.' },
          ]}
          right={<Badge variant="outline" className="text-[10px]">{outlets.length} outlets</Badge>}
        />
        <p className="text-[12px] text-ink-muted leading-relaxed -mt-1">
          Compare how outlets across the political spectrum cover the same story. 
          See credibility scores, framing differences, and narrative divergence.
        </p>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col gap-4">
        {/* Topic Input */}
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic to compare coverage…"
            className="flex-1 text-[13px]"
            onKeyDown={(e) => e.key === 'Enter' && compareCoverage()}
          />
          <Button 
            onClick={compareCoverage} 
            disabled={loading || !topic.trim()}
            size="sm"
            className="gap-1.5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span className="hidden sm:inline">Compare</span>
          </Button>
        </div>

        {/* Bias Spectrum Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">
              Filter by Bias
            </span>
            <span className="text-[10px] text-ink-muted">
              {biasLabel(selectedBiasRange[0])} → {biasLabel(selectedBiasRange[1])}
            </span>
          </div>
          <div className="px-1">
            <Slider
              value={selectedBiasRange}
              onValueChange={setSelectedBiasRange}
              min={-3}
              max={3}
              step={1}
            />
          </div>
          <div className="flex justify-between text-[9px] text-ink-muted px-1">
            <span>Far Left</span>
            <span>Left</span>
            <span>Center</span>
            <span>Right</span>
            <span>Far Right</span>
          </div>
        </div>

        {/* Results */}
        {error && (
          <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-curiosity mb-2" />
              <p className="text-[12px] text-ink-muted">Analyzing coverage patterns…</p>
            </div>
          </div>
        )}

        {spectrumData && !loading && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* Topic Header */}
            <div className="text-center pb-3 border-b border-rule">
              <h4 className="font-serif text-base font-bold text-ink mb-1">
                {spectrumData.topic}
              </h4>
              <p className="text-[11px] text-ink-muted">
                Comparing {spectrumData.outlets.length} outlets across the spectrum
              </p>
            </div>

            {/* Narrative Divergence Score */}
            <div className="bg-paper-dark rounded-lg p-3 border border-rule">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">
                  Narrative Divergence
                </span>
                <span className={`text-lg font-bold ${
                  spectrumData.narrativeDivergenceScore > 70 ? 'text-outrage' :
                  spectrumData.narrativeDivergenceScore > 40 ? 'text-curiosity' : 'text-observation'
                }`}>
                  {spectrumData.narrativeDivergenceScore}/100
                </span>
              </div>
              <div className="h-2 bg-paper rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${spectrumData.narrativeDivergenceScore}%`,
                    backgroundColor: spectrumData.narrativeDivergenceScore > 70 
                      ? 'var(--color-outrage)' 
                      : spectrumData.narrativeDivergenceScore > 40 
                        ? 'var(--color-curiosity)' 
                        : 'var(--color-observation)'
                  }}
                />
              </div>
              <p className="text-[10px] text-ink-muted mt-1.5">
                {spectrumData.narrativeDivergenceScore > 70 
                  ? 'High divergence - outlets frame the story very differently'
                  : spectrumData.narrativeDivergenceScore > 40 
                    ? 'Moderate divergence - some framing differences exist'
                    : 'Low divergence - outlets generally agree on the facts'}
              </p>
            </div>

            {/* Coverage Comparison Strip */}
            <div className="space-y-2">
              <button
                onClick={() => setExpandedSection(expandedSection === 'headlines' ? 'analysis' : 'headlines')}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">
                  Headline Comparison
                </span>
                {expandedSection === 'headlines' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {expandedSection === 'headlines' && (
                <div className="overflow-x-auto -mx-1 px-1">
                  <div className="flex gap-2 pb-2 min-w-max">
                    {spectrumData.coverage.map((item, idx) => {
                      const biasColor = BIAS_COLORS[item.bias] || '#22C55E';
                      return (
                        <div 
                          key={idx}
                          className="w-[280px] shrink-0 bg-paper-dark rounded-lg p-3 border-l-3"
                          style={{ borderLeftColor: biasColor, borderLeftWidth: '3px' }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-ink">{item.outlet}</span>
                            <Badge 
                              variant="outline" 
                              className="text-[9px] px-1.5"
                              style={{ 
                                borderColor: biasColor, 
                                color: biasColor,
                                backgroundColor: `${biasColor}10`
                              }}
                            >
                              {item.bias}
                            </Badge>
                          </div>
                          <p className="text-[12px] text-ink leading-snug mb-2 font-medium">
                            "{item.headline}"
                          </p>
                          <p className="text-[10px] text-ink-muted italic">
                            "{item.keyQuote.slice(0, 80)}…"
                          </p>
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            {item.emphasis.slice(0, 2).map((e, i) => (
                              <span key={i} className="text-[9px] px-1.5 py-0.5 bg-observation/10 text-observation rounded">
                                +{e}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Common Facts */}
            <div className="space-y-2">
              <button
                onClick={() => setExpandedSection(expandedSection === 'facts' ? 'analysis' : 'facts')}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">
                  Common Facts Across Outlets
                </span>
                {expandedSection === 'facts' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {expandedSection === 'facts' && (
                <div className="bg-paper-dark rounded-lg p-3 space-y-1.5">
                  {spectrumData.commonFacts.map((fact, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px]">
                      <CheckCircle size={12} className="text-green-600 mt-0.5 shrink-0" />
                      <span className="text-ink-light">{fact}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Framing Differences */}
            {spectrumData.framingDifferences && spectrumData.framingDifferences.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">
                  Framing Dimensions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {spectrumData.framingDifferences.map((dim, idx) => (
                    <div key={idx} className="bg-paper-dark rounded-lg p-2.5 border border-rule">
                      <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
                        {dim.dimension}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-observation">{dim.spectrum[0]}</span>
                        <div className="flex-1 h-1 bg-gradient-to-r from-observation via-curiosity to-outrage rounded-full" />
                        <span className="text-[10px] text-outrage">{dim.spectrum[1]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-paper-dark rounded-lg p-3 border border-rule">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">
                Analysis Summary
              </span>
              <p className="text-[12px] text-ink-light leading-relaxed mt-1.5">
                {spectrumData.summary}
              </p>
            </div>

            {/* Outlet Details Section */}
            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">
                Outlet Details
              </span>
              <div className="space-y-2">
                {filteredOutlets.slice(0, 7).map((outlet) => (
                  <div 
                    key={outlet.id}
                    className="bg-paper-dark rounded-lg border border-rule overflow-hidden"
                  >
                    <button
                      onClick={() => setShowOutletDetails(showOutletDetails === outlet.id ? null : outlet.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-paper-dark/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: BIAS_COLORS[outlet.bias] || '#22C55E' }}
                        >
                          {outlet.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-ink">{outlet.name}</p>
                          <p className="text-[10px] text-ink-muted">{outlet.bias}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-[14px] font-bold ${getCredibilityColor(outlet.credibility)}`}>
                            {outlet.credibility}
                          </p>
                          <p className="text-[9px] text-ink-muted">credibility</p>
                        </div>
                        {getReliabilityIcon(outlet.reliability)}
                        {showOutletDetails === outlet.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>
                    
                    {showOutletDetails === outlet.id && (
                      <div className="px-3 pb-3 pt-0 border-t border-rule/50 space-y-2.5">
                        <div className="pt-2.5 grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-ink-muted font-semibold">
                              Fact-Check Grade
                            </span>
                            <p className="text-[13px] font-bold text-ink mt-0.5">{outlet.factCheckGrade}</p>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-ink-muted font-semibold">
                              Reliability
                            </span>
                            <p className="text-[13px] font-bold text-ink mt-0.5">{outlet.reliability}</p>
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-ink-muted font-semibold">
                            Ownership
                          </span>
                          <p className="text-[11px] text-ink-light mt-0.5">{outlet.ownership}</p>
                        </div>
                        
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-ink-muted font-semibold">
                            Coverage
                          </span>
                          <p className="text-[11px] text-ink-light mt-0.5">{outlet.coverage}</p>
                        </div>
                        
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-ink-muted font-semibold">
                            Strengths
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {outlet.strongAreas.map((area, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-ink-muted font-semibold">
                            Weaknesses
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {outlet.weakAreas.map((area, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="pt-1 border-t border-rule/50">
                          <div className="flex items-center gap-1.5">
                            <Info size={11} className="text-curiosity" />
                            <span className="text-[10px] text-ink-muted italic">{outlet.notable}</span>
                          </div>
                        </div>
                        
                        <a
                          href={outlet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-curiosity hover:text-curiosity/80 transition-colors"
                        >
                          Visit site <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Default State - Show Outlet Grid */}
        {!spectrumData && !loading && outlets.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">
              Outlet Database ({filteredOutlets.length} shown)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredOutlets.slice(0, 14).map((outlet) => (
                <div 
                  key={outlet.id}
                  className="bg-paper-dark rounded-lg p-3 border border-rule"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ backgroundColor: BIAS_COLORS[outlet.bias] || '#22C55E' }}
                      >
                        {outlet.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-ink">{outlet.name}</p>
                        <p className="text-[9px] text-ink-muted">{outlet.bias}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-[12px] font-bold ${getCredibilityColor(outlet.credibility)}`}>
                        {outlet.credibility}
                      </p>
                      <p className="text-[8px] text-ink-muted">credibility</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-ink-muted">
                    <span className="px-1.5 py-0.5 bg-paper rounded border border-rule">
                      {outlet.factCheckGrade}
                    </span>
                    <span>{outlet.reliability}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function biasLabel(position: number): string {
  switch (position) {
    case -3: return 'Far Left';
    case -2: return 'Left';
    case -1: return 'Center-Left';
    case 0: return 'Center';
    case 1: return 'Center-Right';
    case 2: return 'Right';
    case 3: return 'Far Right';
    default: return 'Unknown';
  }
}
