import { useState, useCallback } from 'react';
import { Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import { LlmProvider } from './contexts/LlmContext';
import { NavigationBar } from './components/NavigationBar';
import { FeedManager } from './components/FeedManager';
import { LlmStatsModal } from './components/LlmStatsModal';
import { PullToRefreshIndicator } from './components/PullToRefresh';
import { useCategories, useFeeds } from './hooks/useApi';
import { useModels } from './hooks/useModels';
import { slugify } from './utils/slugify';
import { useTheme } from './hooks/useTheme';
import type { Theme } from './hooks/useTheme';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { TooltipProvider } from './components/ui/tooltip';
import { CategoryRoute } from './components/routes/CategoryRoute';
import { BriefingRoute } from './components/routes/BriefingRoute';
import { JobsRoute } from './components/routes/JobsRoute';
import { ReleasesRoute } from './components/routes/ReleasesRoute';
import { MindGamesRoute } from './components/routes/MindGamesRoute';
import { PromptManagerRoute } from './components/routes/PromptManagerRoute';
import { BreakRoute } from './components/routes/BreakRoute';
import { LogsRoute } from './components/routes/LogsRoute';
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
  const { categories, addCategory, deleteCategory, renameCategory, reorderCategory } = useCategories();
  const [managingId, setManagingId] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedLlm, setSelectedLlm] = useState('openai/gpt-oss-120b');
  const [articleFontSize, setArticleFontSize] = useState(() => {
    const saved = localStorage.getItem('articleFontSize');
    return saved ? Number(saved) : 16;
  });

  const handleFontSizeChange = useCallback((size: number) => {
    setArticleFontSize(size);
    localStorage.setItem('articleFontSize', String(size));
  }, []);
  const navigate = useNavigate();

  const { feeds, addFeed, deleteFeed } = useFeeds(managingId);
  const { models, loading: modelsLoading } = useModels();

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
    categories,
    selectedLlm,
    onLlmChange: setSelectedLlm,
    onManageFeeds: handleManageFeeds,
    deleteCategory: handleDeleteCategory,
    onSelectCategory: handleSelectCategory,
    articleFontSize,
    onFontSizeChange: handleFontSizeChange,
  };

  const { pulling, pullProgress, containerRef } = usePullToRefresh({
    onRefresh: () => window.location.reload(),
    threshold: 80,
  });

  return (
    <LlmProvider value={selectedLlm}>
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
          models={models}
          modelsLoading={modelsLoading}
          articleFontSize={articleFontSize}
          onFontSizeChange={handleFontSizeChange}
        />

        <Outlet context={outletContext} />

        {managingId && managingCategory && (
          <FeedManager
            categoryId={managingId}
            categoryName={managingCategory.name}
            feeds={feeds}
            categories={categories}
            onAdd={addFeed}
            onDelete={deleteFeed}
            onClose={() => setManagingId(null)}
            onRename={renameCategory}
            onReorder={reorderCategory}
          />
        )}

        <LlmStatsModal open={showStats} onClose={() => setShowStats(false)} />
      </div>
    </TooltipProvider>
    </LlmProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<BreakRoute />} />
        <Route path="category/:categoryName" element={<CategoryRoute />} />
        <Route path="briefing" element={<BriefingRoute />} />
        <Route path="break" element={<BreakRoute />} />
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
