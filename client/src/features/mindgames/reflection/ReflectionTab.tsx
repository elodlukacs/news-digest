import { ScientistPanel } from './ScientistPanel';
import { BridgePanel } from './BridgePanel';
import { BiasMirrorPanel } from './BiasMirrorPanel';
import { EchoChamberSimulator } from './EchoChamberSimulator';
import { StressDiagnostic } from './StressDiagnostic';
import { TabHeader } from '../common';
import { Microscope, Activity } from 'lucide-react';
import { useState } from 'react';

export function ReflectionTab() {
  const [stressDiagOpen, setStressDiagOpen] = useState(false);

  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Microscope size={26} className="text-observation md:!w-8 md:!h-8" />}
        title="Think Harder"
        description="Debate your own beliefs, find common ground between opposing views, and check whether you're stuck in an echo chamber."
      />

      {/* Pre-reading check banner */}
      <div className="rounded-xl border border-rule bg-paper-dark p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity size={22} className="text-outrage shrink-0" />
            <div>
              <h3 className="text-base font-serif font-bold text-ink">How sharp is your guard today?</h3>
              <p className="text-sm text-ink-muted">A quick check before you read — stress and tiredness affect how you process news.</p>
            </div>
          </div>
          <button
            onClick={() => setStressDiagOpen(true)}
            className="px-5 py-2.5 bg-ink text-paper rounded-lg hover:bg-ink/90 transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap sm:self-center"
          >
            Take the Check
          </button>
        </div>
      </div>

      <BiasMirrorPanel />
      <EchoChamberSimulator />
      <ScientistPanel />
      <BridgePanel />

      <StressDiagnostic open={stressDiagOpen} onOpenChange={setStressDiagOpen} />
    </div>
  );
}
