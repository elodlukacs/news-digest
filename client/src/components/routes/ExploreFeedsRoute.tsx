import { useOutletContext } from 'react-router-dom';
import { ExploreFeedsPage } from '../ExploreFeedsPage';
import { useExploreFeeds } from '../../hooks/useApi';
import type { AppOutletContext } from '../../types/routing';

export function ExploreFeedsRoute() {
  const ctx = useOutletContext<AppOutletContext>();
  const explore = useExploreFeeds();

  return (
    <ExploreFeedsPage
      catalog={explore.catalog}
      loading={explore.loading}
      error={explore.error}
      categories={ctx.categories}
      subscribe={explore.subscribe}
      addCategory={ctx.addCategory}
      refresh={explore.refresh}
      discoverFromUrl={explore.discoverFromUrl}
    />
  );
}
