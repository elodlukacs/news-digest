import { useState } from 'react';
import type { TechniqueName } from '../../types/lens';

interface TechniqueOption {
  value: TechniqueName;
  label: string;
  hint: string;
}

const TECHNIQUE_OPTIONS: TechniqueOption[] = [
  { value: 'fear-mongering', label: 'Fear-Mongering', hint: 'Exaggerates danger to provoke anxiety' },
  { value: 'outrage-bait', label: 'Outrage Bait', hint: 'Designed to make you angry and share' },
  { value: 'false-urgency', label: 'False Urgency', hint: 'Creates artificial time pressure' },
  { value: 'us-vs-them', label: 'Us vs. Them', hint: 'Casts story as in-group vs out-group' },
  { value: 'tribal-signaling', label: 'Tribal Signaling', hint: 'Coded language for group membership' },
  { value: 'vague-attribution', label: 'Vague Attribution', hint: 'Sources say..., Experts warn...' },
  { value: 'false-dichotomy', label: 'False Dichotomy', hint: 'Presents only two options' },
  { value: 'anecdote-as-trend', label: 'Anecdote as Trend', hint: 'One story used to imply a pattern' },
  { value: 'framing-by-omission', label: 'Framing by Omission', hint: 'True facts, missing context' },
  { value: 'headline-body-mismatch', label: 'Headline Mismatch', hint: 'Headline claims more than article' },
  { value: 'source-laundering', label: 'Source Laundering', hint: 'Chained secondary citations' },
  { value: 'none', label: 'None — Clean Article', hint: 'Straightforward, neutral reporting' },
];

interface TechniquePickerProps {
  onSelect: (technique: TechniqueName) => void;
}

export default function TechniquePicker({ onSelect }: TechniquePickerProps) {
  const [selected, setSelected] = useState<TechniqueName | null>(null);
  const [showHints, setShowHints] = useState(false);

  function handleSubmit() {
    if (!selected) return;
    onSelect(selected);
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-sm font-medium text-blue-800 mb-0.5">Your turn first</p>
        <p className="text-xs text-blue-600">
          Guess the technique before seeing the analysis.
        </p>
      </div>

      <button
        onClick={() => setShowHints(!showHints)}
        className="text-xs text-ink-muted underline"
      >
        {showHints ? 'Hide hints' : 'Show technique hints'}
      </button>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {TECHNIQUE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
              selected === opt.value
                ? 'border-ink bg-ink text-paper'
                : 'border-rule bg-paper text-ink hover:border-ink-muted'
            }`}
          >
            <span className="text-sm font-medium">{opt.label}</span>
            {showHints && (
              <span
                className={`block text-xs mt-0.5 ${
                  selected === opt.value ? 'text-gray-300' : 'text-ink-muted'
                }`}
              >
                {opt.hint}
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selected}
        className="w-full rounded-lg bg-ink py-3 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Lock in my guess →
      </button>
    </div>
  );
}