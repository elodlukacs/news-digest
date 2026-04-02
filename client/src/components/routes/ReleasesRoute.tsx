import { ReleasesPage } from '../ReleasesPage';
import { useWidgets } from '../../hooks/useWidgets';

export function ReleasesRoute() {
  const { releases } = useWidgets();

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12">
      <ReleasesPage releases={releases || []} />
    </div>
  );
}
