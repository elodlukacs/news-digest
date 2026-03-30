import { useState } from 'react';
import { Brain, AlertTriangle, Zap, Clock, Coffee, MessageSquare, ChevronRight, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Slider } from '../../../components/ui/slider';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DiagnosticAnswers {
  stressLevel: number;
  emotionalState: string;
  confidence: number;
  tiredness: number;
  mediaTrust: string;
  sleepHours: number;
}

type RiskLevel = 'Low' | 'Medium' | 'High';

const EMOTIONAL_STATES = [
  { value: 'anxious', label: 'Anxious', color: 'var(--color-outrage)' },
  { value: 'angry', label: 'Angry', color: 'var(--color-outrage)' },
  { value: 'sad', label: 'Sad', color: 'var(--color-observation)' },
  { value: 'neutral', label: 'Neutral', color: 'var(--color-ink-muted)' },
  { value: 'happy', label: 'Happy', color: 'var(--color-curiosity)' },
  { value: 'hopeful', label: 'Hopeful', color: 'var(--color-curiosity)' },
];

const MEDIA_TRUST_LEVELS = [
  { value: 'distrust', label: 'Distrust most sources' },
  { value: 'skeptical', label: 'Skeptical of mainstream' },
  { value: 'neutral', label: 'Neutral / Depends on topic' },
  { value: 'trusting', label: 'Generally trusting' },
  { value: 'trust_all', label: 'Trust most sources' },
];

const EMOTION_ICONS: Record<string, string> = {
  anxious: '😰',
  angry: '😠',
  sad: '😢',
  neutral: '😐',
  happy: '😊',
  hopeful: '🌟',
};

function calculateRiskScore(answers: DiagnosticAnswers): { score: number; level: RiskLevel } {
  const certainty = answers.confidence;
  const score = (answers.stressLevel * 0.3) + (answers.tiredness * 0.2) + (certainty * 0.3) - (answers.sleepHours * 0.1);
  let level: RiskLevel = 'Low';
  if (score >= 4) level = 'High';
  else if (score >= 2.5) level = 'Medium';
  return { score: Math.round(score * 10) / 10, level };
}

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'Low': return 'var(--color-curiosity)';
    case 'Medium': return 'var(--color-outrage)';
    case 'High': return 'var(--color-accent)';
  }
}

function getWarnings(answers: DiagnosticAnswers, level: RiskLevel): string[] {
  const warnings: string[] = [];
  if (answers.stressLevel >= 7) warnings.push('High stress may cause you to interpret neutral information as threatening or hostile.');
  if (answers.tiredness >= 7) warnings.push('Fatigue reduces your ability to detect manipulation and think critically.');
  if (answers.confidence >= 8 && answers.emotionalState !== 'neutral') {
    warnings.push('High certainty combined with emotional arousal is a red flag for confirmation bias.');
  }
  if (answers.emotionalState === 'angry') warnings.push('Anger activates fight-or-flight thinking, making you more susceptible to outrage-bait.');
  if (answers.emotionalState === 'anxious') warnings.push('Anxiety makes you more likely to accept simple narratives over complex truths.');
  if (answers.mediaTrust === 'distrust') warnings.push('Extreme distrust can lead you to dismiss accurate information and believe conspiracy narratives.');
  if (level === 'High') warnings.push('Your current state is not ideal for nuanced news consumption. Consider a short break first.');
  return warnings;
}

function getTips(answers: DiagnosticAnswers, level: RiskLevel): string[] {
  const tips: string[] = [];
  tips.push('Start with fact-checking sites before reading opinion pieces.');
  if (answers.stressLevel >= 5) tips.push('Take 3 slow breaths before reading. It activates your prefrontal cortex.');
  if (answers.tiredness >= 5) tips.push('Consider bookmarking this article for when you\'re more alert.');
  if (answers.confidence >= 7) tips.push('Try to approach headlines as a skeptic, even if they align with your views.');
  if (answers.emotionalState === 'angry' || answers.emotionalState === 'anxious') {
    tips.push('Emotional content is designed to bypass your rational mind. Pause before reacting.');
  }
  if (answers.mediaTrust === 'distrust' || answers.mediaTrust === 'skeptical') {
    tips.push('Focus on factual outlets (AP, Reuters) rather than opinion-heavy sources for now.');
  }
  if (level === 'High') tips.push('Consider starting with a brief walk or some water before engaging with complex topics.');
  return tips;
}

