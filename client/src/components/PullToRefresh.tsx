import { RefreshCw } from 'lucide-react';

interface Props {
  pulling: boolean;
  pullProgress: number;
}

export function PullToRefreshIndicator({ pulling, pullProgress }: Props) {
  if (!pulling && pullProgress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none">
      <div 
        className="bg-paper-dark border-b border-rule px-4 py-2 flex items-center gap-2 transition-all duration-200"
        style={{ 
          transform: `translateY(${pullProgress * 40}px)`,
          opacity: pullProgress,
        }}
      >
        <RefreshCw 
          size={16} 
          className="text-masthead animate-spin" 
        />
        <span className="text-xs text-ink-muted uppercase tracking-wider">
          {pulling ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}
