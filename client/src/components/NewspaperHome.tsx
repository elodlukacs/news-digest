import { useMemo } from 'react';
import { ExternalLink, Clock, RefreshCw } from 'lucide-react';
import type { CryptoPrice, HackerNewsItem, Weather, Rates, Headline } from '../types';
import type { HomepageBrief, HomepageArticle } from '../types';
import { timeAgo, formatDay } from '../utils/date';
import { WeatherIcon } from './SharedWidgets';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';

/* ─── Types ──────────────────────────────────────────────── */

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
}

/* ─── Helpers ────────────────────────────────────────────── */

function truncateSource(source: string, max = 20): string {
  if (source.length <= max) return source;
  return source.slice(0, max) + '…';
}

function ArticleImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
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
          className="w-full h-56 xl:h-72 object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-16 pb-4 px-5">
          <Badge variant="default" className="inline-block text-[9px] uppercase tracking-[0.2em] font-bold text-white/90 bg-accent px-2 py-0.5">
            {categoryName}
          </Badge>
        </div>
      </a>
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
        <h2 className="font-serif text-2xl md:text-xl xl:text-2xl font-black leading-tight text-ink hover:text-masthead transition-colors">
          {article.title}
        </h2>
      </a>
      <p className="text-[15px] md:text-[14px] leading-[1.75] text-ink-light font-[family-name:var(--font-body)] mt-2 line-clamp-5">
        {article.excerpt}
      </p>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-ink-muted uppercase tracking-wider">
        <span className="truncate max-w-[120px]">{truncateSource(article.source)}</span>
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
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </a>
        <div className="flex-1 min-w-0">
          <Button variant="ghost" onClick={onCategoryClick} className="cursor-pointer h-auto p-0">
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-masthead">{categoryName}</span>
          </Button>
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
          className="w-full h-36 object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </a>
      <Button variant="ghost" onClick={onCategoryClick} className="cursor-pointer h-auto p-0">
        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-masthead">{categoryName}</span>
      </Button>
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
        <h3 className="font-serif text-base font-bold text-ink leading-snug mt-0.5 hover:text-masthead transition-colors">
          {article.title}
        </h3>
      </a>
      <p className="text-[13px] text-ink-light leading-relaxed mt-1.5 line-clamp-4 font-[family-name:var(--font-body)]">
        {article.excerpt}
      </p>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-muted">
        <span className="truncate max-w-[100px]">{truncateSource(article.source)}</span>
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
      <Button variant="ghost" onClick={onCategoryClick} className="cursor-pointer h-auto p-0">
        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-masthead">{categoryName}</span>
      </Button>
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
        <h3 className="font-serif text-lg md:text-[15px] font-bold text-ink leading-snug mt-0.5 hover:text-masthead transition-colors">
          {article.title}
        </h3>
      </a>
      <p className="text-[15px] md:text-[13px] text-ink-light leading-relaxed mt-1 line-clamp-4 font-[family-name:var(--font-body)]">
        {article.excerpt}
      </p>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-muted">
        <span className="truncate max-w-[100px]">{truncateSource(article.source)}</span>
        {article.pubDate && <span>{timeAgo(article.pubDate)}</span>}
      </div>
    </article>
  );
}

/* ─── Section Helpers ────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 bg-paper-dark -mx-4 px-4 py-2 mb-3">
      <span className="w-1 h-3 bg-masthead rounded-sm" />
      <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink">{title}</h3>
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
}: Props) {
  const allCards = useMemo(() => flattenBriefs(briefs), [briefs]);

  // Distribute cards across 3 content columns + hero
  // Strategy: round-robin by category so each column has variety
  const { hero, col1Cards, col2Secondary, col3Cards } = useMemo(() => {
    const hero = allCards[0] || null;
    const remaining = allCards.slice(1);
    const c1: CardItem[] = [];
    const c2: CardItem[] = [];
    const c3: CardItem[] = [];
    remaining.forEach((card, i) => {
      const bucket = i % 3;
      if (bucket === 0) c1.push(card);
      else if (bucket === 1) c2.push(card);
      else c3.push(card);
    });
    return { hero, col1Cards: c1, col2Secondary: c2, col3Cards: c3 };
  }, [allCards]);

  if (loading) {
    return (
      <div className="py-32 space-y-4">
        <Skeleton className="w-64 h-8 mx-auto" />
        <Skeleton className="w-48 h-4 mx-auto" />
        <div className="mt-12 grid grid-cols-5 gap-6">
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-72 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </div>
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
        <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Load Headlines
        </Button>
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
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>

      {/* ─── Above the Fold: 5-Column Grid ─── */}
      <div className="newspaper-grid">
        {/* COLUMN 1: Text-only articles from different categories */}
        <div className="border-r border-rule px-4 pt-4 pb-6 order-2 md:order-none">
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
        <div className="border-r border-rule px-4 pt-4 pb-6 order-1 md:order-none">
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
        <div className="border-r border-rule px-4 pt-4 pb-6 order-3 md:order-none">
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
                {headlines.slice(0, 15).map((h, i) => (
                  <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" className="block group cursor-pointer">
                    <p className="text-[14px] leading-snug text-ink font-serif font-bold group-hover:text-masthead transition-colors">
                      {h.title}
                    </p>
                    <p className="text-[10px] text-ink-muted mt-0.5 flex items-center gap-1">
                      {h.source}
                      <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    {i < Math.min(headlines.length, 15) - 1 && <div className="mt-3" />}
                  </a>
                ))}
              </div>
            </div>
          ) : hackerNews.length > 0 ? (
            <div>
              <SectionHeader title="Hacker News" />
              <div className="space-y-3">
                {hackerNews.slice(0, 15).map((item, i) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block group cursor-pointer">
                    <p className="text-[14px] leading-snug text-ink font-serif font-bold group-hover:text-masthead transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-ink-muted mt-0.5">{item.score} pts</p>
                    {i < Math.min(hackerNews.length, 15) - 1 && <div className="mt-3" />}
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
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <WeatherIcon code={weather.code} size={22} />
                  <div>
                    <p className="text-lg font-semibold text-ink leading-none">{weather.temperature}&deg;</p>
                    <p className="text-[10px] text-ink-muted">{weather.condition}</p>
                  </div>
                </div>
                <p className="text-[9px] text-ink-muted uppercase tracking-wider">{weather.location}</p>
              </div>
              {weather.forecast.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {weather.forecast.map((day) => (
                    <div key={day.date} className="text-center">
                      <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1">{formatDay(day.date)}</p>
                      <div className="flex justify-center mb-1 text-ink-muted"><WeatherIcon code={day.code} size={14} /></div>
                      <p className="text-[11px] text-ink font-medium">
                        {day.high}&deg;<span className="text-ink-muted font-normal ml-0.5">{day.low}&deg;</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
        </div>
      </div>

    </div>
  );
}
