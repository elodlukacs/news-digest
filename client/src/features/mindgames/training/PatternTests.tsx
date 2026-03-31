import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Progress } from '../../../components/ui/progress';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip';
import {
  Shuffle, GitBranch, AlertCircle, CheckCircle,
  XCircle, HelpCircle, Lightbulb, Target, Eye, RefreshCw, BarChart3,
  Activity, ListChecks
} from 'lucide-react';
import { FeaturePanelHeader } from '../common';

type TestType = 'coincidence' | 'scatter' | 'sequence' | 'correlation';

interface TestResult {
  testType: TestType;
  userAnswer: string;
  correctAnswer: string;
  isPattern: boolean;
  explanation: string;
  educationalNote: string;
}

interface CoincidenceEvent {
  description: string;
  isMeaningful: boolean;
  explanation: string;
}

interface ScatterPoint {
  x: number;
  y: number;
}

interface SequenceTest {
  numbers: number[];
  userPrediction: number | null;
  correctAnswer: number;
  explanation: string;
}

interface CorrelationData {
  xValues: number[];
  yValues: number[];
  correlation: number;
  userExplanation: string;
  correctExplanation: string;
  explanation: string;
}

/* ─── Random generation helpers ─── */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generateCoincidence(): CoincidenceEvent {
  const events: Omit<CoincidenceEvent, 'explanation'>[] = [
    { description: 'Your cousin\'s birthday falls on the same day as a major historical event', isMeaningful: false },
    { description: 'You think of someone, and they call you five minutes later', isMeaningful: false },
    { description: 'Two unrelated people in different cities share the same unusual name', isMeaningful: false },
    { description: 'You dream about a house, then see it listed for sale the next day', isMeaningful: false },
    { description: 'Your lucky number 7 appears 3 times in a single day\'s lottery results', isMeaningful: false },
    { description: 'A stranger in a coffee shop is reading the same book you just finished', isMeaningful: false },
    { description: 'You wake up at exactly 3:33 AM three nights in a row', isMeaningful: false },
    { description: 'The stock market crashes exactly one week after a viral "prediction" post', isMeaningful: false },
    { description: 'You run into your childhood teacher at a random location abroad', isMeaningful: false },
    { description: 'Three unrelated news stories all mention the same obscure word on the same day', isMeaningful: false },
  ];
  const selected = events[randomInt(0, events.length - 1)];
  return {
    ...selected,
    explanation: selected.isMeaningful 
      ? 'This may feel significant, but coincidences happen all the time. With billions of people having millions of experiences daily, unlikely events are certain to occur to someone.'
      : 'This is a classic coincidence. The human brain is wired to find patterns, even in random data. With enough opportunities, "impossible" coincidences become inevitable.'
  };
}

function generateScatterData(): ScatterPoint[] {
  const points: ScatterPoint[] = [];
  for (let i = 0; i < 50; i++) {
    points.push({
      x: randomFloat(0, 100),
      y: randomFloat(0, 100),
    });
  }
  return points;
}

function generateSequence(): { numbers: number[]; answer: number; explanation: string } {
  const patterns = [
    {
      numbers: () => {
        const start = randomInt(1, 20);
        const step = randomInt(2, 9);
        return [start, start + step, start + step * 2, start + step * 3, start + step * 4];
      },
      answer: (nums: number[]) => nums[4] + (nums[1] - nums[0]),
      explanation: 'This appears to follow an arithmetic pattern, but random numbers were inserted between real pattern elements.',
    },
    {
      numbers: () => {
        const start = randomInt(1, 10);
        return [start, start ** 2, start ** 2 + randomInt(1, 5), start ** 2 + randomInt(6, 10), start ** 2 + randomInt(15, 25)];
      },
      answer: () => randomInt(1, 100),
      explanation: 'The first two numbers suggest a square number pattern, but then random variation is introduced. There is no true pattern.',
    },
    {
      numbers: () => {
        const fib = [1, 1];
        for (let i = 2; i < 6; i++) fib.push(fib[i-1] + fib[i-2]);
        return [...fib.slice(0, 4), fib[4] + randomInt(-5, 5)];
      },
      answer: () => randomInt(1, 100),
      explanation: 'The beginning looks like the Fibonacci sequence, but random deviation was added to the last number. Fibonacci sequences rarely occur naturally in unrelated data.',
    },
  ];
  
  const pattern = patterns[randomInt(0, patterns.length - 1)];
  const numbers = pattern.numbers();
  const answer = typeof pattern.answer === 'function' ? pattern.answer(numbers) : pattern.answer;
  
  return { numbers, answer, explanation: pattern.explanation };
}

