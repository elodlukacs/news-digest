import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

// The server does not report progress, so these follow its typical timing:
// planning takes a few seconds, the searches a few more, then the writing.
const STEPS = [
  { label: 'Working out what to look up', startsAt: 0 },
  { label: 'Reading news coverage and background from Wikipedia', startsAt: 3500 },
  { label: 'Writing the story', startsAt: 9000 },
];

export function ResearchProgress({ topic }: { topic: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(timer);
  }, []);

  const current = STEPS.reduce((idx, step, i) => (elapsed >= step.startsAt ? i : idx), 0);

  return (
    <div aria-live="polite" className="pt-10">
      <p className="font-serif text-[26px] sm:text-[32px] leading-tight font-bold text-ink tracking-[-0.01em] mb-6">
        {topic}
      </p>
      <ol className="space-y-2.5 font-[family-name:var(--font-widget)] text-[14px]">
        {STEPS.map((step, i) => (
          <li
            key={step.label}
            className={`flex items-center gap-2.5 ${i < current ? 'text-ink-muted' : i === current ? 'text-ink' : 'text-ink-muted/50'}`}
          >
            <span className="w-4 flex justify-center" aria-hidden>
              {i < current ? (
                <Check size={14} className="text-masthead" />
              ) : i === current ? (
                <span className="block w-2 h-2 rounded-full bg-masthead motion-safe:animate-pulse" />
              ) : (
                <span className="block w-1.5 h-1.5 rounded-full bg-ink-muted/40" />
              )}
            </span>
            {step.label}
            {i === current && <span className="sr-only">(in progress)</span>}
          </li>
        ))}
      </ol>
      <div className="mt-10 space-y-3 max-w-[760px]" aria-hidden>
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-11/12 h-4" />
        <Skeleton className="w-4/5 h-4" />
      </div>
    </div>
  );
}
