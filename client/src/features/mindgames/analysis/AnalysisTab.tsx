import { ForensicPanel } from './ForensicPanel';
import { CompareCoverage } from './CompareCoverage';
import { NewsSpectrum } from './NewsSpectrum';
import { TabHeader } from '../common';
import { Search } from 'lucide-react';

export function AnalysisTab() {
  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Search size={24} className="text-observation md:!w-7 md:!h-7" />}
        title="Analysis Suite"
        description="Deconstruct content with critical frameworks. Analyze fallacies, evaluate research quality, and compare media coverage."
      />

      <ForensicPanel />

      <div className="grid md:grid-cols-2 gap-4 items-stretch">
        <CompareCoverage />
        <NewsSpectrum />
      </div>
    </div>
  );
}