function getSuggestions(answers: DiagnosticAnswers): Array<{ icon: React.ReactNode; text: string }> {
  const suggestions: Array<{ icon: React.ReactNode; text: string }> = [];
  if (answers.emotionalState === 'anxious' || answers.emotionalState === 'sad') {
    suggestions.push({ icon: <Coffee size={14} />, text: 'Gentle news only — local and positive stories first' });
  }
  if (answers.stressLevel >= 6) {
    suggestions.push({ icon: <Clock size={14} />, text: 'Set a 10-minute timer to avoid rabbit-hole reading' });
  }
  if (answers.tiredness >= 6) {
    suggestions.push({ icon: <Zap size={14} />, text: 'Save investigative pieces for your peak energy hours' });
  }
  if (answers.mediaTrust === 'trust_all') {
    suggestions.push({ icon: <AlertTriangle size={14} />, text: 'Cross-reference headlines with 2-3 other outlets' });
  }
  return suggestions;
}

export function StressDiagnostic({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<'quiz' | 'results'>('quiz');
  const [answers, setAnswers] = useState<DiagnosticAnswers>({
    stressLevel: 5,
    emotionalState: 'neutral',
    confidence: 5,
    tiredness: 5,
    mediaTrust: 'neutral',
    sleepHours: 7,
  });

  const { score, level } = calculateRiskScore(answers);

  const handleReset = () => {
    setStep('quiz');
    setAnswers({
      stressLevel: 5,
      emotionalState: 'neutral',
      confidence: 5,
      tiredness: 5,
      mediaTrust: 'neutral',
      sleepHours: 7,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Brain size={20} className="text-masthead" />
            <DialogTitle className="font-serif text-xl">Stress & Bias Check</DialogTitle>
          </div>
          <DialogDescription className="text-[11px]">
            Based on research by Taber & Lodge (motivated reasoning) and Stanovich (cognitive reflection).
            Your responses stay private — no data is sent to any server.
          </DialogDescription>
        </DialogHeader>

        {step === 'quiz' ? (
          <div className="space-y-5 py-2">
            <p className="text-[11px] text-ink-muted italic">
              Answer honestly. This is a self-check tool, not a judgment.
            </p>

            {/* Question 1: Stress Level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                  <Zap size={13} className="text-outrage" />
                  How stressed do you feel right now?
                </label>
                <span className="text-[11px] font-bold text-masthead">{answers.stressLevel}/10</span>
              </div>
              <Slider
                value={[answers.stressLevel]}
                onValueChange={(v) => setAnswers(a => ({ ...a, stressLevel: v[0] }))}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-[9px] text-ink-muted">
                <span>Calm</span>
                <span>Very stressed</span>
              </div>
            </div>

            {/* Question 2: Emotional State */}
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                <MessageSquare size={13} className="text-observation" />
                What is your current emotional state?
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {EMOTIONAL_STATES.map((state) => (
                  <button
                    key={state.value}
                    type="button"
                    onClick={() => setAnswers(a => ({ ...a, emotionalState: state.value }))}
                    className={`py-2 px-2 text-[11px] rounded border transition-all ${
                      answers.emotionalState === state.value
                        ? 'border-masthead bg-paper-dark font-semibold'
                        : 'border-rule hover:border-ink-muted'
                    }`}
                  >
                    <span className="mr-1">{EMOTION_ICONS[state.value]}</span>
                    {state.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question 3: Confidence */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-ink">
                  How confident are you in your current beliefs?
                </label>
                <span className="text-[11px] font-bold text-masthead">{answers.confidence}/10</span>
              </div>
              <Slider
                value={[answers.confidence]}
                onValueChange={(v) => setAnswers(a => ({ ...a, confidence: v[0] }))}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-[9px] text-ink-muted">
                <span>Questioning</span>
                <span>Very certain</span>
              </div>
            </div>

            {/* Question 4: Tiredness */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                  <Clock size={13} className="text-curiosity" />
                  How tired are you right now?
                </label>
                <span className="text-[11px] font-bold text-masthead">{answers.tiredness}/10</span>
              </div>
              <Slider
                value={[answers.tiredness]}
                onValueChange={(v) => setAnswers(a => ({ ...a, tiredness: v[0] }))}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-[9px] text-ink-muted">
                <span>Fully alert</span>
                <span>Exhausted</span>
              </div>
            </div>

            {/* Question 5: Media Trust */}
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-ink">
                How much do you trust mainstream media?
              </label>
              <div className="space-y-1">
                {MEDIA_TRUST_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setAnswers(a => ({ ...a, mediaTrust: level.value }))}
                    className={`w-full text-left py-2 px-3 text-[11px] rounded border transition-all ${
                      answers.mediaTrust === level.value
                        ? 'border-masthead bg-paper-dark font-medium'
                        : 'border-rule hover:border-ink-muted'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question 6: Sleep */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                  <Coffee size={13} className="text-masthead" />
                  Hours of sleep last night?
                </label>
                <span className="text-[11px] font-bold text-masthead">{answers.sleepHours}h</span>
              </div>
              <Slider
                value={[answers.sleepHours]}
                onValueChange={(v) => setAnswers(a => ({ ...a, sleepHours: v[0] }))}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-[9px] text-ink-muted">
                <span>1h</span>
                <span>10h</span>
              </div>
            </div>

            <Button onClick={() => setStep('results')} className="w-full mt-4 gap-2">
              Analyze My State
              <ChevronRight size={14} />
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Risk Score Display */}
            <div className="text-center py-4 border-y border-rule">
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">Motivated Reasoning Risk</p>
              <div className="flex items-center justify-center gap-3">
                <span
                  className="text-4xl font-serif font-black"
                  style={{ color: getRiskColor(level) }}
                >
                  {level}
                </span>
                <div className="text-left">
                  <p className="text-2xl font-bold text-ink">{score}</p>
                  <p className="text-[9px] text-ink-muted">out of 10</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="mt-2 text-[10px]"
                style={{ borderColor: getRiskColor(level), color: getRiskColor(level) }}
              >
                {level === 'Low' ? 'OK to proceed with awareness' : level === 'Medium' ? 'Proceed with caution' : 'Consider taking a break first'}
              </Badge>
            </div>

            {/* Warnings */}
            {getWarnings(answers, level).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-accent flex items-center gap-1">
                  <AlertTriangle size={11} />
                  Warnings
                </p>
                <div className="space-y-1.5">
                  {getWarnings(answers, level).map((warning, i) => (
                    <p key={i} className="text-[11px] text-ink-light leading-relaxed pl-3 border-l-2 border-accent/40">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-curiosity flex items-center gap-1">
                <Brain size={11} />
                Tips for Clearer Thinking
              </p>
              <div className="space-y-1.5">
                {getTips(answers, level).map((tip, i) => (
                  <p key={i} className="text-[11px] text-ink-light leading-relaxed pl-3 border-l-2 border-curiosity/40">
                    {tip}
                  </p>
                ))}
              </div>
            </div>

            {/* Suggestions */}
            {getSuggestions(answers).length > 0 && (
              <Card className="bg-paper-dark/50">
                <CardContent className="p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-masthead">Recommended Approach</p>
                  {getSuggestions(answers).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-ink-light">
                      <span className="mt-0.5 text-masthead">{s.icon}</span>
                      <span>{s.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Button onClick={handleReset} variant="outline" className="w-full mt-2 gap-2">
              <RefreshCw size={13} />
              Retake Check
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StressDiagnosticTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-[11px] gap-1.5 text-ink-muted hover:text-ink"
    >
      <Brain size={13} />
      Stress Check
    </Button>
  );
}
