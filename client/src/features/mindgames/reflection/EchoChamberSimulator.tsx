import { useState, useMemo } from 'react';
import { Card } from '../../../components/ui/card';
import { Slider } from '../../../components/ui/slider';
import { Badge } from '../../../components/ui/badge';
import { Eye, EyeOff, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { FeaturePanelHeader } from '../common';

interface SimPost {
  id: number;
  author: string;
  handle: string;
  content: string;
  bias: 'left' | 'center-left' | 'center' | 'center-right' | 'right';
  likes: number;
  topic: string;
}

const SIMULATED_POSTS: SimPost[] = [
  { id: 1, author: 'Policy Watch', handle: '@policywatch', content: 'New data shows the economy added 250k jobs last month. Unemployment at historic lows.', bias: 'center', likes: 4200, topic: 'economy' },
  { id: 2, author: 'Progressive Voice', handle: '@progvoice', content: 'Job numbers look good on paper, but wages are still stagnant. Corporate profits up 40%. Who benefits?', bias: 'left', likes: 3800, topic: 'economy' },
  { id: 3, author: 'Fiscal Conservative', handle: '@fiscalcon', content: 'Tax cuts are working. GDP growth above expectations. Markets at all-time highs. Pro-business policies deliver results.', bias: 'right', likes: 5100, topic: 'economy' },
  { id: 4, author: 'Health Desk', handle: '@healthdesk', content: 'New study: regular exercise reduces heart disease risk by 30%. Researchers recommend 150 min/week of moderate activity.', bias: 'center', likes: 6200, topic: 'health' },
  { id: 5, author: 'Natural Living', handle: '@naturalliving', content: 'Mainstream medicine ignores what your body can do naturally. Sunlight, clean food, and movement — that\'s the real prescription.', bias: 'center-left', likes: 8900, topic: 'health' },
  { id: 6, author: 'Science Matters', handle: '@scimatters', content: 'Anti-vaxxers are putting children at risk. Peer-reviewed evidence overwhelmingly supports vaccination schedules.', bias: 'center', likes: 3400, topic: 'health' },
  { id: 7, author: 'Climate Central', handle: '@climatecentral', content: 'Global temperatures in 2025 broke records for the 12th consecutive month. Scientists point to accelerating fossil fuel emissions.', bias: 'center-left', likes: 4700, topic: 'climate' },
  { id: 8, author: 'Energy Freedom', handle: '@energyfreedom', content: 'Climate alarmism is destroying jobs. The real crisis is energy poverty. Families can\'t afford to heat their homes.', bias: 'right', likes: 7200, topic: 'climate' },
  { id: 9, author: 'Tech Insider', handle: '@techinsider', content: 'AI regulation debate heats up. Some say guardrails will kill innovation; others say without them, we\'re building our own replacement.', bias: 'center', likes: 5500, topic: 'tech' },
  { id: 10, author: 'Freedom First', handle: '@freedomfirst', content: 'Government wants to regulate AI the same way they regulated the internet — by controlling what you can see and say.', bias: 'right', likes: 9100, topic: 'tech' },
  { id: 11, author: 'Workers United', handle: '@workersunited', content: 'Gig economy companies posting record profits while workers get zero benefits. Time for a new labor movement.', bias: 'left', likes: 6800, topic: 'economy' },
  { id: 12, author: 'Market Daily', handle: '@marketdaily', content: 'Cryptocurrency adoption surging in developing nations. Banking the unbanked without government middlemen.', bias: 'center-right', likes: 4300, topic: 'economy' },
];

const BIAS_POSITIONS: Record<string, number> = {
  'left': 0,
  'center-left': 1,
  'center': 2,
  'center-right': 3,
  'right': 4,
};

const BIAS_COLORS: Record<string, string> = {
  'left': 'bg-blue-500',
  'center-left': 'bg-blue-300',
  'center': 'bg-gray-400',
  'center-right': 'bg-red-300',
  'right': 'bg-red-500',
};

export function EchoChamberSimulator() {
  const [biasLevel, setBiasLevel] = useState(50);
  const [userLean, setUserLean] = useState<'left' | 'center' | 'right'>('center');

  const feed = useMemo(() => {
    const userPos = BIAS_POSITIONS[userLean === 'left' ? 'left' : userLean === 'right' ? 'right' : 'center'];
    const suppressionStrength = biasLevel / 100;

    return SIMULATED_POSTS.map(post => {
      const postPos = BIAS_POSITIONS[post.bias];
      const distance = Math.abs(postPos - userPos);
      const suppressionChance = distance * 0.25 * suppressionStrength;
      const suppressed = Math.random() < suppressionChance;
      const dimmed = !suppressed && distance >= 2 && suppressionStrength > 0.3;

      return {
        ...post,
        suppressed,
        dimmed,
        effectiveLikes: suppressed
          ? Math.round(post.likes * (1 - suppressionStrength * 0.8))
          : post.likes,
      };
    }).sort((a, b) => {
      if (a.suppressed && !b.suppressed) return 1;
      if (!a.suppressed && b.suppressed) return -1;
      return b.effectiveLikes - a.effectiveLikes;
    });
  }, [biasLevel, userLean]);

  const visibleCount = feed.filter(p => !p.suppressed).length;
  const suppressedCount = feed.filter(p => p.suppressed).length;
  const echoScore = Math.round((suppressedCount / feed.length) * 100);

  return (
    <Card className="p-5 md:p-6 flex flex-col gap-4">
      <FeaturePanelHeader
        icon={<Users size={20} className="text-outrage shrink-0" />}
        title="Echo Chamber Simulator"
        infoTitle="Echo Chamber Simulator"
        researcher="Eli Pariser · Cass Sunstein"
        summary="Watch what happens when an algorithm optimizes for engagement. Slide the bias control to see how opposing views get suppressed, dimmed, or buried."
        sections={[
          { heading: 'How It Works', content: 'This simulates a social media feed. Posts are color-coded by political lean. The algorithm bias slider controls how aggressively opposing views are suppressed — pushed down, dimmed, or hidden entirely.' },
          { heading: 'What To Watch', content: 'Notice how at high bias levels, your feed becomes an echo chamber — only showing content that confirms your existing views. This is what real engagement algorithms do, but invisibly.' },
        ]}
      />

      {/* User lean selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-muted">Your lean:</span>
        <div className="flex rounded-lg border border-rule overflow-hidden">
          {(['left', 'center', 'right'] as const).map(lean => (
            <button
              key={lean}
              onClick={() => setUserLean(lean)}
              className={`px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer capitalize ${
                userLean === lean
                  ? `${lean === 'left' ? 'bg-blue-500' : lean === 'right' ? 'bg-red-500' : 'bg-gray-500'} text-white`
                  : 'bg-paper text-ink-muted hover:bg-paper-dark'
              }`}
            >
              {lean}
            </button>
          ))}
        </div>
      </div>

      {/* Bias slider */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-ink-muted">
          <span>No algorithmic bias</span>
          <span className="font-semibold text-ink">Algorithm bias: {biasLevel}%</span>
          <span>Maximum echo chamber</span>
        </div>
        <Slider
          value={[biasLevel]}
          onValueChange={([v]) => setBiasLevel(v)}
          min={0}
          max={100}
          step={5}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1"><Eye size={12} /> {visibleCount} visible</span>
        <span className="flex items-center gap-1"><EyeOff size={12} /> {suppressedCount} suppressed</span>
        <Badge variant={echoScore > 40 ? 'destructive' : 'outline'} className="text-[10px]">
          Echo score: {echoScore}%
        </Badge>
      </div>

      {echoScore > 50 && (
        <div className="p-2.5 rounded-lg bg-outrage-muted border border-outrage/20 text-xs text-outrage flex items-center gap-2">
          <AlertTriangle size={13} />
          Strong echo chamber detected. Most opposing views are hidden.
        </div>
      )}

      {/* Simulated feed */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {feed.map(post => (
          <div
            key={post.id}
            className={`p-3 rounded-lg border transition-all duration-500 ${
              post.suppressed
                ? 'border-rule/30 bg-paper-dark/30 opacity-20 scale-95'
                : post.dimmed
                  ? 'border-rule/50 bg-paper-dark opacity-60'
                  : 'border-rule bg-paper hover:border-ink-muted'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{post.author}</span>
                <span className="text-xs text-ink-muted">{post.handle}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${BIAS_COLORS[post.bias]}`} title={post.bias} />
                <span className="text-[10px] text-ink-muted flex items-center gap-0.5">
                  <TrendingUp size={10} /> {post.suppressed ? post.effectiveLikes : post.likes}
                </span>
              </div>
            </div>
            <p className="text-sm text-ink leading-relaxed">{post.content}</p>
            {post.suppressed && (
              <p className="text-[10px] text-outrage mt-1 italic">Suppressed by algorithm</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
