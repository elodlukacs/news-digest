import { useState } from 'react';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { SummaryView } from './components/SummaryView';
import { FeedManager } from './components/FeedManager';
import { WidgetSidebar } from './components/WidgetSidebar';
import { LeftSidebar } from './components/LeftSidebar';
import { MorningBriefing } from './components/MorningBriefing';
import { LlmStatsModal } from './components/LlmStatsModal';
import { NewspaperHome } from './components/NewspaperHome';
import { useCategories, useFeeds, useSummary, useSummaryHistory, useChat, useBriefing, useHomepage } from './hooks/useApi';
import { useTheme } from './hooks/useTheme';
import { useWidgets } from './hooks/useWidgets';

function App() {
  const { theme, setTheme } = useTheme();
  const { categories, addCategory, deleteCategory, refresh: refreshCategories } = useCategories();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [managingId, setManagingId] = useState<number | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { feeds, addFeed, deleteFeed } = useFeeds(managingId);
  const { summary, loading, refreshing, error, loadCached, refresh } = useSummary(activeId, selectedDate);
  const { dates, refresh: refreshHistory } = useSummaryHistory(activeId);
  const { messages: chatMessages, sending: chatSending, sendMessage: chatSend } = useChat(summary?.id || null);
  const { briefing, loading: briefingLoading, error: briefingError, generate: generateBriefing } = useBriefing();
  const { weather, rates, headlines, crypto, hackerNews, releases, trending } = useWidgets();
  const { briefs: homepageBriefs, loading: homepageLoading, refreshing: homepageRefreshing, refresh: homepageRefresh } = useHomepage();

  const activeCategory = categories.find((c) => c.id === activeId);
  const managingCategory = categories.find((c) => c.id === managingId);

  const handleSelectCategory = (id: number) => {
    setActiveId(id);
    setShowBriefing(false);
    setSelectedDate(null);
  };

  const handleHome = () => {
    setActiveId(null);
    setShowBriefing(false);
    setSelectedDate(null);
  };

  const handleBriefing = () => {
    setShowBriefing(true);
    setActiveId(null);
    setSelectedDate(null);
  };

  const handleDeleteCategory = async (id: number) => {
    await deleteCategory(id);
    if (activeId === id) setActiveId(null);
  };

  const handleRefresh = async () => {
    await refresh();
    refreshHistory();
  };

  const handleCloseFeedManager = () => {
    setManagingId(null);
    refreshCategories();
  };

  return (
    <div className="min-h-screen bg-paper">
      <Header theme={theme} onThemeChange={setTheme} onShowStats={() => setShowStats(true)} />
      <CategoryNav
        categories={categories}
        activeId={activeId}
        showBriefing={showBriefing}
        onSelect={handleSelectCategory}
        onBriefing={handleBriefing}
        onAdd={addCategory}
        onDelete={handleDeleteCategory}
        onManageFeeds={setManagingId}
        onHome={handleHome}
      />

      {/* Newspaper Home: full-width grid when no category selected */}
      {!activeCategory && !showBriefing ? (
        <div className="max-w-[1600px] mx-auto px-4 pb-12">
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
            releases={releases || []}
          />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 pb-20 flex gap-8">
          {/* Left sidebar */}
          <LeftSidebar
            hackerNews={hackerNews}
            releases={releases || []}
            dates={dates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
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
                onLoad={loadCached}
                onRefresh={handleRefresh}
                onManageFeeds={() => setManagingId(activeCategory.id)}
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
          onClose={handleCloseFeedManager}
        />
      )}

      {showStats && <LlmStatsModal onClose={() => setShowStats(false)} />}
    </div>
  );
}

export default App;
