import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Loader2, TrendingUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { API_BASE } from '../../../config';
import type { JournalTrend } from '../../../types';

interface Props {
  compact?: boolean;
}

const DAYS_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

export function JournalTrends({ compact = false }: Props) {
  const [entries, setEntries] = useState<JournalTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const loadTrends = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/scientist/journal/trends?days=${days}`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to load trends');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadTrends();
    return () => abortRef.current?.abort();
  }, [loadTrends]);

  const handleDaysChange = useCallback((newDays: number) => {
    setDays(newDays);
  }, []);

  const chartData = entries.reduce((acc, e) => {
    const existing = acc.find(d => d.dateLabel === e.date && d.topic === e.topic);
    if (existing) {
      existing.postConfidence = Math.round((existing.postConfidence + e.postConfidence) / 2);
      existing.preConfidence = Math.round((existing.preConfidence + e.preConfidence) / 2);
      existing.shift = Math.round(existing.shift + e.shift);
    } else {
      acc.push({
        ...e,
        dateLabel: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    return acc;
  }, [] as (JournalTrend & { dateLabel: string })[]);

  const uniqueTopics = [...new Set(entries.map(e => e.topic))];
  const topicColors: Record<string, string> = {};
  const colorPalette = [
    'var(--color-observation)',
    'var(--color-curiosity)',
    'var(--color-outrage)',
    '#8B5CF6',
    '#06B6D4',
    '#F59E0B',
  ];
  uniqueTopics.forEach((topic, i) => {
    topicColors[topic] = colorPalette[i % colorPalette.length];
  });

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: JournalTrend & { dateLabel: string } }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-paper border border-rule rounded p-2.5 shadow-md text-[11px]">
        <p className="font-semibold text-ink mb-1.5">{d.dateLabel}</p>
        <p className="text-ink-muted truncate max-w-[200px]">{d.topic}</p>
        <div className="mt-1.5 space-y-0.5">
          <p>Before: <span className="font-medium">{d.preConfidence}%</span></p>
          <p>After: <span className="font-medium">{d.postConfidence}%</span></p>
          <p style={{ color: d.shift > 0 ? 'var(--color-observation)' : d.shift < 0 ? 'var(--color-outrage)' : 'var(--color-ink-muted)' }}>
            Shift: {d.shift > 0 ? '+' : ''}{d.shift}%
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="p-5 flex items-center justify-center h-[200px]" role="status" aria-busy="true">
        <Loader2 size={20} className="animate-spin text-ink-muted" />
        <span className="sr-only">Loading trends…</span>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-5">
        <p className="text-[13px] text-outrage">{error}</p>
        <Button onClick={loadTrends} variant="outline" className="mt-2 text-[12px] h-8">Retry</Button>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={15} className="text-curiosity" />
          <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Trends</span>
        </div>
        <p className="text-[12px] text-ink-muted">
          No journal entries yet. Complete debates to see your belief trends over time.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-curiosity" />
          <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Trends</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar size={12} className="text-ink-muted" />
          <div className="flex gap-0.5" role="group" aria-label="Select date range">
            {DAYS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleDaysChange(opt.value)}
                aria-pressed={days === opt.value}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                  days === opt.value
                    ? 'bg-ink text-paper'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" opacity={0.5} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-rule)' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 10 }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="preConfidence"
              name="Before"
              stroke="var(--color-ink-muted)"
              strokeWidth={1.5}
              dot={{ r: 3, fill: 'var(--color-ink-muted)' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="postConfidence"
              name="After"
              stroke="var(--color-curiosity)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--color-curiosity)' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!compact && uniqueTopics.length > 0 && (
        <div className="pt-2 border-t border-rule">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-2">Topics</p>
          <div className="flex flex-wrap gap-2">
            {uniqueTopics.slice(0, 5).map(topic => (
              <div
                key={topic}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
                style={{ backgroundColor: `color-mix(in srgb, ${topicColors[topic]} 15%, transparent)` }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: topicColors[topic] }} />
                <span className="text-ink truncate max-w-[120px]">{topic}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] text-ink-muted">
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5" style={{ backgroundColor: 'var(--color-ink-muted)' }} />
          <span>Before debate</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5" style={{ backgroundColor: 'var(--color-curiosity)' }} />
          <span>After debate</span>
        </div>
      </div>
    </div>
  );
}
