# Agent Instructions

## Project Overview

Monorepo: `server/` (Express 5 + SQLite, CommonJS) + `client/` (React 19 + TypeScript + Vite + Tailwind CSS 4).
No shared code between packages. Frontend deploys to Vercel, backend runs locally.

## Build & Run Commands

```bash
# Backend (port 3001)
cd server && npm install && node index.js

# Frontend dev server (port 5173, proxies /api → localhost:3001)
cd client && npm install && npm run dev

# Type-check (no emit)
cd client && npx tsc --noEmit

# Lint
cd client && npm run lint

# Production build (outputs to client/dist/)
cd client && npm run build
```

### After Finishing Major Changes

Always run `cd client && npx tsc --noEmit && npm run build` to check for build-time errors before considering the task complete.

### Code Review After Every Major Step

After completing each major step or phase of work, launch a code review sub-agent (Task tool) to review the changes before moving on. Use the appropriate sub-agent:
- **code-reviewer** — bugs, error handling, dead code, conventions
- **typescript-reviewer** — type safety, strict mode, import style
- **frontend-reviewer** — UI/visual quality, theme consistency, responsive design
- **architect** — structural integrity, data flow, pattern compliance

Address any issues found before proceeding to the next step.

### UI / Design / CSS Work

For any task involving UI, design, styling, or CSS changes, always load and use the `frontend-design` skill to ensure high-quality, polished results. After implementation, launch the **frontend-reviewer** sub-agent to verify theme consistency and visual quality.

### Tests

No test framework is configured. Do not attempt to run tests.

## Sub-Agent Workflow

### Available Sub-Agents (`.opencode/agents/`)

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `planner` | Structured implementation plans | Before any feature, produces phased plan |
| `architect` | Structure, data flow, patterns | Before new features, after refactoring |
| `code-reviewer` | Bugs, quality, conventions | After every implementation step |
| `typescript-reviewer` | Type safety, strict mode | After writing/changing TypeScript |
| `frontend-reviewer` | UI/visual, themes, responsive | After any UI/styling change |
| `build-error-resolver` | Minimal build/type error fixes | When build fails — fixes ONLY the error |

### Phased Workflow for New Features

```
1. RESEARCH → Grep/Glob to find affected files (iterative retrieval, max 3 cycles)
2. PLAN → Launch planner agent, produces structured plan
3. IMPLEMENT → Write code
4. REVIEW → Launch code-reviewer + typescript-reviewer
5. UI CHECK → If frontend changed, launch frontend-reviewer
6. BUILD CHECK → Run tsc --noEmit && npm run build
7. BUILD FIX → If errors, launch build-error-resolver (minimal diffs only)
```

### Iterative Retrieval for Sub-Agents

When sub-agents need to find context, use this pattern:
1. **DISPATCH** — Broad search with keywords + patterns relevant to the task
2. **EVALUATE** — Score each result 0.0-1.0 for relevance (high: 0.8+, medium: 0.5-0.7, low: <0.5)
3. **REFINE** — Extract new keywords from high-relevance results, exclude low-relevance paths
4. **LOOP** — Repeat until 3+ high-relevance files found with no critical gaps (max 3 cycles)
Pass the OBJECTIVE and PURPOSE, not just literal keywords.

### Slash Commands (`.opencode/commands/`)

| Command | Purpose |
|---------|---------|
| `/review` | Combined code + TypeScript review |
| `/plan <feature>` | Research + plan before implementing |
| `/check-arch` | Full architecture health check |
| `/review-ui` | Visual/theme/responsive review |

## Token Optimization

### Context Management

- **Compact between phases**: After research/planning, compact before implementation. Research context is bulky; the plan is the distilled output.
- **Do NOT compact mid-implementation**: Losing variable names and file paths is costlier than the tokens saved.
- **Compact after debugging**: Debug traces pollute context. Clear them before moving to next task.
- **Compact after failed approaches**: Dead-end reasoning wastes context window.

### Compaction Decision Table