function generateCorrelation(): CorrelationData {
  const xValues: number[] = [];
  const yValues: number[] = [];
  
  for (let i = 0; i < 30; i++) {
    xValues.push(randomFloat(20, 80));
    yValues.push(randomFloat(20, 80));
  }
  
  const spuriousCorrelations = [
    { xLabel: 'US spending on science, space, and technology', yLabel: 'Suicides by hanging, suffocation, and strangulation', note: 'Both increased over time due to societal trends, not causation.' },
    { xLabel: 'Per-capita cheese consumption', yLabel: 'Number of people who died becoming tangled in bedsheets', note: 'Both are independent trends that happen to show similar growth curves.' },
    { xLabel: 'Age of Miss America winner', yLabel: 'Murders by steam, hot objects, and scalding', note: 'Correlation coefficient: -0.87. Completely unrelated phenomena.' },
    { xLabel: 'Number of lawyers in Puerto Rico', yLabel: 'Per-capita consumption of mozzarella cheese', note: 'Both grew steadily over the same time period. Coincidence.' },
    { xLabel: 'Divorce rate in Maine', yLabel: 'Per-capita consumption of margarine', note: 'Both fluctuated similarly for years. No causal relationship exists.' },
  ];
  
  const selected = spuriousCorrelations[randomInt(0, spuriousCorrelations.length - 1)];
  const correlation = randomFloat(-0.9, -0.7);
  
  return {
    xValues,
    yValues,
    correlation,
    userExplanation: '',
    correctExplanation: selected.note,
    explanation: `The correlation between "${selected.xLabel}" and "${selected.yLabel}" is ${correlation.toFixed(2)}. This is an example of spurious correlation — two variables that move together without any causal relationship. Both are likely driven by unrelated third factors (like time trends) or pure coincidence.`,
  };
}

/* ─── Scatter Plot SVG ─── */

function ScatterPlot({ points, onClick }: { points: ScatterPoint[]; onClick?: (point: ScatterPoint) => void }) {
  const width = 400;
  const height = 300;
  const padding = 40;
  
  const xMin = 0, xMax = 100;
  const yMin = 0, yMax = 100;
  
  const scaleX = (x: number) => padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding);
  const scaleY = (y: number) => height - padding - ((y - yMin) / (yMax - yMin)) * (height - 2 * padding);
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md mx-auto">
      <rect x={padding} y={padding} width={width - 2 * padding} height={height - 2 * padding} fill="var(--color-paper-dark)" stroke="var(--color-rule)" />
      
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <text x={scaleX(tick)} y={height - padding + 20} textAnchor="middle" className="text-[10px] fill-ink-muted">{tick}</text>
          <line x1={scaleX(tick)} y1={padding} x2={scaleX(tick)} y2={height - padding} stroke="var(--color-rule)" strokeDasharray="2,2" />
        </g>
      ))}
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <text x={padding - 10} y={scaleY(tick) + 4} textAnchor="end" className="text-[10px] fill-ink-muted">{tick}</text>
          <line x1={padding} y1={scaleY(tick)} x2={width - padding} y2={scaleY(tick)} stroke="var(--color-rule)" strokeDasharray="2,2" />
        </g>
      ))}
      
      {points.map((point, i) => (
        <circle
          key={i}
          cx={scaleX(point.x)}
          cy={scaleY(point.y)}
          r={5}
          fill="var(--color-curiosity)"
          opacity={0.7}
          className="cursor-pointer hover:opacity-100 hover:r-7 transition-all"
          onClick={() => onClick?.(point)}
        />
      ))}
      
      <text x={width / 2} y={height - 5} textAnchor="middle" className="text-[10px] fill-ink-muted">X Variable</text>
      <text x={10} y={height / 2} textAnchor="middle" transform={`rotate(-90, 15, ${height / 2})`} className="text-[10px] fill-ink-muted">Y Variable</text>
    </svg>
  );
}

