import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import { SummaryView } from '../SummaryView';
import { LeftSidebar } from '../LeftSidebar';
import { useSummary, useSummaryHistory, useLens } from '../../hooks/useApi';
import { slugify } from '../../utils/slugify';
import type { AppOutletContext } from '../../types/routing';
import type { PromptLens } from '../PromptLensSelector';

export function CategoryRoute() {
  const { categoryName } = useParams<{ categoryName: string }>();
  const ctx = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [selectedLens, setSelectedLens] = useState<PromptLens | null>(null);

  const category = ctx.categories.find((c) => slugify(c.name) === categoryName);

  const categoryId = category?.id ?? 0;
  const { summary, loading, refreshing, error, refresh, loadLatest } = useSummary(categoryId, selectedSnapshotId, ctx.selectedLlm);
  const { dates, refresh: refreshHistory } = useSummaryHistory(categoryId);
  const lens = useLens(categoryId, ctx.selectedLlm);

  const handleRefresh = useCallback(async (keyword?: string) => {
    await refresh(keyword);
    refreshHistory();
  }, [refresh, refreshHistory]);

  useEffect(() => {
    lens.clear();
    setSelectedLens(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const handleLensChange = useCallback((l: PromptLens | null) => {
    setSelectedLens(l);
    if (!l) lens.clear();
  }, [lens]);

  const handleRunLens = useCallback(() => {
    if (selectedLens) lens.run(selectedLens.slug);
  }, [lens, selectedLens]);

  const handleDelete = useCallback(async () => {
    await ctx.deleteCategory(categoryId);
    navigate('/');
  }, [ctx, categoryId, navigate]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-20 flex gap-8">
      <LeftSidebar
        dates={dates}
        selectedSnapshotId={selectedSnapshotId}
        onSelectSnapshot={setSelectedSnapshotId}
        showHistory={!!category}
      />

      <main className="flex-1 min-w-0">
        {category ? (
          <SummaryView
            categoryName={category.name}
            summary={summary}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={handleRefresh}
            onClearFilter={loadLatest}
            onManageFeeds={() => ctx.onManageFeeds(category.id)}
            onDelete={handleDelete}
            selectedLlm={ctx.selectedLlm}
            selectedLens={selectedLens}
            onLensChange={handleLensChange}
            onRunLens={handleRunLens}
            lensLoading={lens.loading}
            lensContent={lens.content}
            lensName={lens.lensName}
            lensError={lens.error}
            onDismissLens={lens.clear}
            articleFontSize={ctx.articleFontSize}
          />
        ) : (
          <div className="py-24 text-center">
            <p className="font-serif text-xl text-ink-muted italic">Category not found</p>
          </div>
        )}
      </main>
    </div>
  );
}
