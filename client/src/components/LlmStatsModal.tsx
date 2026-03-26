import { useState, useEffect } from 'react';
import { Zap, Clock, BarChart3, Gauge } from 'lucide-react';
import { API_BASE } from '../config';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Progress } from './ui/progress';
import type { LlmStats, ProviderQuota } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LlmStatsModal({ open, onClose }: Props) {
  const [stats, setStats] = useState<LlmStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`${API_BASE}/stats/llm?days=30`)
      .then(async (r) => {
        if (!r.ok) { setError(true); return; }
        const data = await r.json();
        setStats(data);
      })
      .catch(() => setError(true));
  }, [open]);

  const maxDailyTokens = stats ? Math.max(...stats.daily.map((d) => d.tokens), 1) : 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b border-rule">
          <DialogTitle className="flex items-center gap-2.5">
            <BarChart3 size={16} className="text-masthead" />
            LLM Usage Statistics
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-80px)]">
          {!stats && !error ? (
            <div className="p-8 text-center text-ink-muted text-sm">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-ink-muted text-sm">Failed to load statistics</div>
          ) : stats ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="px-4 py-3 bg-paper-dark border border-rule">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={12} className="text-masthead" />
                    <span className="text-[10px] uppercase tracking-wider text-ink-muted">Total Tokens</span>
                  </div>
                  <p className="text-2xl font-serif font-bold">{stats.total_tokens.toLocaleString()}</p>
                </div>
                <div className="px-4 py-3 bg-paper-dark border border-rule">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={12} className="text-masthead" />
                    <span className="text-[10px] uppercase tracking-wider text-ink-muted">API Calls</span>
                  </div>
                  <p className="text-2xl font-serif font-bold">{stats.total_calls}</p>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] uppercase tracking-[0.15em] font-semibold text-ink-muted mb-3">By Provider</h4>
                <div className="space-y-2">
                  {Object.entries(stats.by_provider).map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between px-3 py-2 bg-paper-dark border border-rule">
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-xs text-ink-muted">
                        {data.calls} calls &middot; {data.tokens.toLocaleString()} tokens
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[11px] uppercase tracking-[0.15em] font-semibold text-ink-muted mb-3">By Purpose</h4>
                <div className="space-y-2">
                  {Object.entries(stats.by_purpose).map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between px-3 py-2 bg-paper-dark border border-rule">
                      <span className="text-sm font-medium capitalize">{name}</span>
                      <span className="text-xs text-ink-muted">
                        {data.calls} calls &middot; {data.tokens.toLocaleString()} tokens
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {stats.quotas && stats.quotas.length > 0 && (
                <div>
                  <h4 className="text-[11px] uppercase tracking-[0.15em] font-semibold text-ink-muted mb-3">
                    <Gauge size={11} className="inline mr-1.5 -mt-0.5" />
                    Account Quotas (Live)
                  </h4>
                  <div className="space-y-3">
                    {stats.quotas.map((q: ProviderQuota) => {
                      const tokenPercent = q.limit_tokens && q.remaining_tokens != null
                        ? Math.round(((q.limit_tokens - q.remaining_tokens) / q.limit_tokens) * 100)
                        : null;
                      const reqPercent = q.limit_requests && q.remaining_requests != null
                        ? Math.round(((q.limit_requests - q.remaining_requests) / q.limit_requests) * 100)
                        : null;
                      return (
                        <div key={q.provider} className="px-4 py-3 bg-paper-dark border border-rule space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">{q.provider}</span>
                            <span className="text-[10px] text-ink-muted">{q.model}</span>
                          </div>
                          {tokenPercent !== null && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase tracking-wider text-ink-muted">Tokens</span>
                                <span className="text-[11px] font-medium">
                                  {q.remaining_tokens?.toLocaleString()} / {q.limit_tokens?.toLocaleString()} remaining
                                </span>
                              </div>
                              <Progress
                                value={tokenPercent}
                                className="h-1.5"
                              />
                              {q.reset_tokens && (
                                <p className="text-[10px] text-ink-muted mt-1">Resets in {q.reset_tokens}</p>
                              )}
                            </div>
                          )}
                          {reqPercent !== null && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase tracking-wider text-ink-muted">Requests</span>
                                <span className="text-[11px] font-medium">
                                  {q.remaining_requests?.toLocaleString()} / {q.limit_requests?.toLocaleString()} remaining
                                </span>
                              </div>
                              <Progress
                                value={reqPercent}
                                className="h-1.5"
                              />
                              {q.reset_requests && (
                                <p className="text-[10px] text-ink-muted mt-1">Resets in {q.reset_requests}</p>
                              )}
                            </div>
                          )}
                          <p className="text-[9px] text-ink-muted/60">
                            Last updated: {new Date(q.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {stats.daily.length > 0 && (
                <div>
                  <h4 className="text-[11px] uppercase tracking-[0.15em] font-semibold text-ink-muted mb-3">
                    Daily Usage (30 days)
                  </h4>
                  <div className="flex items-end gap-px h-24">
                    {stats.daily.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                        <div
                          className="w-full bg-masthead/60 hover:bg-masthead transition-colors cursor-default min-h-[2px]"
                          style={{ height: `${(d.tokens / maxDailyTokens) * 100}%` }}
                        />
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-ink text-paper text-[10px] px-2 py-1 whitespace-nowrap z-10">
                          {d.date}: {d.tokens.toLocaleString()} tokens, {d.calls} calls
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
