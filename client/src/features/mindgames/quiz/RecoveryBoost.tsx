import { useState } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { GamificationStats } from '../../../types';

interface RecoveryBoostProps {
  stats: GamificationStats;
  onRecover: () => Promise<void>;
}

export function RecoveryBoost({ stats, onRecover }: RecoveryBoostProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const shouldShow =
    !stats.completed_today &&
    stats.current_streak > 0 &&
    stats.last_challenge_date !== yesterday;

  async function handleRecover() {
    setLoading(true);
    setMessage(null);
    try {
      await onRecover();
      setMessage('Streak saved!');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Recovery failed');
    } finally {
      setLoading(false);
    }
  }

  if (message) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
        <Zap size={16} className="text-green-600 shrink-0" />
        <span className="text-sm text-green-800">{message}</span>
      </div>
    );
  }

  if (!shouldShow) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-orange-600 shrink-0" />
        <span className="text-sm text-orange-800">
          Your {stats.current_streak}-day streak is at risk!
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRecover}
        disabled={loading}
        className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100"
      >
        {loading ? 'Saving...' : 'Use Recovery Boost'}
      </Button>
    </div>
  );
}
