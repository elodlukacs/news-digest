interface Mood {
  icon: string;
  label: string;
  category: string;
}

const MOODS: Mood[] = [
  { icon: '✨', label: 'Amaze me', category: 'Fascinating Corners' },
  { icon: '😄', label: 'Make me laugh', category: 'Fascinating Corners' },
  { icon: '🧠', label: 'Teach me something', category: 'Brain Food' },
  { icon: '😬', label: 'Disturb me gently', category: 'Disinfo Watch' },
];

interface Props {
  onSelectCategory: (name: string) => void;
  availableCategories: string[];
}

export function MoodPicker({ onSelectCategory, availableCategories }: Props) {
  const visible = MOODS.filter((m) => availableCategories.includes(m.category));
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-ink-muted uppercase tracking-wider font-medium shrink-0">Mood:</span>
      <div className="flex items-center gap-1.5">
        {visible.map((mood) => (
          <button
            key={mood.label}
            onClick={() => onSelectCategory(mood.category)}
            aria-label={`${mood.label}: ${mood.category}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium border border-rule rounded-sm bg-paper hover:bg-paper-dark hover:border-ink-muted transition-colors cursor-pointer"
          >
            <span>{mood.icon}</span>
            <span className="text-ink">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
