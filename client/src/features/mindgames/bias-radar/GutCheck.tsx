import { useState } from 'react';
import { Slider } from '../../../components/ui/slider';
import type { GutCheckReaction, EmotionalResponse } from '../../../types/lens';

const OPTIONS: { value: GutCheckReaction; label: string; emoji: string }[] = [
  { value: 'outraged', label: 'Outraged', emoji: '😡' },
  { value: 'skeptical', label: 'Skeptical', emoji: '🤨' },
  { value: 'interested', label: 'Interested', emoji: '🤔' },
  { value: 'bored', label: 'Bored', emoji: '😐' },
];

interface GutCheckProps {
  onComplete: (reaction: GutCheckReaction) => void;
  onEmotionalResponse?: (response: EmotionalResponse) => void;
}

export default function GutCheck({ onComplete, onEmotionalResponse }: GutCheckProps) {
  const [selected, setSelected] = useState<GutCheckReaction | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [valence, setValence] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  function handleSelect(value: GutCheckReaction) {
    if (submitted) return;
    setSelected(value);
    onComplete(value);

    if (onEmotionalResponse) {
      setSubmitted(false);
    } else {
      setSubmitted(true);
    }
  }

  function handleSubmitIntensity() {
    if (!selected || submitted) return;
    setSubmitted(true);
    onEmotionalResponse?.({ intensity, valence, reaction: selected });
  }

  const valenceLabel = valence < -0.3 ? 'Negative' : valence > 0.3 ? 'Positive' : 'Neutral';

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
            disabled={submitted}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-all cursor-pointer disabled:cursor-default ${
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

      {selected && onEmotionalResponse && !submitted && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex justify-between text-xs text-ink-muted mb-1.5">
              <span>Emotional intensity</span>
              <span className="font-semibold text-ink">{intensity}/10</span>
            </div>
            <Slider
              value={[intensity]}
              onValueChange={([v]) => setIntensity(v)}
              min={1}
              max={10}
              step={1}
            />
            <div className="flex justify-between text-[10px] text-ink-muted/60 mt-0.5">
              <span>Calm</span>
              <span>Intense</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-ink-muted mb-1.5">
              <span>Emotional valence</span>
              <span className="font-semibold text-ink">{valenceLabel}</span>
            </div>
            <Slider
              value={[valence]}
              onValueChange={([v]) => setValence(Math.round(v * 10) / 10)}
              min={-1}
              max={1}
              step={0.1}
            />
            <div className="flex justify-between text-[10px] text-ink-muted/60 mt-0.5">
              <span>Negative</span>
              <span>Neutral</span>
              <span>Positive</span>
            </div>
          </div>

          <button
            onClick={handleSubmitIntensity}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-paper hover:bg-ink/90 transition-colors cursor-pointer"
          >
            Continue to analysis
          </button>
        </div>
      )}

      {submitted && (
        <p className="text-xs text-ink-muted mt-2">Got it. Loading analysis...</p>
      )}
    </div>
  );
}
