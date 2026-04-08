# MindGames Feature Implementation Summary

## Overview

11 gamified disinformation literacy features were implemented across 14 phases. The work spans 7 new server routes, 15+ new React components, 5 new database tables, and 6 LLM prompt templates. All features integrate into the existing MindGames dashboard (Overview, Training, Analysis, Reflection, Reference, Quiz tabs).

## Phase 1: Bug Fixes

### Fixed Missing Tables
- **`narrative_maps`** — was referenced in `server/routes/narrative.js` but had no CREATE TABLE in `db.js`. Would crash at runtime.
- **`disinfo_maps`** — same issue. Also, the POST route never INSERTed results (caching was broken).

### Files Changed
- `server/db.js` — added CREATE TABLE IF NOT EXISTS for both tables + indexes
- `server/routes/disinfo.js` — added INSERT after LLM generation so caching works

---

## Phase 2: Gamification Infrastructure

### New Tables in `server/db.js`
```sql
user_gamification (id, user_id UNIQUE, current_streak, longest_streak, total_antibodies, last_challenge_date, recovery_boosts_used, created_at)
bias_fingerprints (id, user_id, bias_type, susceptibility_score, last_tested_date, UNIQUE(user_id, bias_type))
fallacy_dojo_logs (id, session_id, user_id, fallacy_type, difficulty_tier, success, time_to_identify, created_at)
```

### New Files
- **`server/routes/gamification.js`** — 3 endpoints:
  - `GET /api/gamification/stats` — returns streak, antibodies, dojo stats, completed_today
  - `POST /api/gamification/complete-challenge` — records completion, updates streak (continues if yesterday, resets to 1 otherwise), awards antibodies. Clamps negative values. Prevents double-completion same day.
  - `POST /api/gamification/recovery-boost` — saves a broken streak
- **`client/src/types/gamification.ts`** — `GamificationStats`, `ChallengeResult`, `RecoveryResult`
- **`client/src/hooks/useGamification.ts`** — `useGamification()` hook with `stats`, `loading`, `refresh`, `completeChallenge()`, `useRecoveryBoost()`. Uses AbortController pattern.
- **`server/index.js`** — mounted `/api/gamification`

### Security
- API responses use `sanitizeUser()` to strip internal columns (`id`, `user_id`, `created_at`)
- `antibodiesEarned` clamped to min 1 via `Math.max(1, Math.round(...))`

---

## Phase 3: Daily Thinking Challenge (Enhanced)

### New Files
- **`client/src/features/mindgames/quiz/StreakTracker.tsx`** — 7-day completion calendar + streak/antibody stats bar. Uses `getStreakDays()` to calculate which days in the last 7 were part of the streak (going backwards from last_challenge_date).
- **`client/src/features/mindgames/quiz/RecoveryBoost.tsx`** — orange banner when streak is at risk (not completed today, streak > 0, not yesterday). Shows "Use Recovery Boost" button.

### Modified Files
- **`DailyQuiz.tsx`** — added `onCorrect` callback prop + `rewardedRef` to prevent double-fire. Fixed initial fetch to use AbortController and check `r.ok`.
- **`QuizTab.tsx`** — wires `useGamification` hook. Calls `completeChallenge(3, 'daily_quiz')` on correct answer. Shows StreakTracker + RecoveryBoost above quiz card.

### Flow
1. User reads article → picks technique → Decode analyzes
2. If correct → `onCorrect()` fires once → streak increments
3. StreakTracker shows 7-day calendar with ✓ for streak days
4. If user misses a day → RecoveryBoost banner appears

---

## Phase 4: Emotional Trigger Trainer

### Modified Files
- **`client/src/types/lens.ts`** — added `EmotionalResponse` type: `{ intensity: 1-10, valence: -1 to +1, reaction?: GutCheckReaction }`
- **`client/src/types/index.ts`** — added `EmotionalResponse` export
- **`client/src/features/mindgames/bias-radar/GutCheck.tsx`** — extended with dual mode:
  - Quick mode (existing): only `onComplete` prop → 4 reaction buttons
  - Full mode: `onEmotionalResponse` prop → reaction buttons + intensity slider (1-10) + valence slider (-1 to +1) + "Continue to analysis" button
  - Valence slider uses `Math.round(v * 10) / 10` to fix floating-point precision
- **`client/src/features/mindgames/bias-radar/BiasRadarCompare.tsx`** — existing GutCheck consumer, benefits from enhanced component.

### Backward Compatibility
- BiasRadarCompare still only passes `onComplete` → no sliders shown
- GutCheck `onEmotionalResponse` is optional — only consumers that opt in get the slider flow
- BiasRadarDecode was reverted to original behavior (just renders ForensicPanel directly) — making it a mandatory gate was a UX regression

