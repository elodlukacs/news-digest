import { useCallback } from 'react';
import { DailyQuiz } from './DailyQuiz';
import { StreakTracker } from './StreakTracker';
import { RecoveryBoost } from './RecoveryBoost';
import { TabHeader } from '../common';
import { Card } from '../../../components/ui/card';
import { Zap } from 'lucide-react';
import { useGamification } from '../../../hooks/useGamification';

export function QuizTab() {
  const { stats, loading, completeChallenge, applyRecoveryBoost } = useGamification();

  const handleCorrect = useCallback(async () => {
    try {
      await completeChallenge(3, 'daily_quiz');
    } catch (e) {
      console.error('Failed to record challenge completion', e);
    }
  }, [completeChallenge]);

  const handleRecover = useCallback(async () => {
    try {
      await applyRecoveryBoost();
    } catch (e) {
      console.error('Failed to use recovery boost', e);
    }
  }, [applyRecoveryBoost]);

  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Zap size={24} className="text-curiosity md:!w-7 md:!h-7" />}
        title="Daily Quiz"
        description="Test your ability to spot manipulation techniques in real headlines. A new article every day."
      />

      {!loading && stats && (
        <>
          <StreakTracker stats={stats} />
          <RecoveryBoost stats={stats} onRecover={handleRecover} />
        </>
      )}

      <Card className="p-5">
        <DailyQuiz onCorrect={handleCorrect} />
      </Card>
    </div>
  );
}
