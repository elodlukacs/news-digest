import { useState, useCallback, useRef } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip';
import { FlaskConical, Loader2, AlertTriangle, History, ChevronDown, ChevronUp, Info, CheckCircle2, XCircle, HelpCircle, TrendingUp, Users, ShieldAlert, FileCheck } from 'lucide-react';
import { API_BASE } from '../../../config';
import type { StudyAnalysis, StudyAnalysisEntry } from '../../../types';

function getScoreColor(score: number): string {
  if (score >= 7) return 'var(--color-observation)';
  if (score >= 4) return 'var(--color-curiosity)';
  return 'var(--color-outrage)';
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Robust';
  if (score >= 6) return 'Adequate';
  if (score >= 4) return 'Weak';
  if (score >= 2) return 'Poor';
  return 'Critical';
}

interface DiagnosticCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function DiagnosticCard({ title, icon, children }: DiagnosticCardProps) {
  return (
    <div className="p-3.5 bg-paper-dark rounded-lg border border-rule">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider text-ink-muted font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

interface IndicatorBadgeProps {
  label: string;
  status: 'yes' | 'no' | 'unclear';
  tooltip: string;
}

function IndicatorBadge({ label, status, tooltip }: IndicatorBadgeProps) {
  const icons = {
    yes: <CheckCircle2 size={13} className="text-observation" />,
    no: <XCircle size={13} className="text-outrage" />,
    unclear: <HelpCircle size={13} className="text-curiosity" />,
  };
  const bgColors = {
    yes: 'bg-observation/10 border-observation/30',
    no: 'bg-outrage/10 border-outrage/30',
    unclear: 'bg-curiosity/10 border-curiosity/30',
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium cursor-help ${bgColors[status]}`}>
          {icons[status]}
          <span className="text-ink">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-[11px]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function StudyStressTester() {
  const [headline, setHeadline] = useState('');
  const [result, setResult] = useState<StudyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<StudyAnalysisEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/forensics/study/history?limit=10`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const toggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(h => !h);
  };

  const analyze = async () => {
    if (headline.trim().length < 10) return;
    const trimmed = headline.trim().slice(0, 2000);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/forensics/study`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: trimmed }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Analysis failed');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 h-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FlaskConical size={17} className="text-curiosity shrink-0" />
        <h3 className="font-serif text-base font-bold uppercase tracking-wide text-ink flex-1">Study Stress-Tester</h3>
        <button onClick={toggleHistory} className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer px-1">
          <History size={13} />
          {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      <p className="text-[13px] text-ink-muted leading-relaxed -mt-1">
        Evaluate research study quality in news headlines. Check sample size, methodology, conflicts of interest, and more.
      </p>

      {showHistory && (
        <div className="max-h-[150px] overflow-y-auto space-y-1.5 border border-rule rounded-md p-2.5 bg-paper-dark">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Recent Analyses</p>
          {historyLoading && <p className="text-[12px] text-ink-muted">Loading…</p>}
          {!historyLoading && history.length === 0 && <p className="text-[12px] text-ink-muted">No history yet.</p>}
          {history.map(h => {
            let analysisData: StudyAnalysis | null = null;
            try {
              analysisData = typeof h.analysis_data === 'string' ? JSON.parse(h.analysis_data) : h.analysis_data;
            } catch { /* ignore */ }
            return (
              <button key={h.id} onClick={() => { setHeadline(h.headline); setResult(analysisData); setShowHistory(false); }}
                className="w-full text-left p-2 rounded hover:bg-paper border border-rule/50 cursor-pointer transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-ink truncate flex-1">{h.headline.slice(0, 70)}…</span>
                  {analysisData && (
                    <span className="text-[11px] font-medium shrink-0" style={{ color: getScoreColor(analysisData.overallScore) }}>
                      {analysisData.overallScore}/10
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-ink-muted">{new Date(h.created_at).toLocaleDateString()}</span>
              </button>
            );
          })}
        </div>
      )}

      <label className="sr-only" htmlFor="study-headline">Research headline to evaluate</label>
      <Textarea
        id="study-headline"
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="Paste a research headline to evaluate…&#10;e.g., 'Study shows 50% of people prefer new drug with no side effects'"
        className="flex-1 min-h-[100px] text-[13px] resize-none border-ink/20 focus:border-masthead"
      />

      <Button onClick={analyze} disabled={loading || headline.trim().length < 10} className="w-full gap-2 text-[13px] h-10">
        {loading ? <><Loader2 size={15} className="animate-spin" /> Analyzing…</> : <><FlaskConical size={15} /> Evaluate Study</>}
      </Button>

      {error && (
        <div className="p-3 bg-outrage-muted rounded-md text-[13px] text-outrage flex items-center gap-2 border border-outrage/20">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Overall Quality</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-ink-muted"><Info size={12} /></span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-[11px]">
                    Composite score based on sample size, methodology, conflicts of interest, and peer review status.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold" style={{ color: getScoreColor(result.overallScore) }}>
                  {result.overallScore}/10
                </span>
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: getScoreColor(result.overallScore), color: getScoreColor(result.overallScore) }}>
                  {getScoreLabel(result.overallScore)}
                </Badge>
              </div>
            </div>
            <div className="h-2 bg-paper-dark rounded-full overflow-hidden border border-rule/50">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${result.overallScore * 10}%`,
                backgroundColor: getScoreColor(result.overallScore),
              }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DiagnosticCard title="Sample Size" icon={<Users size={13} className="text-curiosity" />}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-ink">{result.sampleSize.score}/10</span>
                <span className="text-[11px] text-ink-muted">{result.sampleSize.label}</span>
              </div>
              {result.sampleSize.reasoning && (
                <p className="text-[11px] text-ink-light">{result.sampleSize.reasoning}</p>
              )}
            </DiagnosticCard>

            <DiagnosticCard title="Effect Size" icon={<TrendingUp size={13} className="text-curiosity" />}>
              <div className="flex items-center gap-2 flex-wrap">
                <IndicatorBadge
                  label="Meaningful"
                  status={result.effectSize.meaningful ? 'yes' : 'no'}
                  tooltip="Whether the effect size is practically significant, not just statistically significant."
                />
                <IndicatorBadge
                  label="Inflated"
                  status={result.effectSize.inflated ? 'yes' : 'no'}
                  tooltip="Whether the headline or abstract appears to magnify the actual effect."
                />
              </div>
              {result.effectSize.reasoning && (
                <p className="text-[11px] text-ink-light mt-1">{result.effectSize.reasoning}</p>
              )}
            </DiagnosticCard>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DiagnosticCard title="Control Group" icon={<ShieldAlert size={13} className="text-curiosity" />}>
              <div className="flex items-center gap-2 flex-wrap">
                <IndicatorBadge
                  label="Present"
                  status={result.hasControlGroup.present ? 'yes' : result.hasControlGroup.unclear ? 'unclear' : 'no'}
                  tooltip="Whether the study appears to have a proper control or comparison group."
                />
              </div>
              {result.hasControlGroup.reasoning && (
                <p className="text-[11px] text-ink-light mt-1">{result.hasControlGroup.reasoning}</p>
              )}
            </DiagnosticCard>

            <DiagnosticCard title="Peer Review" icon={<FileCheck size={13} className="text-curiosity" />}>
              <div className="flex items-center gap-2 flex-wrap">
                <IndicatorBadge
                  label="Likely"
                  status={result.peerReviewed.likely ? 'yes' : result.peerReviewed.unclear ? 'unclear' : 'no'}
                  tooltip="Whether the study appears to have undergone peer review, or if it's preliminary/preprint."
                />
              </div>
              {result.peerReviewed.reasoning && (
                <p className="text-[11px] text-ink-light mt-1">{result.peerReviewed.reasoning}</p>
              )}
            </DiagnosticCard>
          </div>

          <DiagnosticCard title="Conflicts of Interest" icon={<AlertTriangle size={13} className="text-outrage" />}>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <IndicatorBadge
                label="Conflict"
                status={result.conflictOfInterest.hasConflict ? 'yes' : result.conflictOfInterest.unclear ? 'unclear' : 'no'}
                tooltip="Funding source, author affiliations, or other interests that may bias the findings."
              />
            </div>
            {result.conflictOfInterest.details && (
              <p className="text-[11px] text-ink-light">{result.conflictOfInterest.details}</p>
            )}
          </DiagnosticCard>

          {result.methodologyIssues && result.methodologyIssues.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Methodology Issues</span>
              {result.methodologyIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-outrage/5 rounded border-l-2 border-outrage">
                  <AlertTriangle size={12} className="text-outrage shrink-0 mt-0.5" />
                  <span className="text-[12px] text-ink-light">{issue}</span>
                </div>
              ))}
            </div>
          )}

          {result.strengths && result.strengths.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Strengths</span>
              {result.strengths.map((strength, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-observation/5 rounded border-l-2 border-observation">
                  <CheckCircle2 size={12} className="text-observation shrink-0 mt-0.5" />
                  <span className="text-[12px] text-ink-light">{strength}</span>
                </div>
              ))}
            </div>
          )}

          {result.headlineVsStudy && (
            <div className="p-3 bg-paper-dark/50 rounded-md border border-rule">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={13} className="text-curiosity" />
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Headline vs Study</span>
              </div>
              <p className="text-[12px] text-ink-light leading-relaxed">{result.headlineVsStudy}</p>
            </div>
          )}

          {result.summary && (
            <p className="text-[13px] text-ink-light leading-relaxed pt-1 border-t border-rule">{result.summary}</p>
          )}
        </div>
      )}
    </Card>
  );
}