| Phase Transition | Compact? | Why |
|---|---|---|
| Research -> Planning | **Yes** | Research context is bulky; plan is the distilled output |
| Planning -> Implementation | **Yes** | Plan is saved in TodoWrite/file; free context for code |
| Implementation -> Testing | Maybe | Keep if tests reference recent code changes |
| Debugging -> Next feature | **Yes** | Debug traces pollute context for unrelated work |
| Mid-implementation | **No** | Losing variable names, file paths, partial state is costly |
| After a failed approach | **Yes** | Clear dead-end reasoning before new approach |

### What Survives Compaction

| Persists | Lost |
|---|---|
| AGENTS.md / instructions | Intermediate reasoning/analysis |
| TodoWrite task list | File contents previously read |
| Files on disk | Tool call history |
| Git state | Multi-step conversation context |

### Sub-Agent Efficiency

- Sub-agents start with fresh context — they don't inherit your full conversation. Give them precise, self-contained instructions.
- Tell sub-agents exactly what files to review (via `git diff` output or file list). Don't make them search the whole codebase.
- Reviewers should use `mode: subagent` — they get Read/Grep/Glob/Bash but no Edit/Write. They report, they don't modify.
- Consolidate review findings: "5 functions missing error handling" as one finding, not five.

### Avoid Wasteful Patterns

- Don't re-read files you already read in the same conversation — reference them by line number.
- Don't run multiple searches when one well-targeted Grep will do.
- Don't explain what you're about to do — just do it (unless the user asks).
- Don't repeat information already in AGENTS.md in your responses.
- Be very concise and to the point.

## TypeScript Configuration

