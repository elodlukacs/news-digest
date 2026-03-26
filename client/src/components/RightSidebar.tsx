import { RefreshCw, Send, Coffee, Wind, Droplets } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState, useCallback } from 'react';
import { API_BASE } from '../config';
import { formatDate } from '../utils/date';
import { WeatherIcon, WidgetHeader } from './SharedWidgets';
import type { CryptoPrice, HistoryEntry } from '../types';

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

interface Props {
  briefing: { summary: string; generated_at: string; provider?: string } | null;
  briefingLoading: boolean;
  briefingError: string | null;
  onGenerateBriefing: () => void;
  weather: Weather | null;
  crypto: CryptoPrice[];
  rates: Rates | null;
  trending: { tag: string; count: number }[];
  dates: HistoryEntry[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  showArchive: boolean;
}

// Use shared WidgetHeader from SharedWidgets


export function RightSidebar({
  briefing,
  briefingLoading,
  onGenerateBriefing,
  weather,
  crypto,
  rates,
  trending,
  dates,
  selectedDate,
  onSelectDate,
  showArchive,
}: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendBriefingToTelegram = useCallback(async () => {
    setSending(true);
    setSent(false);
    try {
      const resp = await fetch(`${API_BASE}/telegram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: 0 }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.success) setSent(true);
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  }, []);

  return (
    <aside className="w-72 shrink-0 hidden lg:block pt-6 font-widget">
      <div className="sticky top-6 space-y-6">
        {/* Morning Briefing */}
        <section className="bg-paper-dark p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coffee size={14} className="text-masthead" />
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-masthead">Morning Briefing</h3>
          </div>

          {briefing ? (
            <div>
              <div className="text-[12px] leading-relaxed text-ink-light max-h-48 overflow-hidden relative">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1.5 text-[12px] leading-relaxed">{children}</p>,
                    h1: () => null,
                    h2: ({ children }) => <p className="font-bold text-ink text-[12px] mb-1">{children}</p>,
                    h3: ({ children }) => <p className="font-bold text-ink text-[12px] mb-1">{children}</p>,
                    hr: () => <div className="h-px bg-rule my-2" />,
                    a: ({ children }) => <span className="text-masthead">{children}</span>,
                    strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
                    ul: ({ children }) => <ul className="space-y-1 my-1">{children}</ul>,
                    li: ({ children }) => <li className="text-[12px] pl-2 border-l border-rule">{children}</li>,
                  }}
                >
                  {briefing.summary}
                </ReactMarkdown>
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-paper-dark to-transparent" />
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2">
                <span className="text-[9px] text-ink-muted">
                  {new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {briefing.provider && <> &middot; {briefing.provider}</>}
                </span>
                <div className="flex-1" />
                <button
                  onClick={sendBriefingToTelegram}
                  disabled={sending}
                  className="p-1 text-ink-muted hover:text-masthead cursor-pointer transition-colors disabled:opacity-40"
                  title="Send to Telegram"
                >
                  <Send size={10} />
                </button>
                <button
                  onClick={onGenerateBriefing}
                  disabled={briefingLoading}
                  className="p-1 text-ink-muted hover:text-masthead cursor-pointer transition-colors disabled:opacity-40"
                  title="Regenerate"
                >
                  <RefreshCw size={10} className={briefingLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              {sent && <p className="text-[9px] text-masthead mt-1">Sent to Telegram!</p>}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[11px] text-ink-muted italic mb-2">No briefing yet</p>
              <button
                onClick={onGenerateBriefing}
                disabled={briefingLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] font-bold bg-masthead text-white hover:bg-masthead/80 cursor-pointer transition-all disabled:opacity-40"
              >
                <RefreshCw size={9} className={briefingLoading ? 'animate-spin' : ''} />
                Generate
              </button>
            </div>
          )}
        </section>

        {/* Archive */}
        {showArchive && dates.length > 0 && (
          <section>
            <WidgetHeader title="Archive" />
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectDate(null)}
                className={`w-full text-left px-2 py-1.5 text-[12px] cursor-pointer transition-colors
                  ${selectedDate === null ? 'text-masthead font-bold bg-masthead/5' : 'text-ink-muted hover:text-ink'}`}
              >
                Latest
              </button>
              {dates.map((entry) => (
                <button
                  key={entry.date_key}
                  onClick={() => onSelectDate(entry.date_key)}
                  className={`w-full text-left px-2 py-1.5 text-[12px] cursor-pointer transition-colors
                    ${selectedDate === entry.date_key ? 'text-masthead font-bold bg-masthead/5' : 'text-ink-muted hover:text-ink'}`}
                >
                  {formatDate(entry.date_key)}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Weather */}
        {weather && (
          <section>
            <WidgetHeader title="Weather" />
            <div className="flex items-center gap-2.5">
              <WeatherIcon code={weather.code} size={22} />
              <div>
                <p className="text-lg font-semibold text-ink leading-none">{weather.temperature}&deg;</p>
                <p className="text-[10px] text-ink-muted">{weather.condition}</p>
              </div>
              <div className="flex-1" />
              <p className="text-[9px] text-ink-muted uppercase tracking-wider">{weather.location}</p>
            </div>
            <div className="mt-2 flex gap-4 text-[10px] text-ink-muted">
              <span className="flex items-center gap-1"><Wind size={9} /> {weather.wind} km/h</span>
              <span className="flex items-center gap-1"><Droplets size={9} /> {weather.humidity}%</span>
            </div>
            {weather.forecast.length > 0 && (
              <div className="mt-3 pt-3 grid grid-cols-3 gap-2">
                {weather.forecast.map((day) => (
                  <div key={day.date} className="text-center">
                    <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <div className="flex justify-center mb-1 text-ink-muted"><WeatherIcon code={day.code} size={14} /></div>
                    <p className="text-[11px] text-ink font-medium">
                      {day.high}&deg;<span className="text-ink-muted font-normal ml-0.5">{day.low}&deg;</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Crypto */}
        {crypto.length > 0 && (
          <section>
            <WidgetHeader title="Markets" />
            <div className="space-y-1.5">
              {crypto.map((coin) => (
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
          </section>
        )}

        {/* Exchange Rates */}
        {rates && (
          <section>
            <WidgetHeader title="RON Exchange" />
            <div className="space-y-1.5">
              {Object.entries(rates.rates).map(([currency, rate]) => (
                <div key={currency} className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-ink tracking-wider">1 {currency}</span>
                  <span className="text-[12px] font-medium text-ink">
                    {(1 / rate).toFixed(currency === 'HUF' ? 4 : 2)} RON
                  </span>
                </div>
              ))}
              <p className="text-[9px] text-ink-muted pt-0.5">{rates.date}</p>
            </div>
          </section>
        )}

        {/* Trending */}
        {trending.length > 0 && (
          <section>
            <WidgetHeader title="Trending" />
            <div className="flex flex-wrap gap-1.5">
              {trending.slice(0, 10).map((t) => (
                <span
                  key={t.tag}
                  className="px-2 py-0.5 text-[10px] font-medium bg-paper-dark text-ink-muted"
                >
                  {t.tag} <span className="text-ink-muted/50">({t.count})</span>
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
