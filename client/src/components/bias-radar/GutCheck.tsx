import { useState } from 'react';
import type { GutCheckReaction } from '../../types/lens';

const OPTIONS: { value: GutCheckReaction; label: string; emoji: string }[] = [
  { value: 'outraged', label: 'Outraged', emoji: '😡' },
  { value: 'skeptical', label: 'Skeptical', emoji: '🤨' },
  { value: 'interested', label: 'Interested', emoji: '🤔' },
  { value: 'bored', label: 'Bored', emoji: '😐' },
];

interface GutCheckProps {
  onComplete: (reaction: GutCheckReaction) => void;
}

export default function GutCheck({ onComplete }: GutCheckProps) {
  const [selected, setSelected] = useState<GutCheckReaction | null>(null);

  function handleSelect(value: GutCheckReaction) {
    if (selected) return;
    setSelected(value);
    onComplete(value);
  }

  return (
    <div className="px-5 py-4 bg-paper-dark rounded-lg mx-4 mt-4">
      <p className="text-sm text-ink-muted mb-3">
        Before we dig in — what was your gut reaction to this headline?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-all ${
              selected === opt.value
                ? 'border-ink bg-ink text-paper'
                : 'border-rule bg-paper text-ink hover:border-ink-muted'
            }`}
          >
            <span>{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-xs text-ink-muted mt-2">Got it. Loading other perspectives...</p>
      )}
    </div>
  );
}