---

## Phase 5: Manipulation Lab

### Server Changes
- **`server/db.js`** — added `manipulation_lab_campaign` prompt seed
- **`server/routes/inoculation.js`** — 3 new endpoints:
  - `GET /api/inoculation/targets` — returns 6 audience targets (health-parents, political-activists, tech-enthusiasts, seniors, investors, students)
  - `POST /api/inoculation/campaign` — generates campaign round with 2-3 combined techniques targeting a specific audience
  - `POST /api/inoculation/campaign/answer` — scores on precision/recall (F1) × time factor × 100 = Chaos Score

### New Files
- **`client/src/features/mindgames/training/ManipulationLabPanel.tsx`** — full campaign flow:
  1. Select target audience (6 options with known vulnerabilities)
  2. 3 rounds, each with scenario + headline + 2-3 techniques
  3. Identify techniques from checkbox grid
  4. Chaos Score + antibody awards
  5. SVG viral spread animation at end (nodes colored red=infected/green=blocked)

### Modified Files
- `TrainingTab.tsx` — added ManipulationLabPanel above InoculationPanel
- `training/index.ts` — barrel export

---

## Phase 6: Logical Fallacy Dojo

### Server Changes
- **`server/db.js`** — added `fallacy-dojo-generate` prompt seed
- **`server/routes/fallacy-dojo.js`** — 3 endpoints:
  - `POST /api/fallacy-dojo/generate` — generates argument with embedded fallacies (difficulty: beginner/intermediate/expert → 1/2/3 fallacies). Uses 12 randomized topics.
  - `POST /api/fallacy-dojo/answer` — scores fallacy identification (precision/recall), logs each fallacy to `fallacy_dojo_logs`, awards antibodies
  - `GET /api/fallacy-dojo/history` — per-fallacy-type accuracy stats

### New Files
- **`client/src/features/mindgames/analysis/LogicalFallacyDojo.tsx`** — full dojo UI:
  1. Choose difficulty (Beginner/Intermediate/Expert)
  2. Read argument, optional hint
  3. Identify fallacies from 14-option grid
  4. Score + expandable evidence cards showing quote + explanation
  5. Round counter + perfect round tracker

### Modified Files
- `AnalysisTab.tsx` — added LogicalFallacyDojo above ForensicPanel
- `analysis/index.ts` — barrel export

---

## Phase 7: Propagation Simulator (Enhanced)

### Modified Files
- **`client/src/features/mindgames/reference/NarrativeMapPanel.tsx`** — added Simulate mode:
  - Mode toggle (Analyze/Simulate) using same SVG graph
  - Click node to inject narrative (turns red)
  - Spread propagates through connections every 1.2s (weighted probability based on connection weight)
  - Click other nodes to intervene (fact-check block, turns green, has Shield icon)
  - Counter: infected vs blocked
  - After 8 steps → summary with results

### Technical Details
- Uses `simBlockedRef` and `simInfectedRef` (refs) instead of state inside setInterval to avoid stale closure bug
- `simTimeoutRef` tracks the 800ms delayed startSpread call, cleared on reset/unmount
- Bidirectional spread: connections spread both ways with different probabilities

---

## Phase 8: Conspiracy Anatomy Lab

### Server Changes
- **`server/db.js`** — added `conspiracy-anatomy` prompt seed (5-dimension deconstruction)
- **`server/routes/conspiracy-anatomy.js`** — `POST /api/conspiracy-anatomy/analyze`

### New Files
- **`client/src/features/mindgames/reference/ConspiracyAnatomyPanel.tsx`** — 5-dimension analysis:
  - Emotional Need, Kernel of Truth, Logical Leap, Unfalsifiability Trap, Social Function
  - Each scored 1-10 with expandable analysis + color-coded cards
  - Overall vulnerability score bar
  - "Antibody" — how to engage constructively
  - Related conspiracy ecosystems as badges

### Modified Files
- `ReferenceTab.tsx` — added ConspiracyAnatomyPanel at top
- `reference/index.ts` — barrel export

---

## Phase 9: Bias Mirror

### Server Changes
- **`server/db.js`** — added `bias-mirror-generate` prompt seed
- **`server/routes/bias-mirror.js`** — 3 endpoints:
  - `POST /api/bias-mirror/quiz` — returns shuffled subset of 10 hardcoded scenarios (one per bias)
  - `POST /api/bias-mirror/score` — calculates susceptibility per bias (0-10), saves to `bias_fingerprints`
  - `GET /api/bias-mirror/profile` — retrieves saved profile

### Biases Profiled
Confirmation, Anchoring, Availability, Dunning-Kruger, Sunk Cost, Bandwagon, Authority, Negativity, In-Group, Framing

