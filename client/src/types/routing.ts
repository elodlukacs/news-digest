import type { Weather, CryptoPrice, Rates, Headline, HackerNewsItem, Category, UpcomingRelease } from '../types';

export interface AppOutletContext {
  weather: Weather | null;
  crypto: CryptoPrice[];
  rates: Rates | null;
  headlines: Headline[];
  hackerNews: HackerNewsItem[];
  trending: { tag: string; count: number }[];
  releases: UpcomingRelease[];
  categories: Category[];
  selectedLlm: string;
  onLlmChange: (id: string) => void;
  onManageFeeds: (categoryId: number) => void;
  deleteCategory: (id: number) => Promise<void>;
  onSelectCategory: (name: string) => void;
}
