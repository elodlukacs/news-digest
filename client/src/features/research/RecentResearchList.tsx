import { X } from 'lucide-react';

import { timeAgo } from '@/utils/date';
import type { RecentResearch } from '@/types';

interface RecentResearchListProps {
  items: RecentResearch[];
  onOpen: (id: number) => void;
  onRemove: (id: number) => void;
}

export function RecentResearchList({ items, onOpen, onRemove }: RecentResearchListProps) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-research-heading" className="mt-14">
      <h2 id="recent-research-heading" className="font-[family-name:var(--font-widget)] text-[13px] font-semibold text-ink-light mb-3">
        Recently researched
      </h2>
      <ul className="divide-y divide-rule/70 border-y border-rule/70">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="flex-1 min-w-0 text-left py-3 cursor-pointer focus-visible:outline-none focus-visible:bg-paper-dark rounded-sm"
            >
              <span className="block font-serif text-[16px] text-ink group-hover:text-masthead transition-colors truncate">
                {item.topic}
              </span>
              <span className="block mt-0.5 font-[family-name:var(--font-widget)] text-[13px] text-ink-muted truncate">
                {item.headline}
              </span>
            </button>
            <span className="shrink-0 font-[family-name:var(--font-widget)] text-[12px] text-ink-muted tabular-nums">
              {timeAgo(item.created_at)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove “${item.topic}” from recent research`}
              className="shrink-0 p-1.5 rounded-md text-ink-muted/60 hover:text-ink hover:bg-paper-dark sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-masthead"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
