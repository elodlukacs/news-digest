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
  // Tagged with its category: this component is not remounted when
  // :categoryName changes, and a snapshot id from the previous category was
  // sent as summary_id for the new one — which returned nothing and offered a
  // paid "Generate summary" instead.
  const [snapshot, setSnapshot] = useState<{ categoryId: number; id: number } | null>(null);
  const [selectedLens, setSelectedLens] = useState<PromptLens | null>(null);

  const category = ctx.categories.find((c) => slugify(c.name) === categoryName);

  const categoryId = category?.id ?? 0;
  const selectedSnapshotId = snapshot?.categoryId === categoryId ? snapshot.id : null;
  const setSelectedSnapshotId = useCallback(
    (id: number | null) => setSnapshot(id === null ? null : { categoryId, id }),
    [categoryId],
  );
  const { summary, loading, refreshing, error, errorStatus, refresh, loadLatest } = useSummary(categoryId, selectedSnapshotId, ctx.selectedLlm);
  const { dates, refresh: refreshHistory } = useSummaryHistory(categoryId);
  const lens = useLens(categoryId, ctx.selectedLlm);

  const handleRefresh = useCallback(async (keyword?: string) => {
    const result = await refresh(keyword);
    if (!result) return;
    // Point the archive at the new entry; leaving an older snapshot selected
    // kept it highlighted, and clicking it again did nothing.
    if (selectedSnapshotId !== null) setSelectedSnapshotId(result.id ?? null);
    refreshHistory();
  }, [refresh, refreshHistory, selectedSnapshotId, setSelectedSnapshotId]);

  const handleClearFilter = useCallback(() => {
    if (selectedSnapshotId !== null) setSelectedSnapshotId(null);
    else loadLatest();
  }, [selectedSnapshotId, setSelectedSnapshotId, loadLatest]);

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
            key={category.id}
            categoryName={category.name}
            summary={summary}
            loading={loading}
            refreshing={refreshing}
            error={error}
            errorStatus={errorStatus}
            onRefresh={handleRefresh}
            onClearFilter={handleClearFilter}
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
