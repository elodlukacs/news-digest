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

export interface UpcomingRelease {
  id: number;
  title: string;
  date: string;
  type: 'movie' | 'tv';
  rating: number | null;
  overview: string;
  poster: string | null;
}

export type JobStatus = 'new' | 'applied' | 'ignored';
export type JobSource = 'remoteok' | 'weworkremotely' | 'himalayas' | 'remotive' | 'arbeitnow' | 'linkedin' | 'indeed' | 'hackernews';
export type RemoteAssessment = 'yes' | 'no' | 'possible';

export interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  source: JobSource;
  datePosted: string;
  status: JobStatus;
  country: string;
  workType: string;
  description?: string;
  aiRemote?: RemoteAssessment;
}

export interface JobFilters {
  status: string;
  source: string;
  workType: string;
  search: string;
  country: string;
  aiOnly: boolean;
}

export interface JobCounts {
  total: number;
  new: number;
  applied: number;
  ignored: number;
  aiFiltered: number;
}

export interface ReleaseDetail {
  id: number;
  title: string;
  tagline: string | null;
  overview: string;
  date: string;
  type: 'movie' | 'tv';
  rating: number | null;
  votes: number;
  runtime: number | null;
  genres: string[];
  cast: string[];
  directors: string[];
  poster: string | null;
  backdrop: string | null;
  trailer: string | null;
  seasons: number | null;
  episodes: number | null;
  status: string | null;
}

export type { ForecastDay, Weather, Rates, Headline, Briefing } from './widgets';
