import { useState, useCallback, useEffect } from 'react';
import { NavigationBar } from './components/NavigationBar';
import { SummaryView } from './components/SummaryView';
import { FeedManager } from './components/FeedManager';
import { WidgetSidebar } from './components/WidgetSidebar';
import { LeftSidebar } from './components/LeftSidebar';
import { MorningBriefing } from './components/MorningBriefing';
import { LlmStatsModal } from './components/LlmStatsModal';
import { NewspaperHome } from './components/NewspaperHome';
import { ReleasesPage } from './components/ReleasesPage';
import { JobsPage } from './components/JobsPage';
import DailyQuiz from './components/DailyQuiz';
import { PullToRefreshIndicator } from './components/PullToRefresh';
import { useCategories, useFeeds, useSummary, useSummaryHistory, useChat, useBriefing, useHomepage, useJobs } from './hooks/useApi';
import { cleanupOldData } from './utils/trackReading';
import { useTheme } from './hooks/useTheme';
import type { Theme } from './hooks/useTheme';
import { useWidgets } from './hooks/useWidgets';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { TooltipProvider } from './components/ui/tooltip';

function App() {
  const { theme, setTheme } = useTheme();
  const { categories, addCategory, deleteCategory } = useCategories();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [managingId, setManagingId] = useState<number | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showReleases, setShowReleases] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [showDailyQuiz, setShowDailyQuiz] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [selectedLlm, setSelectedLlm] = useState('llama');

  const { feeds, addFeed, deleteFeed } = useFeeds(managingId);
  const { summary, loading, refreshing, error, refresh } = useSummary(activeId, selectedSnapshotId, selectedLlm);
  const { dates, refresh: refreshHistory } = useSummaryHistory(activeId);
  const { messages: chatMessages, sending: chatSending, sendMessage: chatSend } = useChat(summary?.id || null, selectedLlm);
  const { briefing, loading: briefingLoading, error: briefingError, generate: generateBriefing } = useBriefing(selectedLlm);
  const { weather, rates, headlines, crypto, hackerNews, releases, trending } = useWidgets();
  const { briefs: homepageBriefs, loading: homepageLoading, refreshing: homepageRefreshing, refresh: homepageRefresh } = useHomepage();
  const { fetchJobs, ...jobsHook } = useJobs();

  useEffect(() => {
    cleanupOldData();
  }, []);

  const activeCategory = categories.find((c) => c.id === activeId);
  const managingCategory = categories.find((c) => c.id === managingId);

  const handleSelectCategory = useCallback((id: number) => {
    setActiveId(id);
    setShowBriefing(false);
    setShowReleases(false);
    setShowJobs(false);
    setShowDailyQuiz(false);
    setSelectedSnapshotId(null);
  }, []);

  const handleHome = useCallback(() => {
    setActiveId(null);
    setShowBriefing(false);
    setShowReleases(false);
    setShowJobs(false);
    setShowDailyQuiz(false);
    setSelectedSnapshotId(null);
  }, []);

  const handleBriefing = useCallback(() => {
    setShowBriefing(true);
    setActiveId(null);
    setShowReleases(false);
    setShowJobs(false);
    setShowDailyQuiz(false);
    setSelectedSnapshotId(null);
  }, []);

  const handleReleases = useCallback(() => {
    setShowReleases(true);
    setActiveId(null);
    setShowBriefing(false);
    setShowJobs(false);
    setShowDailyQuiz(false);
    setSelectedSnapshotId(null);
  }, []);

  const handleJobs = useCallback(() => {
    setShowJobs(true);
    setActiveId(null);
    setShowBriefing(false);
    setShowReleases(false);
    setShowDailyQuiz(false);
    setSelectedSnapshotId(null);
  }, []);

  const handleDailyQuiz = useCallback(() => {
    setShowDailyQuiz(true);
    setActiveId(null);
    setShowBriefing(false);
    setShowReleases(false);
    setShowJobs(false);
    setSelectedSnapshotId(null);
  }, []);

  const handleDeleteCategory = useCallback(async (id: number) => {
    await deleteCategory(id);
    if (activeId === id) setActiveId(null);
  }, [deleteCategory, activeId]);

  const handleRefresh = useCallback(async () => {
    await refresh();
    refreshHistory();
  }, [refresh, refreshHistory]);

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
        activeId={activeId}
        showBriefing={showBriefing}
        showReleases={showReleases}
        showJobs={showJobs}
        showDailyQuiz={showDailyQuiz}
        onSelect={handleSelectCategory}
        onBriefing={handleBriefing}
        onReleases={handleReleases}
        onJobs={handleJobs}
        onDailyQuiz={handleDailyQuiz}
        onAdd={addCategory}
        onHome={handleHome}
        theme={theme}
        onThemeChange={(t) => setTheme(t as Theme)}
        onShowStats={() => setShowStats(true)}
        selectedLlm={selectedLlm}
        onLlmChange={setSelectedLlm}
      />

      {/* Newspaper Home: full-width grid when no category selected */}
      {!activeCategory && !showBriefing && !showReleases && !showJobs ? (
        <div key="home" className="max-w-[1600px] mx-auto px-4 pb-12 view-fade">
          <NewspaperHome
            briefs={homepageBriefs}
            loading={homepageLoading}
            refreshing={homepageRefreshing}
            onRefresh={homepageRefresh}
            onSelectCategory={handleSelectCategory}
            weather={weather}
            crypto={crypto}
            rates={rates}
            headlines={headlines}
            hackerNews={hackerNews}
          />
        </div>
      ) : showJobs ? (
        <div key="jobs" className="max-w-[1600px] mx-auto px-4 pb-12 view-fade">
          <JobsPage {...jobsHook} fetchJobs={fetchJobs} selectedLlm={selectedLlm} />
        </div>
      ) : showDailyQuiz ? (
        <div key="daily-quiz" className="max-w-[1600px] mx-auto px-4 pb-12 view-fade">
          <DailyQuiz />
        </div>
      ) : showReleases ? (
        <div key="releases" className="max-w-[1600px] mx-auto px-4 pb-12 view-fade">
          <ReleasesPage releases={releases || []} />
        </div>
      ) : (
        <div key={showBriefing ? 'briefing' : `cat-${activeId}`} className="max-w-7xl mx-auto px-6 pb-20 flex gap-8 view-fade">
          {/* Left sidebar */}
          <LeftSidebar
            hackerNews={hackerNews}
            dates={dates}
            selectedSnapshotId={selectedSnapshotId}
            onSelectSnapshot={setSelectedSnapshotId}
            showHistory={!!activeCategory && !showBriefing}
          />

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {showBriefing ? (
              <MorningBriefing
                briefing={briefing}
                loading={briefingLoading}
                error={briefingError}
                onGenerate={generateBriefing}
              />
            ) : activeCategory ? (
              <SummaryView
                categoryId={activeCategory.id}
                categoryName={activeCategory.name}
                summary={summary}
                loading={loading}
                refreshing={refreshing}
                error={error}
                onRefresh={handleRefresh}
                onManageFeeds={() => setManagingId(activeCategory.id)}
                onDelete={() => handleDeleteCategory(activeCategory.id)}
                chatMessages={chatMessages}
                chatSending={chatSending}
                onChatSend={chatSend}
              />
            ) : null}
          </main>

          {/* Right sidebar: Widgets */}
          <WidgetSidebar weather={weather} rates={rates} headlines={headlines} crypto={crypto} trending={trending} />
        </div>
      )}

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

export default App;
