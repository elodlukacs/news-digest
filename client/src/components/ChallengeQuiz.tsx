import { useState, useEffect, useRef } from 'react';
import { Brain, Check, X, Loader2, Sparkles, Flame } from 'lucide-react';
import { API_BASE } from '../config';
import { useGamification } from '../hooks/useGamification';

// Curated subset of the full technique list — tighter odds, better pedagogy.
// Matches the enum used by /api/bias-radar/decode (server/db.js :729-767).
const TECHNIQUES: { value: string; label: string; hint: string }[] = [
  { value: 'fear-mongering',          label: 'Fear-Mongering',       hint: 'Exaggerates danger' },
  { value: 'outrage-bait',            label: 'Outrage Bait',         hint: 'Designed to make you angry' },
  { value: 'false-urgency',           label: 'False Urgency',        hint: 'Manufactured time pressure' },
  { value: 'us-vs-them',              label: 'Us vs. Them',          hint: 'In-group vs. out-group' },
  { value: 'vague-attribution',       label: 'Vague Sourcing',       hint: '"Experts say…"' },
  { value: 'false-dichotomy',         label: 'False Dichotomy',      hint: 'Only two options presented' },
  { value: 'anecdote-as-trend',       label: 'Anecdote as Trend',    hint: 'One story implies a pattern' },
  { value: 'framing-by-omission',     label: 'Framing by Omission',  hint: 'True facts, missing context' },
  { value: 'headline-body-mismatch',  label: 'Headline Mismatch',    hint: 'Headline overclaims the story' },
  { value: 'none',                    label: 'Clean — No Technique', hint: 'Straightforward reporting' },
];

interface DecodeResult {
  technique: string;
  displayName: string;
  evidence: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  confidence: 'high' | 'medium' | 'low' | string;
}

interface ChallengeQuizProps {
  headline: string;
  content: string;
  onClose: () => void;
}

