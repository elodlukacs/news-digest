# Spot the Trick — Full Technical Report

## Theoretical Foundation

Based on **Professor Sander van der Linden's Psychological Inoculation Theory** (Cambridge University). The core premise: like a vaccine, users are exposed to "weakened" doses of manipulation tactics so their minds build immunity before encountering real disinformation. Validated across 5,061 participants across multiple cultures.

## Architecture Overview

```
Frontend (React)                    Backend (Express)                  LLM Provider
┌─────────────────────┐            ┌────────────────────┐             ┌──────────────┐
│ InoculationPanel.tsx │──POST─────▶│ inoculation.js     │──callLLM──▶│ Groq (primary│
│ (2 modes)           │           │  /generate          │             │ OpenRouter   │
│  • Catch It         │◀─JSON─────│  /answer            │◀──JSON─────│  fallback)   │
│  • Write It Yourself│──POST─────│  /craft             │──callLLM──▶│              │
│                      │           │  /tactics (static)  │◀──JSON─────│              │
│                      │──GET──────│  /sessions          │             └──────────────┘
└─────────────────────┘            └──────┬─────────────┘
                                          │
                                   ┌──────▼─────────────┐
                                   │ SQLite              │
                                   │ • prompts table     │
                                   │ • inoculation_sessions│
                                   │ • cognitive_users   │
                                   │ • llm_usage         │
                                   └────────────────────┘
```

---

## Two Game Modes

### Mode 1: "Catch It" (Detective Mode)

**Flow:**
1. User enters a topic (e.g., "vaccines", "climate", "elections")
2. Backend fetches prompt `inoculation-twister` from DB, renders `{{level}}` variable
3. LLM generates 3 headlines — one per tactic (Trolling, Emotional, Conspiracy)
4. Backend randomly picks one as the "target" and returns all 3 + target index
5. User identifies which headline uses the target tactic
6. Correct = +10 points. 30 points = level up

**Prompt (`inoculation-twister`):**
```
You are a specialized "Twister" agent based on Sander van der Linden's Inoculation
Theory. Your goal is to help users develop resistance to misinformation by exposing
them to "weakened" manipulation tactics.

Given the topic, generate 3 social media headlines using different manipulation tactics:
1. Headline A (Trolling): Deliberately provoke an emotional reaction through
   "whataboutism" or insults.
2. Headline B (Emotional Manipulation): Use high-outrage, fear-inducing language.
3. Headline C (Conspiracy): Suggest a secret organization is behind the event.

The tactics must be visible enough that a learning user can identify the flaw.

Return JSON: [{"tactic": "string", "headline": "string", "flaw_explanation": "string"}]

Level: {{level}}
```

**Level variable values:**
| Level | `{{level}}` renders as |
|-------|------------------------|
| `trolling` | Focus on trolling tactics: whataboutism, insults, deliberate provocation. |
| `emotional` | Focus on emotional manipulation: fear, outrage, anger. |
| `amplification` | Focus on artificial amplification: fake consensus, bandwagon appeals. |
| `escalation` | Use advanced multi-layered manipulation combining all tactics. |

**Level progression:** Trolling → Emotional → Amplification → Escalation (unlocked at 30pts each)

### Mode 2: "Write It Yourself" (CDO Mode)

**Flow:**
1. User enters a topic + selects 1 of 6 manipulation tactics
2. Backend fetches prompt `inoculation-cdo` from DB
3. LLM generates: neutral headline, manipulated headline, psychological mechanism, red flags
4. Side-by-side comparison displayed to user

**Prompt (`inoculation-cdo`):**
```
You are the "Twister" agent based on Sander van der Linden's Inoculation Theory.
A user is playing the role of a disinformation operator to understand how manipulation
works from the inside. This is a controlled educational exercise.

Given a topic and a chosen manipulation tactic, you will:
1. Write a neutral, factual headline about the topic
2. Show how that same topic gets weaponized using the chosen tactic
3. Explain the psychological mechanism being exploited
4. List 2-3 specific red flags a careful reader would notice

The goal is that by PRODUCING manipulation the user builds resistance to it.

Return JSON:
{
  "neutral_headline": "string",
  "manipulated_headline": "string",
  "mechanism": "string — what psychological button this presses and why it works",
  "red_flags": ["string", "string"]
}
```

