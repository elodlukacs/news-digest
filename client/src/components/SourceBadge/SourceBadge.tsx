import { Newspaper } from 'lucide-react';
import { useState } from 'react';
import { extractDomain, getFaviconUrl } from './sourceBadge.utils';

interface SourceBadgeProps {
  source?: string;
  url?: string;
  className?: string;
}

export function SourceBadge({ source, url, className = '' }: SourceBadgeProps) {
  const [iconError, setIconError] = useState(false);
  const domain = url ? extractDomain(url) : null;
  const faviconUrl = domain ? getFaviconUrl(domain) : null;
  const displayName = source || domain || 'Unknown';

  return (
    <span className={`inline-flex items-center gap-1.5 leading-none ${className}`}>
      {faviconUrl && !iconError ? (
        <img
          src={faviconUrl}
          alt=""
          className="w-5 h-5 rounded-sm object-contain align-middle"
          onError={() => setIconError(true)}
          loading="lazy"
        />
      ) : (
        <Newspaper size={20} className="text-ink-muted/50 shrink-0" />
      )}
      <span className="align-middle font-medium">{displayName}</span>
    </span>
  );
}