export function ChallengeQuiz({ headline, content, onClose }: ChallengeQuizProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [error, setError] = useState('');
  const [streakSnapshot, setStreakSnapshot] = useState<{ antibodies: number; streak: number; alreadyCompleted: boolean } | null>(null);
  const { completeChallenge } = useGamification();
  const abortRef = useRef<AbortController | null>(null);

  // Closing the quiz mid-request left a pending setResult on an unmounted tree.
  useEffect(() => () => abortRef.current?.abort(), []);

  const isCorrect = !!result && selected === result.technique;
  const chosen = TECHNIQUES.find((t) => t.value === selected);
  const llmPick = result && TECHNIQUES.find((t) => t.value === result.technique);

  async function submit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError('');
    const startedAt = Date.now();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${API_BASE}/bias-radar/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, content }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Lab unreachable (${res.status})`);
      const data: DecodeResult = await res.json();
      setResult(data);

      // Record the guess regardless of outcome — this is the app's
      // highest-frequency exercise and its answers used to go nowhere.
      void fetch(`${API_BASE}/gamification/skill-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'challenge_quiz',
          itemType: data.technique,
          itemRef: headline,
          userAnswer: selected,
          correctAnswer: data.technique,
          correct: selected === data.technique,
          latencyMs: Date.now() - startedAt,
        }),
      }).catch(() => {});

      if (selected === data.technique) {
        try {
          const ch = await completeChallenge(1, 'summary_challenge');
          setStreakSnapshot({
            antibodies: ch?.total_antibodies ?? 0,
            streak: ch?.current_streak ?? 0,
            alreadyCompleted: !!ch?.already_completed,
          });
        } catch {
          // streak is a nice-to-have; never break the reveal
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }

  return (
    <div className="challenge-unfold relative mt-3 md:mt-4">
      {/* Editorial insert — paper within paper, masthead kicker, hairline rules */}
      <div className="relative bg-paper border border-rule shadow-[0_1px_0_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Masthead accent bar */}
        <div
          className="challenge-rule-grow absolute top-0 left-0 right-0 h-[2px] bg-masthead"
          style={{ ['--delay' as string]: '40ms' }}
        />

        {/* Kicker row */}
        <header className="flex items-center justify-between gap-3 px-4 md:px-5 pt-4 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative inline-flex items-center justify-center w-5 h-5 shrink-0">
              <Brain size={14} className="text-masthead" strokeWidth={2.25} />
            </span>
            <span className="text-[10px] uppercase tracking-[0.28em] font-bold text-masthead font-[family-name:var(--font-widget)]">
              Reader's Challenge
            </span>
            <span className="hidden sm:inline text-ink-muted/50 font-[family-name:var(--font-widget)] text-[10px] tracking-[0.2em]">
              № <span className="tabular-nums">{String(Math.abs(hash(headline)) % 999).padStart(3, '0')}</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors -mr-1 p-1 cursor-pointer"
            aria-label="Close challenge"
          >
            <X size={14} />
          </button>
        </header>

        {/* Prompt line */}
        <div className="px-4 md:px-5 pb-3.5">
          <p className="font-serif italic text-[15px] md:text-[16px] leading-snug text-ink">
            {!result
              ? 'Which manipulation technique does this headline use?'
              : isCorrect
              ? 'Nailed it. Here\'s what the lab flagged.'
              : 'Close — but the lab saw something else.'}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-rule/70 mx-4 md:mx-5" />

        {/* ── PICKER ───────────────────────────────────────────────── */}
        {!result && !error && (
          <div className="px-4 md:px-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {TECHNIQUES.map((t, i) => {
                const active = selected === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setSelected(t.value)}
                    className={`challenge-rise group relative text-left px-3 py-2 border transition-all duration-150 cursor-pointer ${
                      active
                        ? 'border-ink bg-ink text-paper shadow-[0_1px_0_var(--color-ink)]'
                        : 'border-rule bg-paper-dark/60 text-ink hover:border-ink-muted hover:bg-paper-dark'
                    }`}
                    style={{ ['--delay' as string]: `${40 + i * 22}ms` }}
                  >
                    <div className="text-[12px] font-semibold font-[family-name:var(--font-widget)] uppercase tracking-[0.04em] leading-tight">
                      {t.label}
                    </div>
                    <div
                      className={`text-[10.5px] mt-0.5 leading-tight font-[family-name:var(--font-widget)] ${
                        active ? 'text-paper/70' : 'text-ink-muted'
                      }`}
                    >
                      {t.hint}
                    </div>
                    {active && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-paper" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3.5 flex items-center justify-between gap-3">
              <span className="text-[10px] text-ink-muted font-[family-name:var(--font-widget)] uppercase tracking-[0.18em]">
                {selected ? 'One shot · no takebacks' : 'Pick one'}
              </span>
              <button
                onClick={submit}
                disabled={!selected || submitting}
                className="px-4 py-2 bg-ink text-paper text-[11px] font-bold uppercase tracking-[0.18em] font-[family-name:var(--font-widget)] disabled:opacity-25 disabled:cursor-not-allowed enabled:hover:bg-masthead transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Decoding…
                  </>
                ) : (
                  <>Lock it in →</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────── */}
        {error && !result && (
          <div className="px-4 md:px-5 py-4">
            <p className="text-[13px] text-accent font-[family-name:var(--font-body)]">
              Couldn't reach the lab — {error}
            </p>
            <button
              onClick={() => setError('')}
              className="mt-2 text-[11px] underline text-ink-muted hover:text-ink cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── RESULT REVEAL ────────────────────────────────────────── */}
        {result && (
          <div className="px-4 md:px-5 py-4">
            {/* Verdict row */}
            <div
              className="challenge-rise flex items-center gap-3 pb-3"
              style={{ ['--delay' as string]: '40ms' }}
            >
              <div
                className={`challenge-stamp flex items-center justify-center w-8 h-8 shrink-0 border-2 ${
                  isCorrect
                    ? 'border-masthead bg-masthead text-paper'
                    : 'border-accent bg-accent text-paper'
                }`}
                style={{ ['--delay' as string]: '60ms' }}
              >
                {isCorrect ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[10px] uppercase tracking-[0.26em] font-bold font-[family-name:var(--font-widget)] ${
                    isCorrect ? 'text-masthead' : 'text-accent'
                  }`}
                >
                  {isCorrect ? 'Antibody earned' : 'Missed it'}
                </div>
                <div className="font-serif text-[17px] md:text-[19px] font-bold text-ink leading-tight truncate">
                  {result.displayName || llmPick?.label || '—'}
                </div>
              </div>
              {isCorrect && streakSnapshot && !streakSnapshot.alreadyCompleted && (
                <div
                  className="challenge-stamp shrink-0 hidden sm:inline-flex items-center gap-1.5 px-2 py-1 bg-masthead/10 border border-masthead/30"
                  style={{ ['--delay' as string]: '220ms' }}
                >
                  <Flame size={11} className="text-masthead" strokeWidth={2.25} />
                  <span className="text-[10px] font-bold text-masthead font-[family-name:var(--font-widget)] uppercase tracking-[0.15em] tabular-nums">
                    Streak {streakSnapshot.streak}
                  </span>
                </div>
              )}
              {isCorrect && streakSnapshot?.alreadyCompleted && (
                <div
                  className="challenge-rise shrink-0 hidden sm:inline-flex items-center gap-1 px-2 py-1"
                  style={{ ['--delay' as string]: '220ms' }}
                >
                  <Sparkles size={11} className="text-masthead/80" />
                  <span className="text-[10px] text-masthead/80 font-[family-name:var(--font-widget)] uppercase tracking-[0.15em]">
                    Today's streak already banked
                  </span>
                </div>
              )}
            </div>

            {/* Your pick vs. lab pick — only when wrong */}
            {!isCorrect && chosen && (
              <div
                className="challenge-rise grid grid-cols-2 gap-2 mb-3"
                style={{ ['--delay' as string]: '140ms' }}
              >
                <MiniVerdictCard label="Your pick" value={chosen.label} tone="muted" />
                <MiniVerdictCard
                  label="Lab pick"
                  value={result.displayName || llmPick?.label || '—'}
                  tone="masthead"
                />
              </div>
            )}

            {/* Evidence pull-quote */}
            {result.evidence && (
              <blockquote
                className="challenge-rise relative pl-4 border-l-2 border-masthead/60 mb-3"
                style={{ ['--delay' as string]: '220ms' }}
              >
                <span
                  aria-hidden
                  className="absolute -left-1.5 -top-2 text-masthead/30 font-serif text-2xl leading-none select-none"
                >
                  "
                </span>
                <p className="font-serif italic text-[14px] text-ink leading-snug [overflow-wrap:anywhere]">
                  {result.evidence}
                </p>
              </blockquote>
            )}

            {/* Explanation */}
            <p
              className="challenge-rise text-[13.5px] text-ink-light leading-relaxed font-[family-name:var(--font-body)]"
              style={{ ['--delay' as string]: '300ms' }}
            >
              {result.explanation}
            </p>

            {/* Meta row */}
            <div
              className="challenge-rise mt-3.5 pt-3 border-t border-rule/60 flex items-center justify-between gap-2"
              style={{ ['--delay' as string]: '380ms' }}
            >
              <div className="flex items-center gap-2 text-[10px] text-ink-muted font-[family-name:var(--font-widget)] uppercase tracking-[0.18em]">
                <MetaChip label="Difficulty" value={result.difficulty} />
                <span className="w-1 h-1 rounded-full bg-ink-muted/50" />
                <MetaChip label="Confidence" value={result.confidence} />
              </div>
              <button
                onClick={onClose}
                className="text-[11px] font-[family-name:var(--font-widget)] uppercase tracking-[0.18em] text-masthead hover:underline cursor-pointer"
              >
                Done →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniVerdictCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'muted' | 'masthead';
}) {
  return (
    <div
      className={`px-3 py-2 border ${
        tone === 'masthead'
          ? 'border-masthead/40 bg-masthead/[0.06]'
          : 'border-rule bg-paper-dark/60'
      }`}
    >
      <div
        className={`text-[9px] uppercase tracking-[0.22em] font-bold font-[family-name:var(--font-widget)] ${
          tone === 'masthead' ? 'text-masthead' : 'text-ink-muted'
        }`}
      >
        {label}
      </div>
      <div className="font-serif text-[14px] font-semibold text-ink leading-tight mt-0.5 truncate">
        {value}
      </div>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}: <span className="text-ink normal-case font-semibold">{value}</span>
    </span>
  );
}

// Stable-ish article number for the "№ 042" flourish — purely cosmetic.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