- **Strict mode**: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`
- **Target**: ES2023, module ESNext, JSX react-jsx
- **verbatimModuleSyntax**: Use `import type` for type-only imports
- **Path alias**: `@/*` → `./src/*` (configured in vite.config.ts and tsconfig)
- Module resolution: bundler mode

## Code Style — Frontend (client/)

### Imports

- `import type { ... }` for all type-only imports (required by `verbatimModuleSyntax`)
- React imports: `import { useState, useEffect, useCallback } from 'react'`
- Third-party imports first, then local imports separated by blank line
- Use relative paths within features; use `@/` alias for cross-module imports
- Barrel exports via `index.ts` in feature folders

### Formatting

- Single quotes for strings
- Semicolons required
- 2-space indentation
- Trailing commas in multi-line structures
- JSX: always multi-line when props > 1

### Naming Conventions

- **Components**: PascalCase files matching component name (`SummaryView.tsx`, `NavigationBar.tsx`)
- **Hooks**: camelCase prefixed with `use` (`useCategories`, `useWidgets`)
- **Types/Interfaces**: PascalCase (`Category`, `Summary`, `AppOutletContext`)
- **Utils**: camelCase (`slugify`, `cleanupOldData`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE`, `DEFAULT_FILTERS`)
- **CSS custom properties**: kebab-case (`--color-ink`, `--font-serif`)

### Component Patterns

- Function components only (no class components)
- Custom hooks for all data fetching (`useApi.ts`, `useWidgets.ts`, `useTheme.ts`)
- Props defined as inline types or local interfaces, not separate files
- ShadCN UI primitives in `components/ui/` — extend these, don't duplicate
- Feature-organized folders under `features/` with barrel `index.ts` exports

### State & Data Flow

- Widget data flows from `App.tsx` via Outlet context (`AppOutletContext` in `types/routing.ts`)
- All outlet context fields must be defined in the typed object, not spread later
- `AbortController` in every hook that fetches data — abort on cleanup and before re-fetch
- `useCallback` for handlers passed as props or used in dependencies
- Pessimistic UI for chat: append user message immediately, add server reply on response

### Styling

- Tailwind CSS 4 with `@theme` directive (no `tailwind.config.js`)
- Four themes via `[data-theme]` on `<html>`: classic, broadsheet, evening, morning
- ShadCN CSS variables bridged to theme tokens in `index.css`
- Custom variant: `dark` variant targets `[data-theme="evening"]`
- Typography: Literata (headings), Source Serif 4 (body), Inter (UI), Source Sans 3 (widgets)

### Error Handling

- `try/catch` in all async hooks with `AbortError` check to skip aborted requests
- Server errors surfaced via `error` state in hooks
- API responses checked with `!res.ok` before parsing
- `console.error` for logging, never `console.log` in production code

## Code Style — Backend (server/)

### General

- CommonJS: `require()` / `module.exports`
- Express 5 Router pattern — one file per resource in `routes/`
- `const db = require('../db')` for database access (better-sqlite3, sync API)
- `const validateId = require('../middleware/validateId')` middleware for param routes

### Route Patterns

- `router.get('/', ...)` for list endpoints, returns JSON array
- `router.get('/:id', validateId, ...)` for single resources
- `router.post('/', ...)` for creation, returns created object
- `router.put('/:id/field', validateId, ...)` for partial updates
- `router.delete('/:id', validateId, ...)` for deletion, returns `{ ok: true }`
- Error responses: `{ error: 'message' }` with appropriate HTTP status
- Validate input early with early returns (`if (!name) return res.status(400).json(...)`)

### Database

- SQLite with WAL mode, auto-creates tables on startup
- Synchronous `db.prepare().all()/.get()/.run()` calls (better-sqlite3)
- Use parameterized queries (`?` placeholders) — never interpolate user input

## Preserving Existing Functionality

Before implementing any new feature or requirement, you MUST:

1. **Audit existing code first**
   - Scan the relevant files and identify any functionality that already exists
   - Flag it explicitly in your response before writing any code

2. **Flag existing functionality**
   - List what already exists that overlaps with the new requirement
   - Example format:
     :warning: EXISTING: `getUserData()` in `services/user.ts` already handles user fetching.
     → Do you want to keep, extend, or replace it?

3. **Wait for confirmation**
   - Do NOT overwrite or refactor existing code unless explicitly told to
   - If unsure, ask: "This already exists — should I keep it, extend it, or replace it?"

4. **Never silently replace**
   - Do not rename, remove, or rewrite existing functions/components without flagging it first
   - Prefer extending existing code over replacing it

5. **When adding new code**
   - Reuse existing utilities, hooks, services, and helpers where possible
   - Only create new files/functions if the existing ones cannot be extended

### Response Format for New Requirements

When given a new task, structure your response like this:

### :mag: Existing Functionality Found
- [list anything relevant that already exists]

### :warning: Conflicts or Overlaps
- [list anything the new requirement might overwrite or duplicate]

### :white_check_mark: Proposed Approach
- [what you plan to do, keeping the above in mind]

### :octagonal_sign: Needs Confirmation
- [anything you need a yes/no on before proceeding]

## Architecture Notes

- API base URL configured via `VITE_API_URL` (defaults to `/api`), defined in `client/src/config.ts`
- Vite dev proxy: `/api` → `http://localhost:3001`
- LLM provider fallback: Groq (openai/gpt-oss-20b) first → OpenRouter (minimax/minimax-m2.7), configured in `server/lib/llm.js`
- Each summary generation triggers **two LLM calls**: main summary + enrichment (sentiment + tags)
- Category-level `custom_prompt` and `language` fields customize LLM output
- All widget endpoints have server-side caching (crypto 2min, releases 30min, homepage 5min, job fetch 30min debounce)
- LLM JSON repair: Triple-attempt parse in summaries.js with heuristics for trailing commas/brackets
- When adding new context to `AppOutletContext`, add it to the typed object in `App.tsx` AND to the interface in `types/routing.ts`
- Feature folders under `features/mindgames/` follow: `component files` + `index.ts` barrel export

### Backend Routes (`server/routes/`)

```
categories.js      — GET/POST /api/categories, GET/PUT/DELETE /api/categories/:id
feeds.js           — GET/POST /api/categories/:id/feeds
feedDelete.js      — DELETE /api/feeds/:id
summaries.js       — GET /api/categories/:id/summary, GET /api/categories/:id/history, POST /api/categories/:id/refresh
chat.js            — GET /api/chat/:summaryId, POST /api/chat
briefing.js        — GET /api/briefing/latest, POST /api/briefing/generate
jobs.js            — GET /api/jobs (filters), POST /api/jobs/fetch, PATCH /api/jobs/:id/status, POST /api/jobs/ai-filter
stats.js           — GET /api/stats/llm, GET /api/stats/trending
widgets.js         — GET /api/widgets/{weather,rates,headlines,crypto,hackernews,releases}
homepage.js        — GET /api/homepage, POST /api/homepage/refresh
settings.js        — GET /api/settings, PUT /api/settings/:key
telegram.js        — POST /api/telegram/send
discovery.js       — POST /api/discover-feed
```

Cognitive routes: `narrative`, `prompts`, `disinfo`, `cognitive`, `forensics`, `inoculation`, `scientist`, `bridge`, `compare`, `spectrum`.
Bias-radar routes: `bias-radar/` (decode, related, timeline, daily-quiz, steelman, missing-story).

Shared libs: `lib/llm.js`, `lib/rss.js`, `lib/telegram.js`, `lib/fetchWithTimeout.js`.
Job aggregator: `jobs/sources.js` (8 sources), `jobs/ai-filter.js`, `jobs/common.js`.

### Database Tables

Core: `categories`, `feeds`, `summaries`, `summary_history` (sentiment_data/tags_data JSON), `articles`, `llm_usage`, `chat_messages`, `user_settings`, `jobs`, `ai_filtered_jobs`. Morning briefings use `category_id = 0` in `summary_history`.

Cognitive: `forensic_analyses`, `inoculation_sessions`, `inoculation_headlines`, `rethinking_journal`, `bridge_audits`, `study_analyses`, `disinfo_maps`, `narrative_maps`, `prompt_usage`.

### Environment Variables

**Server** (`server/.env`):
- `GROQ_API_KEY` — required for LLM (Groq provider)
- `OPENROUTER_API_KEY` — required for LLM fallback (OpenRouter/MiniMax)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — optional, send-to-Telegram feature
- `TMDB_API_KEY` — optional, movie/TV releases widget
- `DB_PATH` — path to SQLite (default: `./newsreader.db`). Set to a Railway volume path for persistence
- `PORT` — defaults to 3001

**Client** (build-time only):
- `VITE_API_URL` — backend URL for production split deployment (e.g., `https://your-railway-app.up.railway.app/api`)

### Key Patterns

- **Provider fallback**: Iterate `AI_PROVIDERS` with try/catch, respects `providerId` parameter, rate limit headers captured into `providerQuotas`
- **Widget data flow**: Single `useWidgets()` in App.tsx, passed as props to both sidebars (avoids double-fetching)
- **AbortController**: `useSummary` and `useJobs` cancel in-flight requests on category/source switch
- **Chat**: Pessimistic UI — user message added immediately, server returns assistant response with summary context
- **Server-synced theme**: `useTheme` fetches from server on mount, PUTs on change, localStorage fallback

### MindGames Feature Structure

```
features/mindgames/
├── common/           # FeaturePanelHeader, TabHeader
├── dashboard/        # CognitiveDashboard, CognitiveTabNav, types
├── overview/         # OverviewTab (stats, quick actions)
├── training/         # TrainingTab, InoculationPanel, PatternTests
├── analysis/         # AnalysisTab, ForensicPanel, StudyStressTester, CompareCoverage, NewsSpectrum
├── reflection/       # ReflectionTab, ScientistPanel, JournalTrends, BridgePanel, InformationDiet, StressDiagnostic
├── reference/        # ReferenceTab, PromptLibrary, NarrativeMapPanel, DisinfoMap
├── quiz/             # QuizTab, DailyQuiz
└── bias-radar/       # BiasRadarPanel, TechniquePicker, TechniqueCard, and sub-panels
```

- `BiasRadarPanel` is used outside MindGames (from SummaryView, NewspaperHome)
- `DailyQuiz` bridges cognitive and bias-radar, importing TechniquePicker + TechniqueCard

### Deployment

- **Frontend**: Vercel (build command: `cd client && npm install && npm run build`, output: `client/dist`)
- **Backend**: Railway (root directory: `server`, start: `node index.js`, needs `PORT` env var)
- **Database persistence**: Attach a Railway volume (e.g. mounted at `/data`), then set `DB_PATH=/data/newsreader.db`
- `vercel.json` and `server/nixpacks.toml` configure deployment
- After deploying backend, set `VITE_API_URL` in Vercel env vars and redeploy