### New Files
- **`client/src/features/mindgames/reflection/BiasMirrorPanel.tsx`** — quiz + SVG radar chart:
  - 10 scenarios, progress bar
  - Loads existing profile on mount
  - SVG radar chart: 10 axes, data polygon, grid rings
  - Score grid with Low/Medium/High labels

### Modified Files
- `ReflectionTab.tsx` — added BiasMirrorPanel at top
- `reflection/index.ts` — barrel export

---

## Phase 10: Source Credibility Lab

### Server Changes
- **`server/db.js`** — added `source-lab-sift` prompt seed
- **`server/routes/source-lab.js`** — `POST /api/source-lab/analyze`

### New Files
- **`client/src/features/mindgames/reference/SourceCredibilityLab.tsx`** — SIFT walkthrough:
  - Paste URL or claim
  - 4 SIFT steps revealed progressively (Stop → Investigate → Find Coverage → Trace Claims)
  - Each step: expandable card with analysis
  - Source credibility meter (1-10)
  - Other outlets found with stance badges (supports/contradicts/neutral)
  - Evidence chain integrity indicator
  - Final verdict + SIFT tips

### Modified Files
- `ReferenceTab.tsx` — added SourceCredibilityLab
- `reference/index.ts` — barrel export

---

## Phase 11: Propaganda Timeline

### Server Changes
- **`server/db.js`** — added `propaganda-timeline` prompt seed
- **`server/routes/propaganda-timeline.js`** — 2 endpoints:
  - `GET /api/propaganda-timeline/eras` — returns era categories
  - `POST /api/propaganda-timeline/generate` — generates 8 historical campaigns with modern parallels

### New Files
- **`client/src/features/mindgames/reference/PropagandaTimeline.tsx`** — custom vertical timeline:
  - Vertical line with dots per campaign
  - Year badge + tactic label
  - Expandable cards: target, outcome, modern parallel with dashed border
  - No external dependency (custom SVG/CSS instead of react-chrono)

### Modified Files
- `ReferenceTab.tsx` — added PropagandaTimeline
- `reference/index.ts` — barrel export

---

## Phase 12: Ask the Manipulator

### Server Changes
- **`server/db.js`** — added `ask-the-manipulator` prompt seed (persona-based system message)
- **`server/routes/manipulator.js`** — 2 endpoints:
  - `GET /api/manipulator/personas` — returns 3 personas
  - `POST /api/manipulator/chat` — generates persona response (not JSON, plain text)

### Personas
1. **Influence Analyst** — former intelligence analyst, studied state-sponsored ops
2. **Troll Farm Operator** — reformed ex-operator, ran 200+ fake accounts
3. **Cognitive Bias Coach** — behavioral psychologist, maps vulnerabilities

### New Files
- **`client/src/features/mindgames/reference/AskTheManipulator.tsx`** — chat UI:
  - Persona selection cards with icons + greetings
  - Chat messages (user right-aligned, assistant left-aligned with persona label)
  - Textarea with Enter-to-send
  - "Switch persona" button to reset
  - Auto-scroll to latest message

### Modified Files
- `ReferenceTab.tsx` — added AskTheManipulator
- `reference/index.ts` — barrel export

---

## Phase 13: Echo Chamber Simulator

### New Files
- **`client/src/features/mindgames/reflection/EchoChamberSimulator.tsx`** — pure frontend, no LLM:
  - 12 hardcoded simulated posts (economy, health, climate, tech topics) with bias ratings
  - User lean selector (left/center/right)
  - Algorithm bias slider (0-100%)
  - Posts colored by political lean, suppressed/dimmed based on distance from user lean × bias strength
  - Stats: visible count, suppressed count, echo score percentage
  - Warning banner when echo score > 50%

### Modified Files
- `ReflectionTab.tsx` — added EchoChamberSimulator below BiasMirrorPanel
- `reflection/index.ts` — barrel export

---

## Phase 14: Integration & Overview

### Modified Files
- **`client/src/features/mindgames/overview/OverviewTab.tsx`**:
  - Added `useGamification` hook integration — StreakTracker shown at top
  - Expanded quick actions from 5 to 10 cards:
    - Today's Challenge (highlighted)
    - Manipulation Lab
    - Bias Mirror
    - Dissect an Article
    - Conspiracy Lab
    - Source Check
    - Ask a Manipulator
    - Propaganda History
    - Reading Mood
    - Think Harder
  - Updated research credits to include Kahneman, Tversky, Caulfield, Douglas

---

