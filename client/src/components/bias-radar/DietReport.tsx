import { useEffect, useState } from 'react';
import type { BiasRating } from '../../types/lens';

const BIAS_LABELS: Record<BiasRating, string> = {
  left: 'Left',
  'lean-left': 'Lean Left',
  center: 'Center',
  'lean-right': 'Lean Right',
  right: 'Right',
  unknown: 'Unknown',
};

const BIAS_COLORS: Record<BiasRating, string> = {
  left: '#2563eb',
  'lean-left': '#60a5fa',
  center: '#6b7280',
  'lean-right': '#f87171',
  right: '#dc2626',
  unknown: '#6b7280',
};

const BIAS_ORDER: BiasRating[] = ['left', 'lean-left', 'center', 'lean-right', 'right', 'unknown'];

interface DietReportEntry {
  source: string;
  biasRating: BiasRating;
  articleCount: number;
  titles: string[];
}

interface DietReport {
  weekStart: string;
  weekEnd: string;
  totalArticles: number;
  distribution: Record<BiasRating, number>;
  entries: DietReportEntry[];
  dominantBias: BiasRating | null;
  insight: string;
}

interface DietReportProps {
  userId?: string;
}

export default function DietReport({ userId }: DietReportProps) {
  const [report, setReport] = useState<DietReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const allArticles: { url: string; source: string; title: string }[] = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const key = `diet_tracking_${dateStr}`;
      
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const articles = JSON.parse(stored);
          if (Array.isArray(articles)) {
            allArticles.push(...articles);
          }
        }
      } catch {
        // ignore
      }
    }
    
    if (allArticles.length === 0) {
      setNote('No articles tracked yet. Start reading some news!');
      setLoading(false);
      return;
    }

    const sourceMap = new Map<string, DietReportEntry>();
    for (const article of allArticles) {
      const source = article.source || 'Unknown';
      const biasRating = guessBiasFromSource(source);
      const existing = sourceMap.get(source);
      
      if (existing) {
        existing.articleCount++;
        if (existing.titles.length < 3 && article.title) existing.titles.push(article.title);
      } else {
        sourceMap.set(source, { source, biasRating, articleCount: 1, titles: article.title ? [article.title] : [] });
      }
    }

    const entries = Array.from(sourceMap.values()).sort((a, b) => b.articleCount - a.articleCount);
    const total = entries.reduce((sum, e) => sum + e.articleCount, 0);

    const distribution: Record<BiasRating, number> = {
      left: 0, 'lean-left': 0, center: 0, 'lean-right': 0, right: 0, unknown: 0,
    };
    for (const entry of entries) {
      distribution[entry.biasRating] += entry.articleCount;
    }
    
    const distributionCount = { ...distribution };
    for (const key of Object.keys(distributionCount)) {
      distributionCount[key as BiasRating] = Math.round((distributionCount[key as BiasRating] / total) * 100);
    }

    const dominantBias = (
      Object.entries(distributionCount)
        .filter(([k]) => k !== 'unknown')
        .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
    ) as BiasRating | null;

    let insight = '';
    if (dominantBias && distributionCount[dominantBias] > 60) {
      insight = `${distributionCount[dominantBias]}% of your reading was from ${BIAS_LABELS[dominantBias]} sources. That's a strong lean.`;
    } else if (distributionCount.center > 40) {
      insight = 'Your reading skewed toward center sources this week. Good balance.';
    } else {
      insight = 'Your reading was relatively spread across the spectrum.';
    }

    const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const weekEnd = new Date().toISOString().slice(0, 10);
    
    setReport({
      weekStart,
      weekEnd,
      totalArticles: total,
      distribution: distributionCount,
      entries,
      dominantBias,
      insight,
    });
  }, [userId]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-ink-muted">Loading your week...</div>;
  }

  if (!report) {
    return (
      <div className="px-4 py-6 text-center text-sm text-ink-muted">
        {note ?? 'No data available yet.'}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <div>
        <p className="text-xs text-ink-muted">
          {report.weekStart} → {report.weekEnd} · {report.totalArticles} articles
        </p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-2">
          Your reading diet
        </p>
        <div className="flex h-4 rounded-full overflow-hidden w-full">
          {BIAS_ORDER.filter((b) => (report.distribution[b] ?? 0) > 0).map((bias) => (
            <div
              key={bias}
              title={`${BIAS_LABELS[bias]}: ${report.distribution[bias]}%`}
              style={{
                width: `${report.distribution[bias]}%`,
                backgroundColor: BIAS_COLORS[bias],
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {BIAS_ORDER.filter((b) => (report.distribution[b] ?? 0) > 0).map((bias) => (
            <span key={bias} className="flex items-center gap-1 text-xs text-ink-muted">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: BIAS_COLORS[bias] }}
              />
              {BIAS_LABELS[bias]} {report.distribution[bias]}%
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">{report.insight}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-2">
          Sources you read most
        </p>
        <div className="space-y-1.5">
          {report.entries.slice(0, 6).map((entry) => (
            <div key={entry.source} className="flex items-center gap-2">
              <div className="w-24 shrink-0 text-xs text-ink-muted truncate">{entry.source}</div>
              <div className="flex-1 h-2 rounded-full bg-paper-dark overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((entry.articleCount / report.totalArticles) * 100)}%`,
                    backgroundColor: BIAS_COLORS[entry.biasRating],
                  }}
                />
              </div>
              <span className="text-xs text-ink-muted shrink-0">{entry.articleCount}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-ink-muted">
        Bias ratings: <a href="https://www.allsides.com/media-bias/ratings" target="_blank" rel="noopener noreferrer" className="underline">AllSides</a> · CC BY-NC 4.0
      </p>
    </div>
  );
}

function guessBiasFromSource(source: string): BiasRating {
  const sourceLower = source.toLowerCase();
  const leanLeft = ['motherjones.com', 'huffpost.com', 'msnbc.com', 'dailykos.com', 'vox.com', 'cnn.com', 'theguardian.com', 'washingtonpost.com', 'nytimes.com'];
  const leanRight = ['foxnews.com', 'breitbart.com', 'dailywire.com', 'nationalreview.com', 'newsmax.com', 'nypost.com', 'wsj.com'];
  const center = ['bbc.com', 'reuters.com', 'apnews.com', 'csmonitor.com', 'economist.com'];
  
  if (leanLeft.some(s => sourceLower.includes(s))) return 'lean-left';
  if (leanRight.some(s => sourceLower.includes(s))) return 'lean-right';
  if (center.some(s => sourceLower.includes(s))) return 'center';
  
  if (sourceLower.includes('huffpost') || sourceLower.includes('motherjones') || sourceLower.includes('msnbc') || sourceLower.includes('dailykos') || sourceLower.includes('vox') || sourceLower.includes('cnn')) return 'left';
  if (sourceLower.includes('fox') || sourceLower.includes('breitbart') || sourceLower.includes('daily wire') || sourceLower.includes('national review') || sourceLower.includes('newsmax')) return 'right';
  
  return 'center';
}