import { ScientistPanel } from './ScientistPanel';
import { BridgePanel } from './BridgePanel';
import { StressDiagnostic } from './StressDiagnostic';
import { TabHeader } from '../common';
import { Microscope, Activity } from 'lucide-react';
import { useState } from 'react';

export function ReflectionTab() {
  const [stressDiagOpen, setStressDiagOpen] = useState(false);

  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Microscope size={24} className="text-masthead md:!w-7 md:!h-7" />}
        title="Reflection Suite"
        description="Examine your beliefs and thinking patterns. Use adversarial deliberation, bridge-building, and self-awareness tools."
      />

      {/* Stress Diagnostic — modal trigger banner */}
      <div className="rounded-lg border border-outrage/30 bg-outrage/5 p-3 md:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-outrage shrink-0" />
            <div>
              <h3 className="text-[13px] font-serif font-bold text-ink">Pre-Reading Stress Check</h3>
              <p className="text-[13px] text-ink-muted">Evaluate your cognitive state before consuming news</p>
            </div>
          </div>
          <button
            onClick={() => setStressDiagOpen(true)}
            className="px-4 py-2 bg-outrage text-white rounded hover:bg-outrage/90 transition-colors text-[12px] font-medium cursor-pointer whitespace-nowrap sm:self-center"
          >
            Start Check
          </button>
        </div>
      </div>

      <ScientistPanel />
      <BridgePanel />

      <StressDiagnostic open={stressDiagOpen} onOpenChange={setStressDiagOpen} />
    </div>
  );
}
