import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog,
  Wind, Droplets, ExternalLink, CloudSun,
} from 'lucide-react';
import type { CryptoPrice } from '../types';

interface ForecastDay {
  date: string;
  code: number;
  condition: string;
  high: number;
  low: number;
}

interface Weather {
  temperature: number;
  code: number;
  condition: string;
  wind: number;
  humidity: number;
  location: string;
  forecast: ForecastDay[];
}

interface Rates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface Headline {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

interface Props {
  weather: Weather | null;
  rates: Rates | null;
  headlines: Headline[];
  crypto: CryptoPrice[];
  trending: { tag: string; count: number }[];
}

function WeatherIcon({ code, size = 16 }: { code: number; size?: number }) {
  if (code === 0) return <Sun size={size} />;
  if (code <= 2) return <CloudSun size={size} />;
  if (code === 3) return <Cloud size={size} />;
  if (code >= 45 && code <= 48) return <CloudFog size={size} />;
  if (code >= 51 && code <= 55) return <CloudDrizzle size={size} />;
  if (code >= 61 && code <= 65) return <CloudRain size={size} />;
  if (code >= 71 && code <= 75) return <CloudSnow size={size} />;
  if (code >= 80 && code <= 82) return <CloudRain size={size} />;
  if (code >= 95) return <CloudLightning size={size} />;
  return <Cloud size={size} />;
}

function formatDay(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function WidgetSidebar({ weather, rates, headlines, crypto, trending }: Props) {

  return (
    <aside className="w-72 shrink-0 hidden lg:block pt-8 font-widget">
      <div className="sticky top-8 space-y-8">
        {/* Weather */}
        {weather && (
          <section>
            <WidgetHeader title="Weather" />
            <div className="pt-4 pb-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <WeatherIcon code={weather.code} size={28} />
                  <div>
                    <p className="text-2xl font-semibold text-ink leading-none">{weather.temperature}&deg;</p>
                    <p className="text-[12px] text-ink-muted mt-1">{weather.condition}</p>
                  </div>
                </div>
                <p className="text-[10px] text-ink-muted uppercase tracking-wider">{weather.location}</p>
              </div>
              <div className="mt-4 flex gap-5 text-[11px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Wind size={11} /> {weather.wind} km/h
                </span>
                <span className="flex items-center gap-1.5">
                  <Droplets size={11} /> {weather.humidity}%
                </span>
              </div>
            </div>
            {weather.forecast.length > 0 && (
              <div className="border-t border-rule pt-4 grid grid-cols-3 gap-3">
                {weather.forecast.map((day) => (
                  <div key={day.date} className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2">{formatDay(day.date)}</p>
                    <div className="flex justify-center mb-2 text-ink-muted">
                      <WeatherIcon code={day.code} size={18} />
                    </div>
                    <p className="text-[12px] text-ink font-medium">
                      {day.high}&deg;
                      <span className="text-ink-muted font-normal ml-1">{day.low}&deg;</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Crypto Ticker */}
        {crypto.length > 0 && (
          <section>
            <WidgetHeader title="Crypto" />
            <div className="pt-4 space-y-2.5">
              {crypto.map((coin) => (
                <div key={coin.id} className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-ink tracking-wider">{coin.symbol}</span>
                  <div className="text-right">
                    <span className="text-[13px] font-medium text-ink ">
                      ${coin.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span
                      className={`ml-2 text-[11px] ${
                        coin.change_24h >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {coin.change_24h >= 0 ? '+' : ''}
                      {coin.change_24h.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* RON Exchange Rates */}
        {rates && (
          <section>
            <WidgetHeader title="RON Exchange" />
            <div className="pt-4 space-y-2.5">
              {Object.entries(rates.rates).map(([currency, rate]) => {
                const ronValue = 1 / rate;
                return (
                  <div key={currency} className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-ink tracking-wider">1 {currency}</span>
                    <span className="text-[13px] font-medium text-ink ">
                      {ronValue.toFixed(currency === 'HUF' ? 4 : 2)} RON
                    </span>
                  </div>
                );
              })}
              <p className="text-[10px] text-ink-muted pt-1">{rates.date}</p>
            </div>
          </section>
        )}

        {/* Trending Topics */}
        {trending.length > 0 && (
          <section>
            <WidgetHeader title="Trending Topics" />
            <div className="pt-4 flex flex-wrap gap-1.5">
              {trending.slice(0, 12).map((t) => (
                <span
                  key={t.tag}
                  className="px-2 py-0.5 text-[10px] font-medium bg-paper-dark border border-rule text-ink-muted"
                >
                  {t.tag}{' '}
                  <span className="text-ink-muted/50">({t.count})</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Headlines */}
        {headlines.length > 0 && (
          <section>
            <WidgetHeader title="Headlines" />
            <div className="pt-4 space-y-3.5">
              {headlines.map((h, i) => (
                <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" className="block group cursor-pointer">
                  <p className="text-[13px] leading-snug text-ink group-hover:text-ink-muted transition-colors">
                    {h.title}
                  </p>
                  <p className="text-[10px] text-ink-muted mt-0.5 flex items-center gap-1">
                    {h.source}
                    <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  {i < headlines.length - 1 && <div className="h-px bg-rule-light mt-3.5" />}
                </a>
              ))}
            </div>
          </section>
        )}

      </div>
    </aside>
  );
}

function WidgetHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-rule bg-masthead/5 -mx-3 px-3 py-2 mb-1 flex items-center gap-2">
      <span className="w-1 h-3.5 bg-masthead rounded-full" />
      <h3 className="text-[12px] uppercase tracking-[0.15em] font-bold text-ink">{title}</h3>
    </div>
  );
}