/* ─── Correlation Scatter ─── */

function CorrelationScatter({ xValues, yValues }: { xValues: number[]; yValues: number[] }) {
  const width = 400;
  const height = 300;
  const padding = 40;
  
  const xMin = Math.min(...xValues) - 5;
  const xMax = Math.max(...xValues) + 5;
  const yMin = Math.min(...yValues) - 5;
  const yMax = Math.max(...yValues) + 5;
  
  const scaleX = (x: number) => padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding);
  const scaleY = (y: number) => height - padding - ((y - yMin) / (yMax - yMin)) * (height - 2 * padding);
  
  const xMean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
  const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
  
  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < xValues.length; i++) {
    sumXY += (xValues[i] - xMean) * (yValues[i] - yMean);
    sumX2 += (xValues[i] - xMean) ** 2;
    sumY2 += (yValues[i] - yMean) ** 2;
  }
  const r = sumXY / Math.sqrt(sumX2 * sumY2);
  
  const x1 = xMin, x2 = xMax;
  const y1 = yMean + r * Math.sqrt(sumY2 / sumX2) * (x1 - xMean);
  const y2 = yMean + r * Math.sqrt(sumY2 / sumX2) * (x2 - xMean);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <Badge variant="outline" className="text-[10px]">Correlation: {r.toFixed(3)}</Badge>
        <span className="text-ink-muted">
          {r > 0.7 ? 'Strong positive' : r > 0.3 ? 'Moderate positive' : r > -0.3 ? 'Weak' : r > -0.7 ? 'Moderate negative' : 'Strong negative'}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md mx-auto">
        <rect x={padding} y={padding} width={width - 2 * padding} height={height - 2 * padding} fill="var(--color-paper-dark)" stroke="var(--color-rule)" />
        
        {xValues.map((_, i) => (
          <circle
            key={i}
            cx={scaleX(xValues[i])}
            cy={scaleY(yValues[i])}
            r={4}
            fill="var(--color-curiosity)"
            opacity={0.6}
          />
        ))}
        
        <line x1={scaleX(x1)} y1={scaleY(y1)} x2={scaleX(x2)} y2={scaleY(y2)} stroke="var(--color-outrage)" strokeWidth={2} strokeDasharray="5,5" opacity={0.7} />
        
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <text x={scaleX(tick * (xMax - xMin) / 100 + xMin)} y={height - padding + 20} textAnchor="middle" className="text-[9px] fill-ink-muted">
              {Math.round(tick * (xMax - xMin) / 100 + xMin)}
            </text>
          </g>
        ))}
        
        <text x={width / 2} y={height - 5} textAnchor="middle" className="text-[10px] fill-ink-muted">Variable X</text>
        <text x={10} y={height / 2} textAnchor="middle" transform={`rotate(-90, 15, ${height / 2})`} className="text-[10px] fill-ink-muted">Variable Y</text>
      </svg>
    </div>
  );
}

/* ─── Main Component ─── */

