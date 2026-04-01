import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { SummaryView } from '../SummaryView';
import { LeftSidebar } from '../LeftSidebar';
import { ForensicPanel } from '../../features/mindgames/analysis';
import { useSummary, useSummaryHistory, useChat } from '../../hooks/useApi';
import { slugify } from '../../utils/slugify';
import type { AppOutletContext } from '../../types/routing';

export function CategoryRoute() {
  const { categoryName } = useParams<{ categoryName: string }>();
  const ctx = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);

  const category = ctx.categories.find((c) => slugify(c.name) === categoryName);

  const categoryId = category?.id ?? 0;
  const { summary, loading, refreshing, error, refresh } = useSummary(categoryId, selectedSnapshotId, ctx.selectedLlm);
  const { dates, refresh: refreshHistory } = useSummaryHistory(categoryId);
  const { messages: chatMessages, sending: chatSending, sendMessage: chatSend } = useChat(summary?.id || null, ctx.selectedLlm);

  const handleRefresh = useCallback(async () => {
    await refresh();
    refreshHistory();
  }, [refresh, refreshHistory]);

  const handleDelete = useCallback(async () => {
    await ctx.deleteCategory(categoryId);
    navigate('/');
  }, [ctx, categoryId, navigate]);

  return (
    <div className="max-w-[1920px] mx-auto px-6 pb-20 flex flex-col lg:flex-row gap-8">
      <LeftSidebar
        dates={dates}
        selectedSnapshotId={selectedSnapshotId}
        onSelectSnapshot={setSelectedSnapshotId}
        showHistory={!!category}
      />

      <main className="flex-1 min-w-0">
        {category ? (
          <SummaryView
            categoryId={category.id}
            categoryName={category.name}
            summary={summary}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={handleRefresh}
            onManageFeeds={() => ctx.onManageFeeds(category.id)}
            onDelete={handleDelete}
            chatMessages={chatMessages}
            chatSending={chatSending}
            onChatSend={chatSend}
          />
        ) : (
          <div className="py-24 text-center">
            <p className="font-serif text-xl text-ink-muted italic">Category not found</p>
          </div>
        )}
      </main>

      <aside className="hidden md:block lg:w-[42rem] lg:shrink-0 lg:pt-8 pt-0">
        <div className="sticky top-8">
          <ForensicPanel />
        </div>
      </aside>
    </div>
  );
}
