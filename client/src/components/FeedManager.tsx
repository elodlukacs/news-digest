import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Rss, FileText, Globe, Search } from 'lucide-react';
import type { Feed } from '../types';

const LANGUAGES = [
  'English', 'Hungarian', 'Romanian', 'German', 'French',
  'Spanish', 'Italian', 'Portuguese', 'Dutch', 'Polish',
  'Czech', 'Slovak', 'Croatian', 'Serbian', 'Bulgarian',
  'Ukrainian', 'Russian', 'Turkish', 'Arabic', 'Chinese',
  'Japanese', 'Korean',
];

interface Props {
  categoryId: number;
  categoryName: string;
  feeds: Feed[];
  onAdd: (name: string, url: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
}

export function FeedManager({ categoryId, categoryName, feeds, onAdd, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [tab, setTab] = useState<'sources' | 'prompt' | 'language' | 'discover'>('sources');
  const [prompt, setPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [language, setLanguage] = useState('English');
  const [langSaved, setLangSaved] = useState(false);
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<{ title: string; url: string }[]>([]);

  useEffect(() => {
    fetch(`/api/categories/${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        setPrompt(data.custom_prompt || '');
        setLanguage(data.language || 'English');
      })
      .catch(() => {});
  }, [categoryId]);

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    await onAdd(name.trim(), url.trim());
    setName('');
    setUrl('');
  };

  const handleSavePrompt = async () => {
    await fetch(`/api/categories/${categoryId}/prompt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const handleSaveLanguage = async (lang: string) => {
    setLanguage(lang);
    await fetch(`/api/categories/${categoryId}/language`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang }),
    });
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
  };

  const handleDiscover = async () => {
    if (!discoverUrl.trim()) return;
    setDiscovering(true);
    setDiscovered([]);
    try {
      const res = await fetch('/api/discover-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: discoverUrl.trim() }),
      });
      const data = await res.json();
      setDiscovered(data.feeds || []);
    } catch {} finally {
      setDiscovering(false);
    }
  };

  const handleAddDiscovered = async (feed: { title: string; url: string }) => {
    await onAdd(feed.title, feed.url);
    setDiscovered((prev) => prev.filter((f) => f.url !== feed.url));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-paper border border-rule shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
          <div>
            <h3 className="font-serif text-lg font-bold text-ink">Settings</h3>
            <p className="text-xs text-ink-muted mt-0.5">{categoryName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-rule">
          {(
            [
              { key: 'sources', label: 'Sources', icon: Rss },
              { key: 'discover', label: 'Discover', icon: Search },
              { key: 'prompt', label: 'Prompt', icon: FileText },
              { key: 'language', label: 'Language', icon: Globe },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-[13px] font-serif font-semibold cursor-pointer transition-all flex items-center justify-center gap-2
                ${tab === key ? 'text-masthead border-b-2 border-masthead' : 'text-ink-muted hover:text-ink'}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {tab === 'sources' && (
          <>
            <div className="max-h-64 overflow-y-auto p-4 space-y-1">
              {feeds.length === 0 && (
                <div className="text-center py-8 text-ink-muted">
                  <Rss size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-light">No sources yet</p>
                </div>
              )}
              {feeds.map((feed) => (
                <div key={feed.id} className="flex items-center gap-3 px-3 py-2.5 group border-b border-rule-light last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{feed.name}</p>
                    <p className="text-[11px] text-ink-muted truncate">{feed.url}</p>
                  </div>
                  <button
                    onClick={() => onDelete(feed.id)}
                    className="p-1 text-ink-muted hover:text-accent cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 py-4 border-t border-rule space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Source name"
                className="w-full px-3 py-2 text-sm border border-rule bg-transparent text-ink placeholder-ink-muted focus:outline-none focus:border-ink"
              />
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="RSS feed URL"
                  className="flex-1 px-3 py-2 text-sm border border-rule bg-transparent text-ink placeholder-ink-muted focus:outline-none focus:border-ink"
                />
                <button
                  onClick={handleAdd}
                  disabled={!name.trim() || !url.trim()}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-medium border border-ink text-ink hover:bg-ink hover:text-paper cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'discover' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-ink-muted leading-relaxed">
              Paste any website URL to auto-discover RSS feeds.
            </p>
            <div className="flex gap-2">
              <input
                value={discoverUrl}
                onChange={(e) => setDiscoverUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                placeholder="https://example.com"
                className="flex-1 px-3 py-2 text-sm border border-rule bg-transparent text-ink placeholder-ink-muted focus:outline-none focus:border-ink"
              />
              <button
                onClick={handleDiscover}
                disabled={!discoverUrl.trim() || discovering}
                className="px-4 py-2 text-xs uppercase tracking-wider font-medium border border-ink text-ink hover:bg-ink hover:text-paper cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {discovering ? 'Searching...' : 'Discover'}
              </button>
            </div>
            {discovering && (
              <div className="py-4 text-center">
                <div className="inline-block w-4 h-4 border border-ink border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {discovered.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-muted">
                  Found {discovered.length} feed(s)
                </p>
                {discovered.map((feed) => (
                  <div key={feed.url} className="flex items-center gap-3 px-3 py-2.5 border border-rule">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{feed.title}</p>
                      <p className="text-[11px] text-ink-muted truncate">{feed.url}</p>
                    </div>
                    <button
                      onClick={() => handleAddDiscovered(feed)}
                      className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-medium border border-ink text-ink hover:bg-ink hover:text-paper cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Plus size={10} /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!discovering && discovered.length === 0 && discoverUrl.trim() && (
              <p className="text-xs text-ink-muted text-center py-2">No feeds discovered yet.</p>
            )}
          </div>
        )}

        {tab === 'prompt' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-ink-muted leading-relaxed">
              Add custom instructions that will be sent alongside the default summarization prompt.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="e.g. Focus on economic implications and write in a formal tone..."
              className="w-full px-3 py-2.5 text-sm border border-rule bg-transparent text-ink placeholder-ink-muted focus:outline-none focus:border-ink resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-ink-muted">
                {prompt.length > 0 ? `${prompt.length} characters` : 'No custom prompt set'}
              </p>
              <button
                onClick={handleSavePrompt}
                className="px-4 py-2 text-xs uppercase tracking-wider font-medium border border-ink text-ink hover:bg-ink hover:text-paper cursor-pointer transition-all flex items-center gap-1.5"
              >
                {promptSaved ? 'Saved' : 'Save Prompt'}
              </button>
            </div>
          </div>
        )}

        {tab === 'language' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-ink-muted leading-relaxed">
              Choose the language for AI-generated summaries in this category.
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleSaveLanguage(lang)}
                  className={`px-3 py-2 text-[13px] font-serif text-left cursor-pointer transition-all duration-150 border
                    ${
                      language === lang
                        ? 'border-masthead bg-masthead/10 text-masthead font-semibold'
                        : 'border-rule text-ink-muted hover:text-ink hover:border-ink/30'
                    }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            {langSaved && (
              <p className="text-[11px] text-masthead font-medium">
                Language saved. Refresh the summary to see the change.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
