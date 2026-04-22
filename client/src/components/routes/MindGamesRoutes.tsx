import { OverviewTab } from '../../features/mindgames/overview/OverviewTab';
import { TrainingTab } from '../../features/mindgames/training/TrainingTab';
import { AnalysisTab } from '../../features/mindgames/analysis/AnalysisTab';
import { ReflectionTab } from '../../features/mindgames/reflection/ReflectionTab';
import { ReferenceTab } from '../../features/mindgames/reference/ReferenceTab';
import { QuizTab } from '../../features/mindgames/quiz/QuizTab';
import type { ComponentType } from 'react';

const TAB_COMPONENTS: Record<string, ComponentType> = {
  overview: OverviewTab,
  training: TrainingTab,
  analysis: AnalysisTab,
  reflection: ReflectionTab,
  reference: ReferenceTab,
  quiz: QuizTab,
};

function createMindGamesRoute(tab: string): ComponentType {
  const Component = TAB_COMPONENTS[tab];
  if (!Component) {
    throw new Error(`Unknown mindgames tab: ${tab}`);
  }
  return function MindGamesTabRoute() {
    return <Component />;
  };
}

export const MindGamesOverviewRoute = createMindGamesRoute('overview');
export const MindGamesTrainingRoute = createMindGamesRoute('training');
export const MindGamesAnalysisRoute = createMindGamesRoute('analysis');
export const MindGamesReflectionRoute = createMindGamesRoute('reflection');
export const MindGamesReferenceRoute = createMindGamesRoute('reference');
export const MindGamesQuizRoute = createMindGamesRoute('quiz');
