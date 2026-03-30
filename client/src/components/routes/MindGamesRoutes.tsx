import { OverviewTab } from '../../features/mindgames/overview/OverviewTab';
import { TrainingTab } from '../../features/mindgames/training/TrainingTab';
import { AnalysisTab } from '../../features/mindgames/analysis/AnalysisTab';
import { ReflectionTab } from '../../features/mindgames/reflection/ReflectionTab';
import { ReferenceTab } from '../../features/mindgames/reference/ReferenceTab';
import { QuizTab } from '../../features/mindgames/quiz/QuizTab';

export function MindGamesOverviewRoute() {
  return <OverviewTab />;
}

export function MindGamesTrainingRoute() {
  return <TrainingTab />;
}

export function MindGamesAnalysisRoute() {
  return <AnalysisTab />;
}

export function MindGamesReflectionRoute() {
  return <ReflectionTab />;
}

export function MindGamesReferenceRoute() {
  return <ReferenceTab />;
}

export function MindGamesQuizRoute() {
  return <QuizTab />;
}