**Available tactics (hardcoded in `server/routes/inoculation.js:98-105`):**
| Tactic ID | Label | Description |
|-----------|-------|-------------|
| `emotional` | Emotional Manipulation 🔥 | High-outrage, fear-inducing language that bypasses rational thinking |
| `trolling` | Trolling 🎭 | Deliberate provocation, whataboutism, insults to derail discussion |
| `conspiracy` | Conspiracy Construction 🕵️ | Suggesting a secret organization is behind the event |
| `impersonation` | Impersonation 🎪 | Mimicking credible sources or authorities to borrow their trust |
| `polarization` | Polarizing Audiences ⚡ | Reframing neutral topics as divisive intergroup conflicts |
| `amplification` | Artificial Amplification 📢 | Creating illusion of consensus with fake social proof and bandwagon appeals |

---

## LLM Configuration

| Parameter | Value |
|-----------|-------|
| Primary provider | Groq (`openai/gpt-oss-20b`) |
| Fallback provider | OpenRouter (`minimax/minimax-m2.7`) |
| Temperature | 0.7 (both modes) |
| Response format | `{ type: 'json_object' }` (forced JSON) |
| Max tokens | 8192 (default) |
| System message | None (both prompts put everything in user message) |

---

## Database Schema

```sql
-- User profile
cognitive_users (
  id TEXT PRIMARY KEY,
  rethinking_score INTEGER DEFAULT 0,
  inoculation_level INTEGER DEFAULT 0,
  created_at TEXT
)

-- Game sessions
inoculation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT 'default',
  level TEXT NOT NULL DEFAULT 'trolling',  -- trolling|emotional|amplification|escalation
  score INTEGER DEFAULT 0,
  choices TEXT DEFAULT '[]',               -- {targetIndex} then array of {selectedIndex, correct, points}
  completed INTEGER DEFAULT 0,
  created_at TEXT
)

-- LLM prompts (editable at runtime via PromptManager)
prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,               -- 'inoculation-twister', 'inoculation-cdo'
  name TEXT NOT NULL,
  category TEXT NOT NULL,                  -- 'mindgames'
  system_message TEXT,
  user_prompt TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
)
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/routes/inoculation.js` | All 4 API endpoints + CDO tactics array |
| `server/lib/promptManager.js` | DB-backed prompt retrieval + `{{variable}}` rendering |
| `server/lib/llm.js` | LLM abstraction with Groq→OpenRouter fallback + usage logging |
| `server/lib/parseJSON.js` | JSON repair for malformed LLM responses |
| `server/db.js:356-398` | Prompt seed data (both prompts) |
| `client/src/features/mindgames/training/InoculationPanel.tsx` | Full UI component (560 lines) |
| `client/src/features/mindgames/training/TrainingTab.tsx` | Parent tab wrapper |
| `client/src/types/index.ts:206-219` | `InoculationHeadline` and `InoculationSession` types |

---

## Identified Issues & Improvement Opportunities

1. **Prompt mismatch with level system**: The `inoculation-twister` prompt hardcodes 3 tactics (Trolling, Emotional, Conspiracy) but the level system has 4 levels including "Amplification" and "Escalation" — the prompt doesn't adapt its tactic instructions per level, only the `{{level}}` suffix is appended.

2. **CDO tactics ≠ Catch It tactics**: The CDO mode offers 6 tactics (including Impersonation, Polarization) but Catch It mode only generates Trolling/Emotional/Conspiracy — inconsistency in the learning experience.

3. **No system message**: Both prompts have empty system messages. Adding a system message with output format constraints could improve JSON reliability.

4. **Random target selection**: In Catch It mode, `targetIndex` is `Math.floor(Math.random() * headlines.length)` — the target headline is random, not tied to the current level's focus tactic.

5. **No topic injection in CDO prompt**: The CDO prompt doesn't have a `{{topic}}` or `{{tactic}}` template variable — these are passed in the user message instead, which means the prompt template in DB doesn't fully drive the behavior.

6. **Score doesn't reset**: The `rethinking_score` in `cognitive_users` only increments — there's no decay or reset mechanism for returning users.

7. **No difficulty scaling within levels**: Within a level, all rounds have the same difficulty. The prompt could include hints about making tactics more or less obvious based on score.

---

*Report generated: 2026-04-01*
