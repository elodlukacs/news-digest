import { useState } from 'react';
import { Search, LoaderCircle } from 'lucide-react';

interface ResearchSearchFormProps {
  onSubmit: (topic: string) => void;
  busy: boolean;
  initialTopic?: string;
  /** `hero` is the empty page's large field; `compact` sits above a result. */
  size: 'hero' | 'compact';
}

const MAX_TOPIC_LENGTH = 200;

export function ResearchSearchForm({ onSubmit, busy, initialTopic = '', size }: ResearchSearchFormProps) {
  const [topic, setTopic] = useState(initialTopic);
  const trimmed = topic.trim();
  const hero = size === 'hero';

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed.length >= 2 && !busy) onSubmit(trimmed);
      }}
      className={`group flex items-end gap-3 border-b-2 border-ink/80 focus-within:border-masthead transition-colors ${hero ? 'pb-2' : 'pb-1.5'}`}
    >
      <label htmlFor={`research-topic-${size}`} className="sr-only">
        Topic to research
      </label>
      <input
        id={`research-topic-${size}`}
        type="search"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        maxLength={MAX_TOPIC_LENGTH}
        autoFocus={hero}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={hero ? 'e.g. the global oil shock' : 'Research another topic'}
        className={`flex-1 min-w-0 bg-transparent text-ink placeholder:text-ink-muted/60 focus:outline-none font-serif ${
          hero ? 'text-[20px] sm:text-[24px] py-2' : 'text-[17px] py-1'
        } [&::-webkit-search-cancel-button]:hidden`}
      />
      <button
        type="submit"
        disabled={busy || trimmed.length < 2}
        className={`shrink-0 inline-flex items-center gap-2 rounded-md bg-masthead text-paper font-[family-name:var(--font-widget)] font-semibold transition-colors hover:bg-masthead/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
          hero ? 'mb-1.5 px-4 py-2.5 text-[14px]' : 'mb-1 px-3 py-1.5 text-[13px]'
        }`}
      >
        {busy ? <LoaderCircle size={hero ? 16 : 14} className="animate-spin" /> : <Search size={hero ? 16 : 14} />}
        Research
      </button>
    </form>
  );
}
