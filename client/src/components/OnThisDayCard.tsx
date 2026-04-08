import { CalendarDays } from 'lucide-react';
import { WidgetHeader } from './SharedWidgets';
import type { OnThisDayEvent } from '../types';

export function OnThisDayCard({ events }: { events: OnThisDayEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section>
      <WidgetHeader title="On This Day" />
      <div className="px-4 py-3 space-y-3">
        {events.map((event, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <CalendarDays size={14} className="text-masthead shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-masthead tracking-wider">{event.year}</p>
              <p className="text-[12px] leading-snug text-ink">
                {event.link ? (
                  <a href={event.link} target="_blank" rel="noopener noreferrer" className="hover:text-ink-muted transition-colors cursor-pointer">
                    {event.text}
                  </a>
                ) : event.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
