export interface CryptoPrice {
  id: string;
  symbol: string;
  price: number;
  change_24h: number;
}

export interface ForecastDay {
  date: string;
  code: number;
  condition: string;
  high: number;
  low: number;
}

export interface Weather {
  temperature: number;
  code: number;
  condition: string;
  wind: number;
  humidity: number;
  location: string;
  forecast: ForecastDay[];
}

export interface Rates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface Headline {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

export interface Briefing {
  summary: string;
  generated_at: string;
  provider?: string;
}
