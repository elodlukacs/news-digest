import { Wind, Droplets, ExternalLink } from 'lucide-react';
import type { CryptoPrice, Weather, Rates, Headline } from '../types';
import { formatDay } from '../utils/date';
import { WeatherIcon, WidgetHeader } from './SharedWidgets';
import { Badge } from './ui/badge';

interface Props {
  weather: Weather | null;
  rates: Rates | null;
  headlines: Headline[];
  crypto: CryptoPrice[];
  trending: { tag: string; count: number }[];
}

export function WidgetSidebar({ weather, rates, headlines, crypto, trending }: Props) {

  return (
    <aside className="w-72 shrink-0 hidden lg:block pt-8 font-widget">
      <div className="sticky top-8 space-y-5">
        {/* Weather */}
        {weather && (
          <section>
            <WidgetHeader title="Weather" />
            <div className="px-4 py-3">
              {/* Location */}
              <p className="text-[12px] text-ink-muted uppercase tracking-wider mb-2 text-center">{weather.location}</p>

              {/* Current conditions */}
              <div className="flex items-center justify-center gap-3">
                <div className="text-ink-light">
                  <WeatherIcon code={weather.code} size={36} />
                </div>
                <div>
                  <p className="text-3xl font-semibold text-ink leading-none tracking-tight">{weather.temperature}<span className="text-lg text-ink-muted">&deg;</span></p>
                  <p className="text-[12px] text-ink-muted mt-0.5 capitalize">{weather.condition}</p>
                </div>
              </div>

              {/* Wind & humidity */}
              <div className="mt-3 pt-2.5 border-t border-rule/50 flex justify-center gap-6 text-[12px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Wind size={13} strokeWidth={1.5} /> {weather.wind} km/h
                </span>
                <span className="flex items-center gap-1.5">
                  <Droplets size={13} strokeWidth={1.5} /> {weather.humidity}%
                </span>
              </div>

              {/* 3-day forecast */}
              {weather.forecast.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-rule/50 grid grid-cols-3 gap-1">
                  {weather.forecast.map((day) => (
                    <div key={day.date} className="text-center py-1.5 rounded-md hover:bg-paper-dark transition-colors">
                      <p className="text-[10px] uppercase tracking-wider text-ink-muted font-medium">{formatDay(day.date)}</p>
                      <div className="flex justify-center my-1.5 text-ink-light">
                        <WeatherIcon code={day.code} size={20} />
                      </div>
                      <p className="text-[12px] text-ink font-medium leading-none">
                        {day.high}&deg;
                        <span className="text-ink-muted font-normal ml-0.5">{day.low}&deg;</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Crypto Ticker */}
        {crypto.length > 0 && (
          <section>
            <WidgetHeader title="Crypto" />
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
            <div className="flex flex-wrap gap-1.5">
              {trending.slice(0, 12).map((t) => (
                <Badge
                  key={t.tag}
                  variant="secondary"
                  className="px-2 py-0.5 text-[10px] font-medium bg-paper-dark text-ink-muted"
                >
                  {t.tag}{' '}
                  <span className="text-ink-muted/50">({t.count})</span>
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Headlines */}
        {headlines.length > 0 && (
          <section>
            <WidgetHeader title="Headlines" />
            <div className="space-y-2.5">
              {headlines.map((h, i) => (
                <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" className="block group cursor-pointer">
                  <p className="text-[13px] leading-snug text-ink group-hover:text-ink-muted transition-colors">
                    {h.title}
                  </p>
                  <p className="text-[10px] text-ink-muted mt-0.5 flex items-center gap-1">
                    {h.source}
                    <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  {i < headlines.length - 1 && <div className="mt-3.5" />}
                </a>
              ))}
            </div>
          </section>
        )}

      </div>
    </aside>
  );
}
