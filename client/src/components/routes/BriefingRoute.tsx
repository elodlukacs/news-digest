import { useOutletContext } from 'react-router-dom';
import { MorningBriefing } from '../MorningBriefing';
import { LeftSidebar } from '../LeftSidebar';
import { WidgetSidebar } from '../WidgetSidebar';
import { useBriefing } from '../../hooks/useApi';
import { useWidgets } from '../../hooks/useWidgets';
import type { AppOutletContext } from '../../types/routing';

export function BriefingRoute() {
  const ctx = useOutletContext<AppOutletContext>();
  const { briefing, loading: briefingLoading, error: briefingError, generate: generateBriefing } = useBriefing(ctx.selectedLlm);
  const { weather, rates, headlines, crypto, trending } = useWidgets();

  return (
    <div className="max-w-7xl mx-auto px-6 pb-20 flex gap-8">
      <LeftSidebar
        dates={[]}
        selectedSnapshotId={null}
        onSelectSnapshot={() => {}}
        showHistory={false}
      />

      <main className="flex-1 min-w-0">
        <MorningBriefing
          briefing={briefing}
          loading={briefingLoading}
          error={briefingError}
          onGenerate={generateBriefing}
        />
      </main>

      <WidgetSidebar
        weather={weather}
        rates={rates}
        headlines={headlines}
        crypto={crypto}
        trending={trending}
      />
    </div>
  );
}
