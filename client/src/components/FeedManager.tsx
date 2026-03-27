import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Rss, FileText, Globe, Search } from 'lucide-react';
import { API_BASE } from '../config';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Skeleton } from './ui/skeleton';
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
  const [tab, setTab] = useState('sources');
  const [prompt, setPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [language, setLanguage] = useState('English');
  const [langSaved, setLangSaved] = useState(false);
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<{ title: string; url: string }[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [open, setOpen] = useState(true);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discoverAbortRef = useRef<AbortController | null>(null);
  const handleClose = useCallback(() => {
    setOpen(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
      if (langTimerRef.current) clearTimeout(langTimerRef.current);
      if (discoverAbortRef.current) discoverAbortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/categories/${categoryId}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        setPrompt(data.custom_prompt || '');
        setLanguage(data.language || 'English');
      })
      .catch(() => {});
    return () => controller.abort();
  }, [categoryId]);

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    await onAdd(name.trim(), url.trim());
    setName('');
    setUrl('');
  };

  const handleSavePrompt = async () => {
    try {
      await fetch(`${API_BASE}/categories/${categoryId}/prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      setPromptSaved(true);
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
      promptTimerRef.current = setTimeout(() => setPromptSaved(false), 2000);
    } catch {
      // silent
    }
  };

  const handleSaveLanguage = async (lang: string) => {
    setLanguage(lang);
    try {
      await fetch(`${API_BASE}/categories/${categoryId}/language`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
      setLangSaved(true);
      if (langTimerRef.current) clearTimeout(langTimerRef.current);
      langTimerRef.current = setTimeout(() => setLangSaved(false), 2000);
    } catch {
      // silent
    }
  };

  const handleDiscover = async () => {
    if (!discoverUrl.trim()) return;
    if (discoverAbortRef.current) discoverAbortRef.current.abort();
    const controller = new AbortController();
    discoverAbortRef.current = controller;
    setDiscovering(true);
    setHasSearched(false);
    try {
      const res = await fetch(`${API_BASE}/discover-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: discoverUrl.trim() }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) return;
      const data = await res.json();
      setDiscovered(data.feeds || []);
    } catch {
      if (discoverAbortRef.current?.signal.aborted) return;
    } finally {
      if (!controller.signal.aborted) {
        setDiscovering(false);
        setHasSearched(true);
      }
    }
  };

  const handleAddDiscovered = async (feed: { title: string; url: string }) => {
    try {
      await onAdd(feed.title, feed.url);
      setDiscovered((prev) => prev.filter((f) => f.url !== feed.url));
    } catch {
      // keep feed in discovered list on failure
    }
  };

  const tabContent = (
    <>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start rounded-none bg-transparent p-0 border-b border-rule h-auto">
          {(
            [
              { key: 'sources', label: 'Sources', icon: Rss },
              { key: 'discover', label: 'Discover', icon: Search },
              { key: 'prompt', label: 'Prompt', icon: FileText },
              { key: 'language', label: 'Language', icon: Globe },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-masthead data-[state=active]:bg-transparent data-[state=active]:shadow-none font-serif font-semibold text-[13px] py-2.5 px-2 gap-2"
            >
              <Icon size={13} /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="sources" className="mt-0">
            <div className="md:max-h-64 overflow-y-auto p-4 space-y-1">
              {feeds.length === 0 && (
                <div className="text-center py-8 text-ink-muted">
                  <Rss size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-light">No sources yet</p>
                </div>
              )}
              {feeds.map((feed) => (
                <div key={feed.id} className="flex items-center gap-3 px-3 py-2.5 group border-b border-rule last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{feed.name}</p>
                    <p className="text-[11px] text-ink-muted truncate">{feed.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(feed.id)}
                    aria-label={`Delete ${feed.name}`}
                    className="h-7 w-7 text-ink-muted hover:text-accent md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
            <div className="px-4 py-4 border-t border-rule space-y-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Source name"
              />
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="RSS feed URL"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleAdd}
                  disabled={!name.trim() || !url.trim()}
                >
                  <Plus size={12} /> Add
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="discover" className="mt-0">
            <div className="p-4 space-y-3">
              <p className="text-xs text-ink-muted leading-relaxed">
                Paste any website URL to auto-discover RSS feeds.
              </p>
              <div className="flex gap-2">
                <Input
                  value={discoverUrl}
                  onChange={(e) => setDiscoverUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                  placeholder="https://example.com"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleDiscover}
                  disabled={!discoverUrl.trim() || discovering}
                >
                  {discovering ? 'Searching...' : 'Discover'}
                </Button>
              </div>
              {discovering && (
                <div className="py-4 space-y-2">
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-2/3 h-10" />
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
                        <p className="text-sm font-medium truncate">{feed.title}</p>
                        <p className="text-[11px] text-ink-muted truncate">{feed.url}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddDiscovered(feed)}
                      >
                        <Plus size={10} /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {hasSearched && !discovering && discovered.length === 0 && (
                <p className="text-xs text-ink-muted text-center py-2">No feeds discovered yet.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="mt-0">
            <div className="p-4 space-y-3">
              <p className="text-xs text-ink-muted leading-relaxed">
                Add custom instructions that will be sent alongside the default summarization prompt.
              </p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="e.g. Focus on economic implications and write in a formal tone..."
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-ink-muted">
                  {prompt.length > 0 ? `${prompt.length} characters` : 'No custom prompt set'}
                </p>
                <Button variant="outline" onClick={handleSavePrompt}>
                  {promptSaved ? 'Saved' : 'Save Prompt'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="language" className="mt-0">
            <div className="p-4 space-y-3">
              <p className="text-xs text-ink-muted leading-relaxed">
                Choose the language for AI-generated summaries in this category.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {LANGUAGES.map((lang) => (
                  <Button
                    key={lang}
                    variant={language === lang ? 'default' : 'outline'}
                    onClick={() => handleSaveLanguage(lang)}
                    className={`px-3 py-2 text-[13px] font-serif text-left cursor-pointer transition-all duration-150 h-auto ${
                      language === lang
                        ? 'border-masthead bg-masthead/10 text-masthead font-semibold'
                        : 'border-rule text-ink-muted hover:text-ink hover:border-ink/30'
                    }`}
                  >
                    {lang}
                  </Button>
                ))}
              </div>
              {langSaved && (
                <p className="text-[11px] text-masthead font-medium">
                  Language saved. Refresh the summary to see the change.
                </p>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-lg p-0 gap-0 max-h-[85vh] flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-rule shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Settings</DialogTitle>
                <p className="text-xs text-ink-muted mt-0.5">{categoryName}</p>
              </div>
            </div>
          </DialogHeader>
          {tabContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent side="bottom" className="h-full p-0 gap-0 flex flex-col rounded-none border-0">
        <SheetHeader className="px-6 py-4 border-b border-rule shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Settings</SheetTitle>
              <p className="text-xs text-ink-muted mt-0.5">{categoryName}</p>
            </div>
          </div>
        </SheetHeader>
        {tabContent}
      </SheetContent>
    </Sheet>
  );
}
