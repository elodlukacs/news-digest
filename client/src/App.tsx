import { useState } from 'react';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { SummaryView } from './components/SummaryView';
import { FeedManager } from './components/FeedManager';
import { WidgetSidebar } from './components/WidgetSidebar';
import { LeftSidebar } from './components/LeftSidebar';
import { MorningBriefing } from './components/MorningBriefing';
import { LlmStatsModal } from './components/LlmStatsModal';
import { useCategories, useFeeds, useSummary, useSummaryHistory, useChat, useBriefing } from './hooks/useApi';
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

  const activeCategory = categories.find((c) => c.id === activeId);
  const managingCategory = categories.find((c) => c.id === managingId);

  const handleSelectCategory = (id: number) => {
    setActiveId(id);
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
      />

      <div className="max-w-7xl mx-auto px-6 pb-20 flex gap-8">
        {/* Left sidebar */}
        <LeftSidebar
          hackerNews={hackerNews}
          releases={releases}
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
              chatMessages={chatMessages}
              chatSending={chatSending}
              onChatSend={chatSend}
            />
          ) : (
            <div className="py-32 text-center">
              <p className="font-serif text-3xl text-ink-muted italic">Select a category to read</p>
            </div>
          )}
        </main>

        {/* Right sidebar: Widgets */}
        <WidgetSidebar weather={weather} rates={rates} headlines={headlines} crypto={crypto} trending={trending} />
      </div>

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
