import { useOutletContext } from 'react-router-dom';
import { ReleasesPage } from '../ReleasesPage';
import type { AppOutletContext } from '../../types/routing';

export function ReleasesRoute() {
  const { releases } = useOutletContext<AppOutletContext>();

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12 view-fade">
      <ReleasesPage releases={releases || []} />
    </div>
  );
}
