import { Flame, Trophy, Calendar } from 'lucide-react';
import type { GamificationStats } from '../../../types';

const DAY_MS = 86_400_000;

interface StreakTrackerProps {
  stats: GamificationStats;
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getStreakDays(lastChallengeDate: string | null, streakLength: number): Set<string> {
  if (!lastChallengeDate || streakLength === 0) return new Set();
  const set = new Set<string>();
  const last = new Date(lastChallengeDate + 'T00:00:00Z');
  for (let i = 0; i < streakLength; i++) {
    const d = new Date(last.getTime() - i * DAY_MS);
    set.add(d.toISOString().split('T')[0]);
  }
  return set;
}

export function StreakTracker({ stats }: StreakTrackerProps) {
  const last7 = getLast7Days();
  const streakDays = getStreakDays(
    stats.last_challenge_date,
    stats.current_streak
  );

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-rule bg-paper-dark px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Flame
            size={18}
            className={stats.current_streak > 0 ? 'text-orange-500' : 'text-ink-muted'}
          />
          <span className="text-sm font-semibold text-ink">
            {stats.current_streak}
          </span>
          <span className="text-xs text-ink-muted">day streak</span>
        </div>

        <span className="text-ink-muted/30">·</span>

        <div className="flex items-center gap-1.5">
          <Trophy size={14} className="text-ink-muted" />
          <span className="text-xs text-ink-muted">
            Best: {stats.longest_streak}
          </span>
        </div>

        <span className="text-ink-muted/30">·</span>

        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-ink-muted" />
          <span className="text-xs text-ink-muted">
            {stats.total_antibodies} antibodies
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {last7.map((date) => {
          const completed = streakDays.has(date);
          const isToday = date === last7[last7.length - 1];
          return (
            <div
              key={date}
              title={date}
              className={`h-5 w-5 rounded-sm border text-[9px] font-bold flex items-center justify-center transition-colors ${
                completed
                  ? 'border-green-500/40 bg-green-500/15 text-green-700'
                  : isToday
                    ? 'border-ink-muted/40 bg-paper text-ink-muted'
                    : 'border-rule bg-paper text-ink-muted/30'
              }`}
            >
              {completed ? '✓' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
