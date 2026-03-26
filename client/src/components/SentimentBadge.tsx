import { Badge } from './ui/badge';

interface Props {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}

const COLORS = {
  positive: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  negative: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  mixed: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
};

export function SentimentBadge({ sentiment }: Props) {
  const c = COLORS[sentiment];
  return (
    <Badge className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium border-0 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {sentiment}
    </Badge>
  );
}
