import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import { NavigationBar } from './components/NavigationBar';
import { FeedManager } from './components/FeedManager';
import { LlmStatsModal } from './components/LlmStatsModal';
import { PullToRefreshIndicator } from './components/PullToRefresh';
import { useCategories, useFeeds } from './hooks/useApi';
import { cleanupOldData } from './utils/trackReading';
import { slugify } from './utils/slugify';
import { useTheme } from './hooks/useTheme';
import type { Theme } from './hooks/useTheme';
import { useWidgets } from './hooks/useWidgets';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { TooltipProvider } from './components/ui/tooltip';
import { HomeRoute } from './components/routes/HomeRoute';
import { CategoryRoute } from './components/routes/CategoryRoute';
import { BriefingRoute } from './components/routes/BriefingRoute';
import { JobsRoute } from './components/routes/JobsRoute';
import { ReleasesRoute } from './components/routes/ReleasesRoute';
import { MindGamesRoute } from './components/routes/MindGamesRoute';
import { PromptManagerRoute } from './components/routes/PromptManagerRoute';
import {
  MindGamesOverviewRoute,
  MindGamesTrainingRoute,
  MindGamesAnalysisRoute,
  MindGamesReflectionRoute,
  MindGamesReferenceRoute,
  MindGamesQuizRoute,
} from './components/routes/MindGamesRoutes';
import type { AppOutletContext } from './types/routing';

function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { categories, addCategory, deleteCategory } = useCategories();
  const [managingId, setManagingId] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedLlm, setSelectedLlm] = useState('llama');
  const navigate = useNavigate();

  const { feeds, addFeed, deleteFeed } = useFeeds(managingId);
  const { weather, rates, headlines, crypto, hackerNews, releases, trending } = useWidgets();

  const managingCategory = categories.find((c) => c.id === managingId);

  const handleSelectCategory = useCallback((name: string) => {
    navigate(`/category/${slugify(name)}`);
  }, [navigate]);

  const handleManageFeeds = useCallback((categoryId: number) => {
    setManagingId(categoryId);
  }, []);

  const handleDeleteCategory = useCallback(async (id: number) => {
    await deleteCategory(id);
  }, [deleteCategory]);

  const outletContext: AppOutletContext = {
    weather,
    crypto,
    rates,
    headlines,
    hackerNews,
    trending,
    releases,
    categories,
    selectedLlm,
    onLlmChange: setSelectedLlm,
    onManageFeeds: handleManageFeeds,
    deleteCategory: handleDeleteCategory,
    onSelectCategory: handleSelectCategory,
  };

  const { pulling, pullProgress, containerRef } = usePullToRefresh({
    onRefresh: () => window.location.reload(),
    threshold: 80,
  });

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-paper" ref={containerRef}>
        <PullToRefreshIndicator pulling={pulling} pullProgress={pullProgress} />
        <NavigationBar
          categories={categories}
          onAdd={addCategory}
          theme={theme}
          onThemeChange={(t) => setTheme(t as Theme)}
          onShowStats={() => setShowStats(true)}
          selectedLlm={selectedLlm}
          onLlmChange={setSelectedLlm}
        />

        <Outlet context={outletContext} />

        {managingId && managingCategory && (
          <FeedManager
            categoryId={managingId}
            categoryName={managingCategory.name}
            feeds={feeds}
            onAdd={addFeed}
            onDelete={deleteFeed}
            onClose={() => setManagingId(null)}
          />
        )}

        <LlmStatsModal open={showStats} onClose={() => setShowStats(false)} />
      </div>
    </TooltipProvider>
  );
}

function App() {
  useEffect(() => {
    cleanupOldData();
  }, []);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeRoute />} />
        <Route path="category/:categoryName" element={<CategoryRoute />} />
        <Route path="briefing" element={<BriefingRoute />} />
        <Route path="jobs" element={<JobsRoute />} />
        <Route path="releases" element={<ReleasesRoute />} />
        <Route path="prompts" element={<PromptManagerRoute />} />
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
