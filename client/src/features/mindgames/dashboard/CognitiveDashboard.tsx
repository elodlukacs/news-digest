import { useState } from 'react';
import { CognitiveTabNav } from './CognitiveTabNav';
import type { CognitiveTab } from './types';
import { OverviewTab } from '../overview/OverviewTab';
import { TrainingTab } from '../training/TrainingTab';
import { AnalysisTab } from '../analysis/AnalysisTab';
import { ReflectionTab } from '../reflection/ReflectionTab';
import { ReferenceTab } from '../reference/ReferenceTab';
import { QuizTab } from '../quiz/QuizTab';

export function CognitiveDashboard() {
  const [activeTab, setActiveTab] = useState<CognitiveTab>('overview');

  const handleNavigate = (tab: 'training' | 'analysis' | 'reflection' | 'reference') => {
    setActiveTab(tab);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-3 md:px-4 pb-12 view-fade">
      {/* Tab Navigation */}
      <div className="pt-3 md:pt-6">
        <CognitiveTabNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'overview' && <OverviewTab onNavigate={handleNavigate} />}
        {activeTab === 'training' && <TrainingTab />}
        {activeTab === 'analysis' && <AnalysisTab />}
        {activeTab === 'reflection' && <ReflectionTab />}
        {activeTab === 'reference' && <ReferenceTab />}
        {activeTab === 'quiz' && <QuizTab />}
      </div>
    </div>
  );
}
