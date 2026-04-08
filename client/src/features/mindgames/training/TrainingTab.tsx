import { InoculationPanel } from './InoculationPanel';
import { ManipulationLabPanel } from './ManipulationLabPanel';
import { PatternTests } from './PatternTests';
import { TabHeader } from '../common';
import { Target } from 'lucide-react';

export function TrainingTab() {
  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Target size={26} className="text-curiosity md:!w-8 md:!h-8" />}
        title="Spot It"
        description="Practice catching manipulation in headlines and learn why your brain falls for patterns that aren't there."
      />

      <ManipulationLabPanel />
      <InoculationPanel />
      <PatternTests />
    </div>
  );
}
