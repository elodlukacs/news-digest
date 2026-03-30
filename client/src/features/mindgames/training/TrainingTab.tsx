import { InoculationPanel } from './InoculationPanel';
import { PatternTests } from './PatternTests';
import { TabHeader } from '../common';
import { Target } from 'lucide-react';

export function TrainingTab() {
  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Target size={24} className="text-curiosity md:!w-7 md:!h-7" />}
        title="Training Suite"
        description="Build cognitive defenses through active practice. Train your ability to spot manipulation tactics and recognize cognitive biases."
      />

      <InoculationPanel />
      <PatternTests />
    </div>
  );
}
