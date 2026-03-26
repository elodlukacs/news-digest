import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog,
  CloudSun,
} from 'lucide-react';

export function WeatherIcon({ code, size = 16 }: { code: number; size?: number }) {
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

export function WidgetHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 bg-paper-dark -mx-4 px-4 py-1.5">
      <span className="w-1 h-3 bg-masthead rounded-sm" />
      <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink">{title}</h3>
    </div>
  );
}
