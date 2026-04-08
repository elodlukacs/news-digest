import { PromptLibrary } from './PromptLibrary';
import { NarrativeMapPanel } from './NarrativeMapPanel';
import { ConspiracyAnatomyPanel } from './ConspiracyAnatomyPanel';
import { SourceCredibilityLab } from './SourceCredibilityLab';
import { PropagandaTimeline } from './PropagandaTimeline';
import { AskTheManipulator } from './AskTheManipulator';
import { DisinfoMap } from './DisinfoMap';
import { TabHeader } from '../common';
import { Card } from '../../../components/ui/card';
import { BookOpen } from 'lucide-react';

export function ReferenceTab() {
  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<BookOpen size={24} className="text-observation md:!w-7 md:!h-7" />}
        title="Reference Suite"
        description="Learning resources and advanced visualizations. Prompts for critical thinking and maps of misinformation ecosystems."
      />

      <ConspiracyAnatomyPanel />
      <AskTheManipulator />
      <SourceCredibilityLab />
      <PropagandaTimeline />
      <Card className="p-5"><PromptLibrary /></Card>
      <NarrativeMapPanel />
      <Card className="p-5"><DisinfoMap /></Card>
    </div>
  );
}
