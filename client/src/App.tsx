import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import {
  CategoryRoute,
  BriefingRoute,
  JobsRoute,
  ReleasesRoute,
  MindGamesRoute,
  PromptManagerRoute,
  HomeRoute,
  LogsRoute,
  ExploreFeedsRoute,
  MindGamesOverviewRoute,
  MindGamesTrainingRoute,
  MindGamesAnalysisRoute,
  MindGamesReflectionRoute,
  MindGamesReferenceRoute,
  MindGamesQuizRoute,
} from './components/routes';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeRoute />} />
        <Route path="category/:categoryName" element={<CategoryRoute />} />
        <Route path="briefing" element={<BriefingRoute />} />
        <Route path="explore" element={<ExploreFeedsRoute />} />
        <Route path="jobs" element={<JobsRoute />} />
        <Route path="releases" element={<ReleasesRoute />} />
        <Route path="prompts" element={<PromptManagerRoute />} />
        <Route path="logs" element={<LogsRoute />} />
        <Route path="mindgames" element={<MindGamesRoute />}>
          <Route index element={<MindGamesOverviewRoute />} />
          <Route path="training" element={<MindGamesTrainingRoute />} />
          <Route path="analysis" element={<MindGamesAnalysisRoute />} />
          <Route path="reflection" element={<MindGamesReflectionRoute />} />
          <Route path="reference" element={<MindGamesReferenceRoute />} />
          <Route path="quiz" element={<MindGamesQuizRoute />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
