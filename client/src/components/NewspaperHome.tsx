import { useState, useRef, useCallback, useEffect } from 'react';
import { ExternalLink, Clock, RefreshCw, Film, Tv, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CryptoPrice, HackerNewsItem, UpcomingRelease } from '../types';
import type { HomepageBrief, HomepageArticle } from '../hooks/useApi';

/* ─── Types ──────────────────────────────────────────────── */

interface Headline {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

interface Weather {
  temperature: number;
  code: number;
  condition: string;
  location: string;
}

interface Rates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface Props {
  briefs: HomepageBrief[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectCategory: (id: number) => void;
  weather: Weather | null;
  crypto: CryptoPrice[];
  rates: Rates | null;
  headlines: Headline[];
  hackerNews: HackerNewsItem[];
  releases: UpcomingRelease[];
}

/* ─── Helpers ────────────────────────────────────────────── */

function timeAgo(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatReleaseDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Placeholder gradient for feeds without images ──────── */

const GRADIENTS = [
  'from-stone-200 to-stone-300',
  'from-zinc-200 to-zinc-300',
  'from-neutral-200 to-neutral-300',
  'from-stone-200 to-zinc-300',
  'from-neutral-200 to-stone-300',
  'from-zinc-200 to-neutral-300',
  'from-stone-300 to-neutral-200',
  'from-zinc-300 to-stone-200',
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function Placeholder({ categoryName, className }: { categoryName: string; className?: string }) {
  return (
    <div className={`bg-gradient-to-br ${getGradient(categoryName)} flex items-end justify-start p-4 ${className || ''}`}>
      <span className="font-serif text-lg font-bold text-ink/15 select-none uppercase tracking-wider">
        {categoryName}
      </span>
    </div>
  );
}

function ArticleImage({
  src,
  alt,
  categoryName,
  className,
}: {
  src: string;
  alt: string;
  categoryName: string;
  className: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (!src || imgError) {
    return <Placeholder categoryName={categoryName} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setImgError(true)}
      className={className}
    />
  );
}

/* ─── Card Components ────────────────────────────────────── */

function HeroCard({
  article,
  categoryName,
}: {
  article: HomepageArticle;
  categoryName: string;
}) {
  return (
    <article className="group">
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block relative overflow-hidden bg-paper-dark mb-3">
        <ArticleImage
          src={article.image}
          alt={article.title}
          categoryName={categoryName}
          className="w-full h-56 xl:h-72 object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-16 pb-4 px-5">
          <span className="inline-block text-[9px] uppercase tracking-[0.2em] font-bold text-white/90 bg-accent px-2 py-0.5">
            {categoryName}
          </span>
        </div>
      </a>
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
        <h2 className="font-serif text-xl xl:text-2xl font-black leading-tight text-ink hover:text-masthead transition-colors">
          {article.title}
        </h2>
      </a>
      <p className="text-[14px] leading-[1.75] text-ink-light font-[family-name:var(--font-body)] mt-2 line-clamp-5">
        {article.excerpt}
      </p>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-ink-muted uppercase tracking-wider">
        <span>{article.source}</span>
        {article.pubDate && <span className="flex items-center gap-1"><Clock size={9} /> {timeAgo(article.pubDate)}</span>}
      </div>
    </article>
  );
}

function ImageCard({
  article,
  categoryName,
  onCategoryClick,
  horizontal = false,
}: {
  article: HomepageArticle;
  categoryName: string;
  onCategoryClick: () => void;
  horizontal?: boolean;
}) {
  if (horizontal) {
    return (
      <article className="group flex gap-3">
        <a href={article.link} target="_blank" rel="noopener noreferrer" className="w-28 h-20 shrink-0 overflow-hidden bg-paper-dark block">
          <ArticleImage
            src={article.image}
            alt={article.title}
            categoryName={categoryName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </a>
        <div className="flex-1 min-w-0">
          <button onClick={onCategoryClick} className="cursor-pointer">
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-masthead">{categoryName}</span>
          </button>
          <a href={article.link} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
            <h3 className="font-serif text-sm font-bold text-ink leading-snug mt-0.5 hover:text-masthead transition-colors line-clamp-2">
              {article.title}
            </h3>
          </a>
          <p className="text-[11px] text-ink-muted mt-1 line-clamp-3 leading-relaxed">{article.excerpt}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="group">
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block relative overflow-hidden bg-paper-dark mb-2">
        <ArticleImage
          src={article.image}
          alt={article.title}
          categoryName={categoryName}
          className="w-full h-36 object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </a>
      <button onClick={onCategoryClick} className="cursor-pointer">
        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-masthead">{categoryName}</span>
      </button>
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
        <h3 className="font-serif text-base font-bold text-ink leading-snug mt-0.5 hover:text-masthead transition-colors">
          {article.title}
        </h3>
      </a>
      <p className="text-[13px] text-ink-light leading-relaxed mt-1.5 line-clamp-4 font-[family-name:var(--font-body)]">
        {article.excerpt}
      </p>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-muted">
        <span>{article.source}</span>
        {article.pubDate && <span>{timeAgo(article.pubDate)}</span>}
      </div>
    </article>
  );
}

function TextCard({
  article,
  categoryName,
  onCategoryClick,
}: {
  article: HomepageArticle;
  categoryName: string;
  onCategoryClick: () => void;
}) {
  return (
    <article className="group">
      <button onClick={onCategoryClick} className="cursor-pointer">
        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-masthead">{categoryName}</span>
      </button>
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
        <h3 className="font-serif text-[15px] font-bold text-ink leading-snug mt-0.5 hover:text-masthead transition-colors">
          {article.title}
        </h3>
      </a>
      <p className="text-[13px] text-ink-light leading-relaxed mt-1 line-clamp-4 font-[family-name:var(--font-body)]">
        {article.excerpt}
      </p>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-muted">
        <span>{article.source}</span>
        {article.pubDate && <span>{timeAgo(article.pubDate)}</span>}
      </div>
    </article>
  );
}

/* ─── Section Helpers ────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-t-2 border-ink pt-2 pb-3 mb-1">
      <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink">{title}</h3>
    </div>
  );
}

function ColumnRule() {
  return <div className="h-px bg-rule my-4" />;
}

/* ─── Flatten briefs into card items ─────────────────────── */

interface CardItem {
  article: HomepageArticle;
  categoryId: number;
  categoryName: string;
}

function flattenBriefs(briefs: HomepageBrief[]): CardItem[] {
  const items: CardItem[] = [];
  for (const brief of briefs) {
    for (const article of brief.articles) {
      items.push({ article, categoryId: brief.categoryId, categoryName: brief.categoryName });
    }
  }
  return items;
}

/* ─── Releases Carousel ──────────────────────────────────── */

function ReleasesCarousel({ releases }: { releases: UpcomingRelease[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, releases]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="mt-1 border-t border-rule overflow-hidden">
      <div className="pt-4 pb-5">
        {/* Header with arrows */}
        <div className="flex items-center justify-between mb-4 px-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex-1 h-px bg-rule" />
            <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted whitespace-nowrap">
              This Week in Entertainment
            </span>
            <div className="flex-1 h-px bg-rule" />
          </div>
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-7 h-7 flex items-center justify-center border border-rule rounded-full cursor-pointer transition-all duration-200 hover:border-ink hover:text-ink text-ink-muted disabled:opacity-20 disabled:cursor-default"
              aria-label="Scroll left"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-7 h-7 flex items-center justify-center border border-rule rounded-full cursor-pointer transition-all duration-200 hover:border-ink hover:text-ink text-ink-muted disabled:opacity-20 disabled:cursor-default"
              aria-label="Scroll right"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable track */}
        <div className="relative">
          {/* Left fade */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-paper to-transparent z-10 pointer-events-none" />
          )}
          {/* Right fade */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-paper to-transparent z-10 pointer-events-none" />
          )}

          <div
            ref={scrollRef}
            className="overflow-x-auto scrollbar-none scroll-smooth"
          >
            <div className="flex gap-4 px-4 pb-2 w-max">
              {releases.map(r => (
                <div key={`${r.type}-${r.id}`} className="w-28 sm:w-32 group cursor-pointer">
                  {r.poster ? (
                    <img
                      src={r.poster}
                      alt={r.title}
                      className="w-28 sm:w-32 h-[168px] sm:h-48 object-cover bg-paper-dark rounded-sm"
                    />
                  ) : (
                    <div className="w-28 sm:w-32 h-[168px] sm:h-48 bg-paper-dark border border-rule flex items-center justify-center rounded-sm">
                      {r.type === 'movie' ? <Film size={20} className="text-ink-muted" /> : <Tv size={20} className="text-ink-muted" />}
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-[12px] font-serif font-bold text-ink leading-snug line-clamp-2 group-hover:text-masthead transition-colors">
                      {r.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {r.type === 'movie'
                        ? <Film size={9} className="text-ink-muted shrink-0" />
                        : <Tv size={9} className="text-ink-muted shrink-0" />
                      }
                      <span className="text-[10px] text-ink-muted">{formatReleaseDate(r.date)}</span>
                      {r.rating !== null && r.rating > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-masthead font-medium">
                          <Star size={8} /> {r.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export function NewspaperHome({
  briefs,
  loading,
  refreshing,
  onRefresh,
  onSelectCategory,
  weather,
  crypto,
  rates,
  headlines,
  hackerNews,
  releases,
}: Props) {
  const allCards = flattenBriefs(briefs);

  // Distribute cards across 3 content columns + hero
  // Strategy: round-robin by category so each column has variety
  const hero = allCards[0] || null;
  const remaining = allCards.slice(1);

  // Distribute remaining cards into 3 buckets: col1, col2sub, col3
  const col1Cards: CardItem[] = [];
  const col2Secondary: CardItem[] = [];
  const col3Cards: CardItem[] = [];
  const bottomCards: CardItem[] = [];

  remaining.forEach((card, i) => {
    const bucket = i % 3;
    if (bucket === 0 && col1Cards.length < 5) col1Cards.push(card);
    else if (bucket === 1 && col2Secondary.length < 4) col2Secondary.push(card);
    else if (bucket === 2 && col3Cards.length < 5) col3Cards.push(card);
    else bottomCards.push(card);
  });

  if (loading) {
    return (
      <div className="py-32 text-center">
        <div className="inline-block w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-ink-muted font-light">Loading front page...</p>
      </div>
    );
  }

  if (allCards.length === 0) {
    return (
      <div className="py-32 text-center">
        <p className="font-serif text-3xl text-ink-muted italic mb-3">Your front page awaits</p>
        <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed mb-6">
          Add categories and feeds, then your latest news will appear here.
        </p>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-[0.15em] font-medium cursor-pointer transition-all duration-200 border border-ink text-ink hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Load Headlines
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ─── Reload Bar ─── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-rule">
        <p className="text-[10px] text-ink-muted uppercase tracking-wider">
          Latest from {briefs.length} {briefs.length === 1 ? 'category' : 'categories'}
        </p>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-semibold text-ink-muted hover:text-masthead cursor-pointer transition-colors disabled:opacity-40"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {/* ─── Above the Fold: 5-Column Grid ─── */}
      <div className="newspaper-grid">
        {/* COLUMN 1: Text-only articles from different categories */}
        <div className="border-r border-rule px-4 pt-4 pb-6">
          {col1Cards.map((card, i) => (
            <div key={`c1-${card.categoryId}-${i}`}>
              <TextCard
                article={card.article}
                categoryName={card.categoryName}
                onCategoryClick={() => onSelectCategory(card.categoryId)}
              />
              {i < col1Cards.length - 1 && <ColumnRule />}
            </div>
          ))}
        </div>

        {/* COLUMN 2: Hero + secondary featured (widest) */}
        <div className="border-r border-rule px-4 pt-4 pb-6">
          {hero && (
            <HeroCard
              article={hero.article}
              categoryName={hero.categoryName}
            />
          )}

          {col2Secondary.length > 0 && (
            <>
              <ColumnRule />
              <div className={`grid gap-4 ${col2Secondary.length > 1 ? 'grid-cols-2' : ''}`}>
                {col2Secondary.map((card, i) => (
                  <ImageCard
                    key={`c2-${card.categoryId}-${i}`}
                    article={card.article}
                    categoryName={card.categoryName}
                    onCategoryClick={() => onSelectCategory(card.categoryId)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* COLUMN 3: More category articles */}
        <div className="border-r border-rule px-4 pt-4 pb-6">
          {col3Cards.map((card, i) => (
            <div key={`c3-${card.categoryId}-${i}`}>
              {i === 0 ? (
                <ImageCard
                  article={card.article}
                  categoryName={card.categoryName}
                  onCategoryClick={() => onSelectCategory(card.categoryId)}
                />
              ) : (
                <TextCard
                  article={card.article}
                  categoryName={card.categoryName}
                  onCategoryClick={() => onSelectCategory(card.categoryId)}
                />
              )}
              {i < col3Cards.length - 1 && <ColumnRule />}
            </div>
          ))}
        </div>

        {/* COLUMN 4: Headlines */}
        <div className="border-r border-rule px-4 pt-4 pb-6">
          {headlines.length > 0 ? (
            <div>
              <SectionHeader title="Headlines" />
              <div className="space-y-3">
                {headlines.slice(0, 8).map((h, i) => (
                  <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" className="block group cursor-pointer">
                    <p className="text-[13px] leading-snug text-ink font-medium group-hover:text-masthead transition-colors">
                      {h.title}
                    </p>
                    <p className="text-[10px] text-ink-muted mt-0.5 flex items-center gap-1">
                      {h.source}
                      <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    {i < Math.min(headlines.length, 8) - 1 && <div className="h-px bg-rule-light mt-3" />}
                  </a>
                ))}
              </div>
            </div>
          ) : hackerNews.length > 0 ? (
            <div>
              <SectionHeader title="Hacker News" />
              <div className="space-y-3">
                {hackerNews.slice(0, 8).map((item, i) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block group cursor-pointer">
                    <p className="text-[13px] leading-snug text-ink group-hover:text-masthead transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-ink-muted mt-0.5">{item.score} pts</p>
                    {i < Math.min(hackerNews.length, 8) - 1 && <div className="h-px bg-rule-light mt-3" />}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* COLUMN 5: Widgets + HN */}
        <div className="px-4 pt-4 pb-6">
          {weather && (
            <div className="mb-5">
              <SectionHeader title="Weather" />
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-ink">{weather.temperature}&deg;</span>
                <span className="text-[12px] text-ink-muted">{weather.condition}</span>
              </div>
              <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wider">{weather.location}</p>
            </div>
          )}

          {crypto.length > 0 && (
            <div className="mb-5">
              <SectionHeader title="Markets" />
              <div className="space-y-2">
                {crypto.map(coin => (
                  <div key={coin.id} className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-ink tracking-wider">{coin.symbol}</span>
                    <div className="text-right">
                      <span className="text-[12px] font-medium text-ink">
                        ${coin.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className={`ml-1.5 text-[10px] ${coin.change_24h >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {coin.change_24h >= 0 ? '+' : ''}{coin.change_24h.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rates && (
            <div className="mb-5">
              <SectionHeader title="Exchange" />
              <div className="space-y-2">
                {Object.entries(rates.rates).map(([currency, rate]) => (
                  <div key={currency} className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-ink tracking-wider">1 {currency}</span>
                    <span className="text-[12px] text-ink">
                      {(1 / rate).toFixed(currency === 'HUF' ? 4 : 2)} RON
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {headlines.length > 0 && hackerNews.length > 0 && (
            <div>
              <SectionHeader title="Hacker News" />
              <div className="space-y-2.5">
                {hackerNews.slice(0, 6).map((item, i) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block group cursor-pointer">
                    <p className="text-[12px] leading-snug text-ink group-hover:text-masthead transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-ink-muted mt-0.5">{item.score} pts</p>
                    {i < Math.min(hackerNews.length, 6) - 1 && <div className="h-px bg-rule-light mt-2.5" />}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Releases Carousel ─── */}
      {releases.length > 0 && (
        <ReleasesCarousel releases={releases} />
      )}

    </div>
  );
}
