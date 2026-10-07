import { useState, useCallback, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LlmProvider } from '../../contexts/LlmContext';
import { NavigationBar } from '../NavigationBar';
import { FeedManager } from '../FeedManager';
import { LlmStatsModal } from '../LlmStatsModal';
import { PullToRefreshIndicator } from '../PullToRefresh';
import { useCategories, useFeeds } from '../../hooks/useApi';
import { useModels } from '../../hooks/useModels';
import { slugify } from '../../utils/slugify';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../hooks/useTheme';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { TooltipProvider } from '../ui/tooltip';
import type { AppOutletContext } from '../../types/routing';
import type { Category } from '../../types';

export function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { categories, addCategory, deleteCategory, renameCategory, reorderCategory } = useCategories();
  const [managingId, setManagingId] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  // Persisted like articleFontSize — it reset on every reload, which was
  // inconsistent with the other toolbar preference.
  const [selectedLlm, setSelectedLlm] = useState(
    () => localStorage.getItem('selectedLlm') || 'deepseek-flash',
  );
  const [articleFontSize, setArticleFontSize] = useState(() => {
    const saved = localStorage.getItem('articleFontSize');
    return saved ? Number(saved) : 16;
  });

  const handleFontSizeChange = useCallback((size: number) => {
    setArticleFontSize(size);
    localStorage.setItem('articleFontSize', String(size));
  }, []);

  const handleLlmChange = useCallback((model: string) => {
    setSelectedLlm(model);
    localStorage.setItem('selectedLlm', model);
  }, []);
  const navigate = useNavigate();

  const { feeds, addFeed, deleteFeed } = useFeeds(managingId);
  const { models, loading: modelsLoading, defaultModel } = useModels();

  // A stored model the server no longer lists (retired, or its key removed)
  // would be requested on every call. Fall back to one that exists; the
  // server still falls through its provider chain if that one fails too.
  // Not persisted: if the model list was only partly loaded, a reload restores
  // the stored choice.
  const effectiveLlm = useMemo(() => {
    if (modelsLoading || models.length === 0 || models.some((m) => m.id === selectedLlm)) return selectedLlm;
    return models.some((m) => m.id === defaultModel) ? defaultModel : models[0].id;
  }, [models, modelsLoading, selectedLlm, defaultModel]);

  const managingCategory = categories.find((c: Category) => c.id === managingId);

  const handleSelectCategory = useCallback((name: string) => {
    navigate(`/category/${slugify(name)}`);
  }, [navigate]);

  const handleManageFeeds = useCallback((categoryId: number) => {
    setManagingId(categoryId);
  }, []);

  const handleDeleteCategory = useCallback(async (id: number) => {
    await deleteCategory(id);
  }, [deleteCategory]);

  const handleAddCategory = useCallback(async (name: string) => {
    await addCategory(name);
  }, [addCategory]);

  // Memoized: a fresh object literal every render re-rendered every
  // useOutletContext consumer and churned the dep arrays downstream of it.
  const outletContext: AppOutletContext = useMemo(() => ({
    categories,
    selectedLlm: effectiveLlm,
    onLlmChange: handleLlmChange,
    onManageFeeds: handleManageFeeds,
    addCategory: handleAddCategory,
    deleteCategory: handleDeleteCategory,
    onSelectCategory: handleSelectCategory,
    articleFontSize,
    onFontSizeChange: handleFontSizeChange,
  }), [
    categories, effectiveLlm, handleLlmChange, handleManageFeeds, handleAddCategory,
    handleDeleteCategory, handleSelectCategory, articleFontSize, handleFontSizeChange,
  ]);

  const { pulling, pullProgress, containerRef } = usePullToRefresh({
    onRefresh: () => window.location.reload(),
    threshold: 80,
  });

  return (
    <LlmProvider value={effectiveLlm}>
    <TooltipProvider>
      <div className="min-h-screen bg-paper" ref={containerRef}>
        <PullToRefreshIndicator pulling={pulling} pullProgress={pullProgress} />
        <NavigationBar
          categories={categories}
          onAdd={addCategory}
          theme={theme}
          onThemeChange={(t) => setTheme(t as Theme)}
          onShowStats={() => setShowStats(true)}
          selectedLlm={effectiveLlm}
          onLlmChange={handleLlmChange}
          models={models}
          modelsLoading={modelsLoading}
          articleFontSize={articleFontSize}
          onFontSizeChange={handleFontSizeChange}
        />

        <Outlet context={outletContext} />

        {managingId != null && managingCategory && (
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
