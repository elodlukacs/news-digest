import { Clock, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { parseRateLimitError } from '../utils/parseRateLimitError';

interface RateLimitDialogProps {
  error: string;
  open: boolean;
  onClose: () => void;
}

export function RateLimitDialog({ error, open, onClose }: RateLimitDialogProps) {
  const info = parseRateLimitError(error);
  const usagePercent = info.used && info.limit ? Math.round((info.used / info.limit) * 100) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <Clock size={16} className="text-masthead" />
            Rate Limit Reached
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            The AI provider has temporarily limited requests. This is normal on the free tier.
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-4 py-3 bg-paper-dark border border-rule">
              <span className="text-xs text-ink-muted uppercase tracking-wider">Wait time</span>
              <span className="font-serif font-bold text-masthead">{info.waitTime}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-paper-dark border border-rule">
              <span className="text-xs text-ink-muted uppercase tracking-wider">Model</span>
              <span className="text-sm font-medium">{info.model}</span>
            </div>
            {usagePercent !== null && (
              <div className="px-4 py-3 bg-paper-dark border border-rule">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-ink-muted uppercase tracking-wider">Daily usage</span>
                  <span className="text-sm font-medium">{usagePercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-masthead rounded-full" style={{ width: `${usagePercent}%` }} />
                </div>
                <p className="text-[11px] text-ink-muted mt-1.5">
                  {info.used?.toLocaleString()} / {info.limit?.toLocaleString()} tokens
                </p>
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 pt-1">
            <Zap size={12} className="text-ink-muted mt-0.5 shrink-0" />
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Try again after the wait time. Limits reset daily.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
