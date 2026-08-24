import { Sparkles } from 'lucide-react';
import { WidgetHeader } from './SharedWidgets';
import type { WeirdFactWidget } from '../types';
import { safeHref } from '../utils/safeHref';

export function WeirdFactCard({ weirdFact }: { weirdFact: WeirdFactWidget | null }) {
  if (!weirdFact) return null;
  return (
    <section>
      <WidgetHeader title="Weird Fact" />
      <a href={safeHref(weirdFact.link)} target="_blank" rel="noopener noreferrer" className="group block px-4 py-3 cursor-pointer">
        <div className="flex items-start gap-2.5">
          <Sparkles size={16} className="text-masthead shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] leading-snug text-ink group-hover:text-ink-muted transition-colors font-medium">
              {weirdFact.title}
            </p>
            <p className="text-[10px] text-ink-muted mt-1">{weirdFact.source}</p>
          </div>
        </div>
      </a>
    </section>
  );
}