## All New API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/gamification/stats` | Streak, antibodies, dojo stats |
| POST | `/api/gamification/complete-challenge` | Record daily completion |
| POST | `/api/gamification/recovery-boost` | Save broken streak |
| GET | `/api/inoculation/targets` | 6 audience targets |
| POST | `/api/inoculation/campaign` | Generate campaign round |
| POST | `/api/inoculation/campaign/answer` | Score campaign answer |
| POST | `/api/fallacy-dojo/generate` | Generate argument with fallacies |
| POST | `/api/fallacy-dojo/answer` | Score fallacy identification |
| GET | `/api/fallacy-dojo/history` | Per-fallacy accuracy stats |
| POST | `/api/conspiracy-anatomy/analyze` | 5-dimension deconstruction |
| POST | `/api/bias-mirror/quiz` | Get quiz questions |
| POST | `/api/bias-mirror/score` | Score and save profile |
| GET | `/api/bias-mirror/profile` | Get saved profile |
| POST | `/api/source-lab/analyze` | SIFT analysis |
| GET | `/api/propaganda-timeline/eras` | Era categories |
| POST | `/api/propaganda-timeline/generate` | Generate timeline |
| GET | `/api/manipulator/personas` | 3 persona descriptions |
| POST | `/api/manipulator/chat` | Persona chat response |

## All New DB Tables

| Table | Purpose |
|-------|---------|
| `user_gamification` | Daily streak tracking, antibodies |
| `bias_fingerprints` | Bias Mirror quiz results (per-bias susceptibility) |
| `fallacy_dojo_logs` | Fallacy Dojo attempt history |
| `narrative_maps` | Cached narrative map analyses (was missing CREATE TABLE) |
| `disinfo_maps` | Cached disinfo map analyses (was missing CREATE TABLE) |

## All New LLM Prompts (in `prompts` table)

| Slug | Purpose |
|------|---------|
| `manipulation_lab_campaign` | Multi-technique campaign round generation |
| `fallacy-dojo-generate` | Argument with embedded fallacies |
| `conspiracy-anatomy` | 5-dimension conspiracy deconstruction |
| `bias-mirror-generate` | Quiz scenario generation |
| `source-lab-sift` | SIFT method analysis |
| `propaganda-timeline` | Historical campaign timeline |
| `ask-the-manipulator` | Persona-based conversation |

## Build Commands

```bash
# Backend (restarts needed after server changes)
cd server && node index.js

# Frontend dev
cd client && npm run dev

# Type-check + build
cd client && npx tsc --noEmit && npm run build
```

## Prompt Manager Locations

Added `PROMPT_LOCATIONS` entries in `client/src/components/PromptManager.tsx` so all 7 new prompts display their UI location (map pin icon) in the AI Prompt Manager (`/prompts`):

| Slug | Location |
|------|----------|
| `manipulation_lab_campaign` | MindGames → Spot It → Manipulation Lab |
| `fallacy-dojo-generate` | MindGames → Dissect → Logical Fallacy Dojo |
| `conspiracy-anatomy` | MindGames → Playbook → Conspiracy Anatomy Lab |
| `bias-mirror-generate` | MindGames → Think Harder → Bias Mirror |
| `source-lab-sift` | MindGames → Playbook → Source Credibility Lab |
| `propaganda-timeline` | MindGames → Playbook → Propaganda Timeline |
| `ask-the-manipulator` | MindGames → Playbook → Ask the Manipulator |

## Forensics Bug Fixes

### Fallacy Explanation Field
- `ForensicFallacy` type in `types/index.ts` had `rationality_gap` field but the LLM returns `explanation`
- `ForensicPanel.tsx` line 396 rendered `f.rationality_gap` which was always empty/undefined
- Fixed to render `f.explanation` instead
- Added `explanation` field to `ForensicFallacy` interface

### Database Prompt Preservation
- The user's existing database has a working `forensic-analysis` prompt that returns `misbelief_funnel` as an object
- The seed prompt in `db.js` used a different format (`funnel_stage` as flat string) — a pre-existing mismatch
- **No change was made to the seed prompt** — it's protected by `if (promptCount.c === 0)` so it never overwrites existing rows
- The `updateInoculationPrompts()` function uses `ON CONFLICT(slug) DO UPDATE` but only for its own slugs, not `forensic-analysis`

## Known Notes

- **react-chrono NOT installed** — PropagandaTimeline uses custom vertical timeline instead
- **react-force-graph NOT installed** — NarrativeMapPanel simulation uses existing SVG with CSS animations
- All components follow existing code conventions (AbortController, single quotes, 2-space indent, import type)
- All server routes use parameterized SQL queries (no injection risks)
- Gamification responses strip internal DB columns (`id`, `user_id`, `created_at`)
- New prompts are inserted via `updateInoculationPrompts()` upsert on every startup — safe for existing databases
- Seed block (`if (promptCount.c === 0)`) only runs on empty prompt tables — new installs get all seeds + upserts
