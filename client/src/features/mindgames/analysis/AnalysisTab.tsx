import { ForensicPanel } from './ForensicPanel';
import { CompareCoverage } from './CompareCoverage';
import { NewsSpectrum } from './NewsSpectrum';
import { TabHeader } from '../common';
import { Search } from 'lucide-react';

export function AnalysisTab() {
  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Search size={26} className="text-observation md:!w-8 md:!h-8" />}
        title="Dissect"
        description="Pull apart an article to find logical fallacies, compare how different outlets cover the same story, and see where sources sit on the bias spectrum."
      />

      <ForensicPanel />

      <div className="grid md:grid-cols-2 gap-4 items-stretch">
        <CompareCoverage />
        <NewsSpectrum />
      </div>
    </div>
  );
}
