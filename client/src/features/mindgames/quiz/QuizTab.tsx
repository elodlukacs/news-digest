import { DailyQuiz } from './DailyQuiz';
import { TabHeader } from '../common';
import { Card } from '../../../components/ui/card';
import { Zap } from 'lucide-react';

export function QuizTab() {
  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Zap size={24} className="text-curiosity md:!w-7 md:!h-7" />}
        title="Daily Quiz"
        description="Test your ability to spot manipulation techniques in real headlines. A new article every day."
      />

      <Card className="p-5">
        <DailyQuiz />
      </Card>
    </div>
  );
}