export function PatternTests() {
  const [activeTab, setActiveTab] = useState<TestType>('coincidence');
  const [sessionResults, setSessionResults] = useState<TestResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  
  useEffect(() => { return () => abortRef.current?.abort(); }, []);
  
  // Coincidence Test State
  const [currentCoincidence, setCurrentCoincidence] = useState<CoincidenceEvent | null>(null);
  const [coincidenceAnswer, setCoincidenceAnswer] = useState<boolean | null>(null);
  const [coincidenceRevealed, setCoincidenceRevealed] = useState(false);
  
  // Scatter Test State
  const [scatterPoints, setScatterPoints] = useState<ScatterPoint[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [scatterExplanation, setScatterExplanation] = useState('');
  const [scatterRevealed, setScatterRevealed] = useState(false);
  
  // Sequence Test State
  const [currentSequence, setCurrentSequence] = useState<SequenceTest | null>(null);
  const [sequenceInput, setSequenceInput] = useState('');
  const [sequenceRevealed, setSequenceRevealed] = useState(false);
  
  // Correlation Test State
  const [currentCorrelation, setCurrentCorrelation] = useState<CorrelationData | null>(null);
  const [correlationInput, setCorrelationInput] = useState('');
  const [correlationRevealed, setCorrelationRevealed] = useState(false);
  
  const completeTest = useCallback((result: TestResult) => {
    setSessionResults(prev => [...prev, result]);
  }, []);
  
  // Generate new coincidence test
  const newCoincidenceTest = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setCurrentCoincidence(generateCoincidence());
    setCoincidenceAnswer(null);
    setCoincidenceRevealed(false);
  }, []);
  
  // Generate new scatter test
  const newScatterTest = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setScatterPoints(generateScatterData());
    setSelectedRegion(null);
    setScatterExplanation('');
    setScatterRevealed(false);
  }, []);
  
  // Generate new sequence test
  const newSequenceTest = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const seq = generateSequence();
    setCurrentSequence({
      numbers: seq.numbers,
      userPrediction: null,
      correctAnswer: seq.answer,
      explanation: seq.explanation,
    });
    setSequenceInput('');
    setSequenceRevealed(false);
  }, []);
  
  // Generate new correlation test
  const newCorrelationTest = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setCurrentCorrelation(generateCorrelation());
    setCorrelationInput('');
    setCorrelationRevealed(false);
  }, []);
  
  // Reveal coincidence answer
  const revealCoincidence = () => {
    if (!currentCoincidence || coincidenceAnswer === null) return;
    setCoincidenceRevealed(true);
    completeTest({
      testType: 'coincidence',
      userAnswer: coincidenceAnswer ? 'Meaningful pattern' : 'Random coincidence',
      correctAnswer: 'Random coincidence',
      isPattern: false,
      explanation: currentCoincidence.explanation,
      educationalNote: 'Apophenia is the tendency to perceive meaningful patterns in random stimuli. Studies show people dramatically overestimate the likelihood of coincidences, especially when they have personal significance.',
    });
  };
  
  // Reveal scatter answer
  const revealScatter = () => {
    if (!scatterExplanation.trim()) return;
    setScatterRevealed(true);
    completeTest({
      testType: 'scatter',
      userAnswer: scatterExplanation,
      correctAnswer: 'No pattern exists (random scatter)',
      isPattern: false,
      explanation: 'The scatter plot was generated with completely random X and Y coordinates. Any pattern you perceive is a cognitive illusion — apophenia at work.',
      educationalNote: 'The human visual system is so good at finding patterns that we often see them where none exist. This is why scientists use statistical tests rather than visual inspection to determine if patterns are real.',
    });
  };
  
  // Reveal sequence answer
  const revealSequence = () => {
    if (!sequenceInput.trim()) return;
    const prediction = parseInt(sequenceInput, 10);
    if (isNaN(prediction)) return;
    setSequenceRevealed(true);
    completeTest({
      testType: 'sequence',
      userAnswer: sequenceInput,
      correctAnswer: currentSequence!.correctAnswer.toString(),
      isPattern: false,
      explanation: currentSequence!.explanation,
      educationalNote: 'Humans have a strong drive to find patterns in sequences, a trait that served us well in survival situations but can lead us astray with random data. "Seeing" a pattern doesn\'t mean one exists.',
    });
  };
  
  // Reveal correlation answer
  const revealCorrelation = () => {
    if (!correlationInput.trim() || !currentCorrelation) return;
    setCorrelationRevealed(true);
    completeTest({
      testType: 'correlation',
      userAnswer: correlationInput,
      correctAnswer: 'Spurious correlation (no causation)',
      isPattern: false,
      explanation: currentCorrelation.explanation + ' ' + currentCorrelation.correctExplanation,
      educationalNote: 'Spurious correlations were popularized by Tyler Vigen\'s website. They remind us: correlation does not imply causation. Always ask "What third factor might be driving both?" before concluding a relationship is causal.',
    });
  };
  
  // Calculate session stats
  const totalTests = sessionResults.length;
  const patternDetections = sessionResults.filter(r => r.userAnswer.toLowerCase().includes('pattern') || r.userAnswer.toLowerCase().includes('meaningful')).length;
  const accuracyRate = totalTests > 0 ? Math.round(((totalTests - patternDetections) / totalTests) * 100) : 0;
  
  return (
    <Card className="p-5 md:p-6 h-full flex flex-col gap-4">
      <FeaturePanelHeader 
        icon={<Eye size={20} className="text-curiosity shrink-0" />}
        title="Pattern Recognition Tests"
        infoTitle="Pattern Recognition Tests"
        researcher="Dan Ariely · Behavioural Economist"
        summary="Your brain is a pattern-finding machine — so good at it that it finds patterns that don't exist. These tests make that invisible tendency impossible to ignore."
        sections={[
          { heading: 'The Theory: Apophenia', content: 'Humans are pattern-seeking animals who prefer even a bad theory to no theory at all. We see faces in clouds, meaningful sequences in random numbers, and conspiracies in coincidences. This is the cognitive mechanism disinformation directly exploits.' },
          { heading: 'The Illusion of Explanatory Depth', content: 'People believe they understand topics far better than they actually do — until forced to explain the mechanics step by step. Manipulative narratives provide pseudo-explanations that satisfy the brain\'s desire for causality without requiring actual understanding.' },
          { heading: 'Four Tests', items: [
            'Coincidence Test — find the "pattern" in random events, then see the statistical reality',
            'Scatter Plot Test — identify trends in noise, then compare your reading to the data',
            'Sequence Prediction — predict the next number in a random sequence',
            'Correlation Hunt — find connections between unrelated variables',
          ]},
          { heading: 'The Takeaway', content: 'Once you feel your own pattern-hallucination first-hand, you develop a natural scepticism of "creative dot-connecting" in real-world narratives — the backbone of most conspiracy theories.' },
        ]}
        right={totalTests > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Target size={10} />
                {accuracyRate}% resisted false patterns
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="text-[11px]">
              {patternDetections} of {totalTests} tests resulted in detecting patterns that weren't there
            </TooltipContent>
          </Tooltip>
        ) : undefined}
      />
      
      <p className="text-sm text-ink-muted leading-relaxed -mt-1">
        Test your ability to resist apophenia — the tendency to see patterns that don't exist. These exercises demonstrate how easily our brains find meaning in random data.
      </p>
      
      {/* Test Type Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TestType)}>
        <TabsList className="grid grid-cols-4 gap-1 p-1 bg-paper-dark rounded-lg h-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="coincidence" className="text-xs py-2 px-2 data-[state=active]:bg-ink data-[state=active]:text-paper">
                Coincidence
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Recognize random coincidences vs. meaningful patterns</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="scatter" className="text-xs py-2 px-2 data-[state=active]:bg-ink data-[state=active]:text-paper">
                Scatter
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Find patterns in random data distributions</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="sequence" className="text-xs py-2 px-2 data-[state=active]:bg-ink data-[state=active]:text-paper">
                Sequence
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Predict the next number in a sequence</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="correlation" className="text-xs py-2 px-2 data-[state=active]:bg-ink data-[state=active]:text-paper">
                Correlation
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Identify spurious correlations</TooltipContent>
          </Tooltip>
        </TabsList>
        
        {/* ─── Coincidence Test ─── */}
        <TabsContent value="coincidence" className="space-y-3 mt-3">
          {!currentCoincidence ? (
            <div className="text-center py-8 space-y-4">
              <Shuffle size={32} className="mx-auto text-curiosity opacity-60" />
              <div>
                <p className="text-[13px] text-ink font-medium">Coincidence Detection Test</p>
                <p className="text-[11px] text-ink-muted mt-1">You'll be shown an event. Decide: is this a meaningful pattern or a random coincidence?</p>
              </div>
              <Button onClick={newCoincidenceTest} className="gap-2">
                <Shuffle size={14} /> Start Test
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-md bg-paper-dark border border-rule">
                <div className="flex items-start gap-2 mb-2">
                  <HelpCircle size={14} className="text-curiosity mt-0.5 shrink-0" />
                  <p className="text-[13px] text-ink font-medium">Event:</p>
                </div>
                <p className="text-[14px] text-ink leading-relaxed pl-6">{currentCoincidence.description}</p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => setCoincidenceAnswer(true)} 
                  disabled={coincidenceRevealed}
                  className={`flex-1 gap-2 ${coincidenceAnswer === true ? 'bg-outrage text-white' : ''}`}
                  variant={coincidenceAnswer === true ? 'default' : 'outline'}
                >
                  <Lightbulb size={14} /> Meaningful Pattern
                </Button>
                <Button 
                  onClick={() => setCoincidenceAnswer(false)} 
                  disabled={coincidenceRevealed}
                  className={`flex-1 gap-2 ${coincidenceAnswer === false ? 'bg-curiosity text-white' : ''}`}
                  variant={coincidenceAnswer === false ? 'default' : 'outline'}
                >
                  <Shuffle size={14} /> Random Coincidence
                </Button>
              </div>
              
              {coincidenceAnswer !== null && !coincidenceRevealed && (
                <Button onClick={revealCoincidence} className="w-full gap-2">
                  <CheckCircle size={14} /> Reveal Answer
                </Button>
              )}
              
              {coincidenceRevealed && (
                <div className="space-y-3">
                  <div className={`p-3 rounded-md border ${coincidenceAnswer === false ? 'bg-curiosity-muted border-curiosity/30' : 'bg-outrage-muted border-outrage/30'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {coincidenceAnswer === false 
                        ? <CheckCircle size={14} className="text-curiosity" />
                        : <AlertCircle size={14} className="text-outrage" />}
                      <span className="text-[12px] font-semibold text-ink">
                        {coincidenceAnswer === false ? 'Correct!' : 'Not quite...'}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-muted leading-relaxed">{currentCoincidence.explanation}</p>
                  </div>
                  
                  <div className="p-3 rounded-md bg-paper-dark border border-rule">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb size={12} className="text-curiosity" />
                      <span className="text-[11px] font-semibold text-ink uppercase tracking-wider">Why do we see patterns?</span>
                    </div>
                    <p className="text-[11px] text-ink-muted leading-relaxed">{sessionResults[sessionResults.length - 1]?.educationalNote}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={newCoincidenceTest} className="flex-1 gap-2">
                      <RefreshCw size={14} /> Next Event
                    </Button>
                    <Button onClick={() => setActiveTab('scatter')} variant="outline" className="flex-1 gap-2">
                      Next Test Type <BarChart3 size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        
        {/* ─── Scatter Plot Test ─── */}
        <TabsContent value="scatter" className="space-y-3 mt-3">
          {scatterPoints.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <BarChart3 size={32} className="mx-auto text-curiosity opacity-60" />
              <div>
                <p className="text-[13px] text-ink font-medium">Scatter Pattern Test</p>
                <p className="text-[11px] text-ink-muted mt-1">Examine the scatter plot. Describe any pattern or trend you see.</p>
              </div>
              <Button onClick={newScatterTest} className="gap-2">
                <Shuffle size={14} /> Generate Data
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <ScatterPlot points={scatterPoints} />
              
              <div className="text-[11px] text-ink-muted text-center">
                {selectedRegion 
                  ? `Selected region: ${selectedRegion}` 
                  : 'Click on the plot to mark a region, or describe any pattern you see below.'}
              </div>
              
              <textarea
                value={scatterExplanation}
                onChange={(e) => setScatterExplanation(e.target.value)}
                placeholder="Describe any pattern, trend, or relationship you observe..."
                disabled={scatterRevealed}
                className="w-full p-3 text-[12px] border border-rule rounded-md bg-paper-dark resize-none h-20 focus:border-masthead focus:outline-none disabled:opacity-50"
              />
              
              {!scatterRevealed ? (
                <Button onClick={revealScatter} disabled={!scatterExplanation.trim()} className="w-full gap-2">
                  <CheckCircle size={14} /> Reveal Answer
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-md bg-curiosity-muted border border-curiosity/30">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={14} className="text-curiosity" />
                      <span className="text-[12px] font-semibold text-ink">The Truth</span>
                    </div>
                    <p className="text-[12px] text-ink-muted leading-relaxed">
                      The data was <strong>completely random</strong>. Each point's X and Y coordinates were generated independently using random number generation.
                      Any pattern you detected is a cognitive illusion.
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-md bg-paper-dark border border-rule">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb size={12} className="text-curiosity" />
                      <span className="text-[11px] font-semibold text-ink uppercase tracking-wider">The Science</span>
                    </div>
                    <p className="text-[11px] text-ink-muted leading-relaxed">
                      {sessionResults[sessionResults.length - 1]?.educationalNote}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={newScatterTest} className="flex-1 gap-2">
                      <RefreshCw size={14} /> New Data
                    </Button>
                    <Button onClick={() => setActiveTab('sequence')} variant="outline" className="flex-1 gap-2">
                      Next Test <ListChecks size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        
        {/* ─── Sequence Prediction Test ─── */}
        <TabsContent value="sequence" className="space-y-3 mt-3">
          {!currentSequence ? (
            <div className="text-center py-8 space-y-4">
              <ListChecks size={32} className="mx-auto text-curiosity opacity-60" />
              <div>
                <p className="text-[13px] text-ink font-medium">Sequence Prediction Test</p>
                <p className="text-[11px] text-ink-muted mt-1">Given this number sequence, what comes next? Enter your prediction.</p>
              </div>
              <Button onClick={newSequenceTest} className="gap-2">
                <Shuffle size={14} /> Generate Sequence
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-md bg-paper-dark border border-rule text-center">
                <p className="text-[11px] text-ink-muted uppercase tracking-wider mb-2">Sequence</p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {currentSequence.numbers.map((num, i) => (
                    <div key={i} className="relative">
                      <div className="w-12 h-12 rounded-full bg-ink text-paper flex items-center justify-center text-[16px] font-bold font-serif">
                        {num}
                      </div>
                      {i < currentSequence.numbers.length - 1 && (
                        <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-ink-muted">→</span>
                      )}
                    </div>
                  ))}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-curiosity text-curiosity flex items-center justify-center text-[16px] font-bold">
                      ?
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-ink-muted">Next number:</span>
                <input
                  type="number"
                  value={sequenceInput}
                  onChange={(e) => setSequenceInput(e.target.value)}
                  disabled={sequenceRevealed}
                  placeholder="?"
                  className="flex-1 px-3 py-2 text-[14px] border border-rule rounded-md bg-paper-dark text-center font-bold focus:border-masthead focus:outline-none disabled:opacity-50"
                />
              </div>
              
              {!sequenceRevealed ? (
                <Button onClick={revealSequence} disabled={!sequenceInput.trim()} className="w-full gap-2">
                  <CheckCircle size={14} /> Reveal Answer
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className={`p-3 rounded-md border ${parseInt(sequenceInput) === currentSequence.correctAnswer ? 'bg-curiosity-muted border-curiosity/30' : 'bg-paper-dark border-rule'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {parseInt(sequenceInput) === currentSequence.correctAnswer 
                        ? <CheckCircle size={14} className="text-curiosity" />
                        : <XCircle size={14} className="text-ink-muted" />}
                      <span className="text-[12px] font-semibold text-ink">
                        {parseInt(sequenceInput) === currentSequence.correctAnswer 
                          ? 'You found the pattern!' 
                          : `The actual answer was: ${currentSequence.correctAnswer}`}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-muted leading-relaxed">{currentSequence.explanation}</p>
                  </div>
                  
                  <div className="p-3 rounded-md bg-paper-dark border border-rule">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb size={12} className="text-curiosity" />
                      <span className="text-[11px] font-semibold text-ink uppercase tracking-wider">The Science</span>
                    </div>
                    <p className="text-[11px] text-ink-muted leading-relaxed">
                      {sessionResults[sessionResults.length - 1]?.educationalNote}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={newSequenceTest} className="flex-1 gap-2">
                      <RefreshCw size={14} /> Next Sequence
                    </Button>
                    <Button onClick={() => setActiveTab('correlation')} variant="outline" className="flex-1 gap-2">
                      Next Test <Activity size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        
        {/* ─── Correlation Hunt Test ─── */}
        <TabsContent value="correlation" className="space-y-3 mt-3">
          {!currentCorrelation ? (
            <div className="text-center py-8 space-y-4">
              <Activity size={32} className="mx-auto text-curiosity opacity-60" />
              <div>
                <p className="text-[13px] text-ink font-medium">Correlation Hunt</p>
                <p className="text-[11px] text-ink-muted mt-1">Two variables are shown with their correlation. Explain why they might be correlated.</p>
              </div>
              <Button onClick={newCorrelationTest} className="gap-2">
                <Shuffle size={14} /> Generate Data
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <CorrelationScatter xValues={currentCorrelation.xValues} yValues={currentCorrelation.yValues} />
              
              <div className="p-3 rounded-md bg-paper-dark border border-rule">
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  These two variables show a correlation of <strong className="text-ink">{currentCorrelation.correlation.toFixed(3)}</strong>. 
                  What explains this correlation? Is there a causal relationship?
                </p>
              </div>
              
              <textarea
                value={correlationInput}
                onChange={(e) => setCorrelationInput(e.target.value)}
                placeholder="Explain the relationship between these variables..."
                disabled={correlationRevealed}
                className="w-full p-3 text-[12px] border border-rule rounded-md bg-paper-dark resize-none h-20 focus:border-masthead focus:outline-none disabled:opacity-50"
              />
              
              {!correlationRevealed ? (
                <Button onClick={revealCorrelation} disabled={!correlationInput.trim()} className="w-full gap-2">
                  <CheckCircle size={14} /> Reveal Answer
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-md bg-outrage-muted border border-outrage/30">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={14} className="text-outrage" />
                      <span className="text-[12px] font-semibold text-ink">Spurious Correlation!</span>
                    </div>
                    <p className="text-[12px] text-ink-muted leading-relaxed">{currentCorrelation.explanation}</p>
                  </div>
                  
                  <div className="p-3 rounded-md bg-paper-dark border border-rule">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb size={12} className="text-curiosity" />
                      <span className="text-[11px] font-semibold text-ink uppercase tracking-wider">Your Explanation</span>
                    </div>
                    <p className="text-[12px] text-ink-muted leading-relaxed italic">"{correlationInput}"</p>
                  </div>
                  
                  <div className="p-3 rounded-md bg-paper-dark border border-rule">
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch size={12} className="text-curiosity" />
                      <span className="text-[11px] font-semibold text-ink uppercase tracking-wider">The Reality</span>
                    </div>
                    <p className="text-[12px] text-ink-muted leading-relaxed">{currentCorrelation.correctExplanation}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={newCorrelationTest} className="flex-1 gap-2">
                      <RefreshCw size={14} /> New Pair
                    </Button>
                    <Button onClick={() => setActiveTab('coincidence')} variant="outline" className="flex-1 gap-2">
                      Back to Coincidence <Shuffle size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Session Progress */}
      {totalTests > 0 && (
        <div className="pt-3 border-t border-rule space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Session Progress</span>
            <span className="text-[11px] text-ink font-medium">{totalTests} tests completed</span>
          </div>
          <Progress value={Math.min(totalTests * 10, 100)} className="h-1.5" />
          <p className="text-[10px] text-ink-muted text-center">
            {totalTests >= 4 
              ? `You've completed all test types! Recognition rate: ${accuracyRate}% (${totalTests - patternDetections}/${totalTests} correctly identified as random)`
              : `Complete all 4 test types to see your full assessment`}
          </p>
        </div>
      )}
      
      {/* Educational Footer */}
      <div className="p-3 rounded-md bg-paper-dark border border-rule">
        <div className="flex items-start gap-2">
          <Lightbulb size={13} className="text-curiosity mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">About Apophenia</p>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Apophenia is the tendency to perceive meaningful connections in random stimuli. It's an evolutionary adaptation that helped our ancestors spot predators in grass patterns, but it also leads to false beliefs, superstitions, and misreading of data. Scientific thinking requires actively fighting this tendency.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}