export interface Category {
  id: number;
  name: string;
  icon: string;
  sort_order: number;
  feed_count: number;
}

export interface Feed {
  id: number;
  category_id: number;
  name: string;
  url: string;
}

export interface Summary {
  id?: number;
  category: string;
  summary: string;
  article_count: number;
  feed_count: number;
  generated_at: string;
  provider?: string;
  sentiment_data?: SentimentSection[];
  tags_data?: string[];
}

export interface SentimentSection {
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  tags: string[];
}

export interface HistoryEntry {
  id: number;
  date_key: string;
  generated_at: string;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ProviderQuota {
  provider: string;
  model: string;
  limit_tokens: number | null;
  remaining_tokens: number | null;
  limit_requests: number | null;
  remaining_requests: number | null;
  reset_tokens: string | null;
  reset_requests: string | null;
  updated_at: string;
}

export interface LlmStats {
  total_calls: number;
  total_tokens: number;
  by_provider: Record<string, { calls: number; tokens: number }>;
  by_purpose: Record<string, { calls: number; tokens: number }>;
  daily: { date: string; tokens: number; calls: number }[];
  quotas: ProviderQuota[];
}

export interface CryptoPrice {
  id: string;
  symbol: string;
  price: number;
  change_24h: number;
}

export interface HackerNewsItem {
  id: number;
  title: string;
  url: string;
  score: number;
}

export interface OnThisDayEvent {
  year: number;
  text: string;
}

export interface UpcomingRelease {
  id: number;
  title: string;
  date: string;
  type: 'movie' | 'tv';
  rating: number | null;
  overview: string;
  poster: string | null;
}

export interface DiscoveredFeed {
  title: string;
  url: string;
}
