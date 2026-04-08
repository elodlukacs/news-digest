import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<BookOpen size={24} className="text-observation md:!w-7 md:!h-7" />}
        title="Reference Suite"
        description="Learning resources and advanced visualizations. Prompts for critical thinking and maps of misinformation ecosystems."
      />

      <div id="conspiracy-anatomy"><ConspiracyAnatomyPanel /></div>
      <div id="ask-manipulator"><AskTheManipulator /></div>
      <div id="source-credibility"><SourceCredibilityLab /></div>
      <div id="propaganda-timeline"><PropagandaTimeline /></div>
      <Card className="p-5"><PromptLibrary /></Card>
      <NarrativeMapPanel />
      <Card className="p-5"><DisinfoMap /></Card>
    </div>
  );
}
