import { useMemo, useState } from 'react';
import { Compass, Search, Globe, Plus, Check, X, ExternalLink, Rss, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import type {
  Category,
  ExploreCatalog,
  ExploreFeed,
  ExploreTopic,
  DiscoveredFeed,
} from '../types';

interface Props {
  catalog: ExploreCatalog | null;
  loading: boolean;
  error: string | null;
  categories: Category[];
  subscribe: (categoryId: number, name: string, url: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
  discoverFromUrl: (url: string) => Promise<DiscoveredFeed[]>;
}

interface SubscribeTarget {
  title: string;
  url: string;
  source: 'catalog' | 'discover';
}

const ALL_TOPIC: ExploreTopic = {
  id: 'all',
  name: 'All Topics',
  description: 'Every feed in the catalogue',
};

export function ExploreFeedsPage({
  catalog,
  loading,
  error,
  categories,
  subscribe,
  addCategory,
  refresh,
  discoverFromUrl,
}: Props) {
  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState<string>('all');
  const [target, setTarget] = useState<SubscribeTarget | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);

  const topics = useMemo(() => catalog?.topics ?? [], [catalog]);
  const feeds = useMemo(() => catalog?.feeds ?? [], [catalog]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of feeds) map.set(f.topic, (map.get(f.topic) || 0) + 1);
    return map;
  }, [feeds]);

  const filteredFeeds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feeds.filter((f) => {
      if (topicId !== 'all' && f.topic !== topicId) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.site.toLowerCase().includes(q)
      );
    });
  }, [feeds, topicId, query]);

  const groupedByTopic = useMemo(() => {
    const groups = new Map<string, ExploreFeed[]>();
    for (const f of filteredFeeds) {
      const arr = groups.get(f.topic) || [];
      arr.push(f);
      groups.set(f.topic, arr);
    }
    return groups;
  }, [filteredFeeds]);

  const subscribedCount = useMemo(
    () => feeds.filter((f) => f.subscribed).length,
    [feeds]
  );

  const totalCount = feeds.length;

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12">
      <div className="pt-6 md:pt-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Compass size={28} className="text-masthead shrink-0" />
              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-black text-masthead leading-none">
                Explore Feeds
              </h1>
            </div>
            <p className="text-xs sm:text-[13px] text-ink-muted mt-2 font-[family-name:var(--font-body)]">
              {loading
                ? 'Loading catalogue…'
                : `${totalCount} curated RSS sources across ${topics.length} topics · ${subscribedCount} already in your sections`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiscoverOpen(true)}
              className="h-8 text-xs border-masthead/30 text-masthead hover:bg-masthead hover:text-white"
            >
              <Globe size={13} />
              <span>Add from URL</span>
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/60" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search feeds by name, description, or domain…"
              className="pl-9 h-10 bg-paper-dark/40 border-rule"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <TopicChip
              topic={ALL_TOPIC}
              active={topicId === 'all'}
              count={totalCount}
              onClick={() => setTopicId('all')}
            />
            {topics.map((t) => (
              <TopicChip
                key={t.id}
                topic={t}
                active={topicId === t.id}
                count={counts.get(t.id) || 0}
                onClick={() => setTopicId(t.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-accent shrink-0" />
          <span className="text-sm text-ink">{error}</span>
          <Button size="sm" variant="ghost" onClick={refresh} className="ml-auto h-7 text-xs">
            Retry
          </Button>
        </div>
      )}

      {loading && <FeedGridSkeleton />}

      {!loading && !error && filteredFeeds.length === 0 && (
        <div className="py-20 text-center">
          <Rss size={28} className="mx-auto text-ink-muted/40 mb-3" />
          <p className="text-sm text-ink-muted">No feeds match this search.</p>
          <p className="text-xs text-ink-muted/70 mt-1">Try a different topic or clear the search.</p>
        </div>
      )}

      {!loading && !error && filteredFeeds.length > 0 && (
        <div className="space-y-8">
          {topicId === 'all' ? (
            topics
              .filter((t) => (groupedByTopic.get(t.id) || []).length > 0)
              .map((t) => (
                <TopicSection
                  key={t.id}
                  topic={t}
                  feeds={groupedByTopic.get(t.id) || []}
                  onSubscribe={(f) => setTarget({ title: f.title, url: f.url, source: 'catalog' })}
                />
              ))
          ) : (
            <FeedGrid
              feeds={filteredFeeds}
              onSubscribe={(f) => setTarget({ title: f.title, url: f.url, source: 'catalog' })}
            />
          )}
        </div>
      )}

      {target && (
        <SubscribeDialog
          target={target}
          categories={categories}
          onClose={() => setTarget(null)}
          subscribe={subscribe}
          addCategory={addCategory}
          refresh={refresh}
        />
      )}

      <DiscoverDialog
        open={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        discoverFromUrl={discoverFromUrl}
        onPick={(f) => {
          setDiscoverOpen(false);
          setTarget({ title: f.title, url: f.url, source: 'discover' });
        }}
      />
    </div>
  );
}

function TopicChip({
  topic,
  active,
  count,
  onClick,
}: {
  topic: ExploreTopic;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase transition-all duration-200 rounded-sm border ${
        active
          ? 'bg-masthead text-white border-masthead'
          : 'bg-paper text-ink-muted border-rule hover:border-masthead/40 hover:text-ink'
      }`}
      title={topic.description}
    >
      {topic.name}
      <span className={`ml-1.5 text-[10px] tabular-nums ${active ? 'text-white/70' : 'text-ink-muted/60'}`}>
        {count}
      </span>
    </button>
  );
}

function TopicSection({
  topic,
  feeds,
  onSubscribe,
}: {
  topic: ExploreTopic;
  feeds: ExploreFeed[];
  onSubscribe: (f: ExploreFeed) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-rule pb-2 mb-3">
        <div>
          <h2 className="font-serif text-lg sm:text-xl font-black text-ink leading-none">{topic.name}</h2>
          <p className="text-[11px] text-ink-muted mt-1">{topic.description}</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-ink-muted/60 font-bold">
          {feeds.length} {feeds.length === 1 ? 'feed' : 'feeds'}
        </span>
      </div>
      <FeedGrid feeds={feeds} onSubscribe={onSubscribe} />
    </section>
  );
}

function FeedGrid({
  feeds,
  onSubscribe,
}: {
  feeds: ExploreFeed[];
  onSubscribe: (f: ExploreFeed) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {feeds.map((f) => (
        <FeedCard key={f.id} feed={f} onSubscribe={() => onSubscribe(f)} />
      ))}
    </div>
  );
}

function FeedCard({ feed, onSubscribe }: { feed: ExploreFeed; onSubscribe: () => void }) {
  return (
    <article className="group flex flex-col h-full rounded-md border border-rule bg-paper hover:border-masthead/40 transition-colors duration-200 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[15px] font-bold text-ink leading-tight truncate">
            {feed.title}
          </h3>
          <a
            href={`https://${feed.site}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-muted hover:text-masthead mt-0.5"
          >
            {feed.site}
            <ExternalLink size={9} />
          </a>
        </div>
        <Badge variant="outline" className="text-[9px] uppercase tracking-wider shrink-0 border-rule">
          {feed.language}
        </Badge>
      </div>

      <p className="text-[12px] text-ink-muted leading-relaxed line-clamp-3 flex-1">
        {feed.description}
      </p>

      <div className="mt-3 pt-3 border-t border-rule/60 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-ink-muted/60 font-medium truncate">
          <Rss size={10} className="inline mr-1 -mt-0.5" />
          RSS
        </span>
        {feed.subscribed ? (
          <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
            <Check size={10} />
            Subscribed
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onSubscribe}
            className="h-7 text-[11px] border-masthead/30 text-masthead hover:bg-masthead hover:text-white"
          >
            <Plus size={11} />
            Subscribe
          </Button>
        )}
      </div>
    </article>
  );
}

function FeedGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-md border border-rule bg-paper p-4">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/3 mb-3" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-5/6 mb-1" />
          <Skeleton className="h-3 w-4/5" />
          <div className="mt-3 pt-3 border-t border-rule/60 flex items-center justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SubscribeDialog({
  target,
  categories,
  onClose,
  subscribe,
  addCategory,
  refresh,
}: {
  target: SubscribeTarget;
  categories: Category[];
  onClose: () => void;
  subscribe: (categoryId: number, name: string, url: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePick = async (categoryId: number) => {
    setBusy(true);
    setErr(null);
    try {
      await subscribe(categoryId, target.title, target.url);
      setDone(true);
      setTimeout(onClose, 800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to subscribe');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAndPick = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setErr(null);
    try {
      await addCategory(name);
      const res = await fetch('/api/categories');
      const fresh: Category[] = await res.json();
      const created = fresh.find((c) => c.name === name);
      if (!created) throw new Error('Could not locate the new section');
      await subscribe(created.id, target.title, target.url);
      await refresh();
      setDone(true);
      setTimeout(onClose, 800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create section');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Subscribe to feed</DialogTitle>
          <DialogDescription className="text-xs">
            Choose a section to add <span className="font-semibold text-ink">{target.title}</span>.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-masthead/10 mb-2">
              <Check size={20} className="text-masthead" />
            </div>
            <p className="text-sm text-ink font-medium">Subscribed</p>
          </div>
        ) : (
          <>
            <div className="max-h-[260px] overflow-y-auto -mx-1 px-1">
              {categories.length === 0 ? (
                <p className="text-xs text-ink-muted text-center py-6">
                  No sections yet. Create one below.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handlePick(c.id)}
                      className="text-left flex items-center justify-between px-3 py-2 rounded-sm border border-rule bg-paper hover:border-masthead/40 hover:bg-paper-dark/40 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <span className="text-[13px] text-ink font-medium truncate">{c.name}</span>
                      <span className="text-[10px] text-ink-muted/60 uppercase tracking-wider shrink-0 ml-2">
                        {c.feed_count} {c.feed_count === 1 ? 'feed' : 'feeds'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-rule pt-3">
              {creating ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateAndPick();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New section name…"
                    disabled={busy}
                    className="h-8 text-sm"
                  />
                  <Button type="submit" size="sm" disabled={busy || !newName.trim()} className="h-8 text-xs">
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Create
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setCreating(false);
                      setNewName('');
                    }}
                    className="h-8 text-xs"
                  >
                    <X size={12} />
                  </Button>
                </form>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreating(true)}
                  className="w-full justify-start text-xs text-ink-muted hover:text-masthead h-8"
                >
                  <Plus size={12} />
                  Create new section
                </Button>
              )}
            </div>

            {err && (
              <p className="text-[11px] text-accent flex items-center gap-1.5">
                <AlertCircle size={11} />
                {err}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiscoverDialog({
  open,
  onClose,
  discoverFromUrl,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  discoverFromUrl: (url: string) => Promise<DiscoveredFeed[]>;
  onPick: (f: DiscoveredFeed) => void;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DiscoveredFeed[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setUrl('');
    setResults(null);
    setErr(null);
    setBusy(false);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setErr(null);
    setResults(null);
    try {
      const feeds = await discoverFromUrl(url.trim());
      setResults(feeds);
      if (feeds.length === 0) setErr('No RSS feeds found on this URL.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Discover feeds from a URL</DialogTitle>
          <DialogDescription className="text-xs">
            Paste any website URL and we'll auto-detect its RSS or Atom feeds.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={busy}
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={busy || !url.trim()} className="h-9 text-xs shrink-0">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Find
          </Button>
        </form>

        {err && (
          <p className="text-[11px] text-accent flex items-center gap-1.5">
            <AlertCircle size={11} />
            {err}
          </p>
        )}

        {results && results.length > 0 && (
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto -mx-1 px-1">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted/60 mb-1">
              Found {results.length} {results.length === 1 ? 'feed' : 'feeds'}
            </p>
            {results.map((f, i) => (
              <button
                key={`${f.url}-${i}`}
                type="button"
                onClick={() => onPick(f)}
                className="w-full text-left px-3 py-2 rounded-sm border border-rule bg-paper hover:border-masthead/40 hover:bg-paper-dark/40 transition-colors cursor-pointer"
              >
                <div className="text-[13px] text-ink font-medium truncate">{f.title}</div>
                <div className="text-[10px] text-ink-muted truncate mt-0.5">{f.url}</div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
