import { useOutletContext } from 'react-router-dom';
import { MorningBriefing } from '../MorningBriefing';
import { useBriefing } from '../../hooks/useApi';
import { useWidgets } from '../../hooks/useWidgets';
import { WeirdFactCard } from '../WeirdFactCard';
import { OnThisDayCard } from '../OnThisDayCard';
import type { AppOutletContext } from '../../types/routing';

export function BriefingRoute() {
  const ctx = useOutletContext<AppOutletContext>();
  const { briefing, loading: briefingLoading, error: briefingError, generate: generateBriefing } = useBriefing(ctx.selectedLlm);
  const { weirdFact, onThisDay } = useWidgets();

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-20 flex gap-8">
      <aside className="w-44 shrink-0 hidden lg:block pt-8" />

      <main className="flex-1 min-w-0">
        <MorningBriefing
          briefing={briefing}
          loading={briefingLoading}
          error={briefingError}
          onGenerate={generateBriefing}
        />
      </main>

      <aside className="w-72 shrink-0 hidden lg:block pt-8 font-widget">
        <div className="sticky top-8 space-y-5">
          <WeirdFactCard weirdFact={weirdFact} />
          <OnThisDayCard events={onThisDay} />
        </div>
      </aside>
    </div>
  );
}
