export interface RateLimitInfo {
  isRateLimit: boolean;
  waitTime?: string;
  model?: string;
  used?: number;
  limit?: number;
}

export function parseRateLimitError(error: string): RateLimitInfo {
  if (!error.includes('429') && !error.includes('rate_limit')) {
    return { isRateLimit: false };
  }
  const rawTimeMatch = error.match(/try again in ([\d.]+m)?([\d.]+s)?/i);
  const modelMatch = error.match(/model `([^`]+)`/);
  const usedMatch = error.match(/Used (\d+)/);
  const limitMatch = error.match(/Limit (\d+)/);

  return {
    isRateLimit: true,
    waitTime: rawTimeMatch
      ? [
          rawTimeMatch[1]?.replace(/(\d+)m/, '$1 min'),
          rawTimeMatch[2]?.replace(/[\d.]+s/, (s) => `${Math.round(parseFloat(s))} sec`),
        ]
          .filter(Boolean)
          .join(' ')
      : 'a few minutes',
    model: modelMatch?.[1] || 'Unknown',
    used: usedMatch ? parseInt(usedMatch[1]) : undefined,
    limit: limitMatch ? parseInt(limitMatch[1]) : undefined,
  };
}
