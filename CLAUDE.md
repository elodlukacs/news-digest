# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# Backend (Terminal 1) — Express on port 3001
cd server && npm install && node index.js

# Frontend (Terminal 2) — Vite on port 5173
cd client && npm install && npm run dev

# Type-check
cd client && npx tsc --noEmit

# Lint
cd client && npm run lint

# Production build
cd client && npm run build  # outputs to client/dist/
```

## Architecture

**Monorepo** with two independent packages: `server/` (Express + SQLite) and `client/` (React + Vite).

### Backend (`server/`)

- Express 5 with better-sqlite3 (WAL mode, auto-creates tables + seeds defaults on startup)
- `lib/llm.js` — `callLLM()` with **provider fallback**: Groq (openai/gpt-oss-20b) first, then OpenRouter (minimax/minimax-m2.7). Filters by configured API keys, captures rate-limit headers into `providerQuotas`
- Each summary generation triggers **two LLM calls**: main summary + enrichment (sentiment + tags)
- Category-level `custom_prompt` and `language` fields customize LLM output
- Widget endpoints proxy external APIs with server-side caching
- Modular routes: `routes/` (categories, feeds, summaries, chat, briefing, jobs, stats, widgets, homepage, settings, telegram, discovery)
- Cognitive routes: `routes/narrative`, `routes/prompts`, `routes/disinfo`, `routes/cognitive`, `routes/forensics`, `routes/inoculation`, `routes/scientist`, `routes/bridge`, `routes/compare`, `routes/spectrum`
- Bias-radar routes: `routes/bias-radar/` (decode, related, timeline, daily-quiz, steelman, missing-story)
- Shared libs: `lib/llm.js`, `lib/rss.js`, `lib/telegram.js`, `lib/fetchWithTimeout.js`
- Job aggregator: `jobs/sources.js` (8 sources), `jobs/ai-filter.js`, `jobs/common.js`

### Frontend (`client/src/`)

- React 19 + TypeScript + Tailwind CSS 4 (using `@theme` directive, no tailwind.config.js)
- All API calls route through `API_BASE` from `client/src/config.ts` reading `VITE_API_URL` (defaults to `/api`)
- Vite dev server proxies `/api` to `localhost:3001` (see `vite.config.ts`)
- `hooks/useApi.ts` — all data hooks: useCategories, useFeeds, useSummary, useSummaryHistory, useChat, useBriefing, useHomepage, useJobs
- Three-column layout: `LeftSidebar` (archive, HN) | main content | `WidgetSidebar` (weather, crypto, rates, trending, headlines)
- Page components: NewspaperHome, SummaryView, JobsPage, ReleasesPage, MorningBriefing
- `NavigationBar.tsx` — unified masthead (replaces Header + CategoryNav), contains theme switcher + LLM model selector
- ShadCN UI components in `components/ui/`

### MindGames Feature (`client/src/features/mindgames/`)

Feature-organized folder structure with 9 sub-modules:

```
features/mindgames/
├── common/           # Shared components: FeaturePanelHeader, TabHeader
├── dashboard/        # CognitiveDashboard, CognitiveTabNav, types
├── overview/         # OverviewTab (stats, quick actions)
├── training/         # TrainingTab, InoculationPanel, PatternTests
├── analysis/         # AnalysisTab, ForensicPanel, StudyStressTester, CompareCoverage, NewsSpectrum
├── reflection/       # ReflectionTab, ScientistPanel, JournalTrends, BridgePanel, InformationDiet, StressDiagnostic
├── reference/        # ReferenceTab, PromptLibrary, NarrativeMapPanel, DisinfoMap
├── quiz/             # QuizTab, DailyQuiz
└── bias-radar/       # BiasRadarPanel, TechniquePicker, TechniqueCard, and sub-panels
```

- Each folder has an `index.ts` barrel export
- `FeaturePanelHeader` — common card header with icon+title row and "The science" dialog + right-side element row
- `TabHeader` — common tab page header with icon, title, description
- `BiasRadarPanel` is used outside MindGames (from SummaryView, NewspaperHome) via `features/mindgames/bias-radar`
- `DailyQuiz` bridges cognitive and bias-radar, importing TechniquePicker + TechniqueCard

### Theme System (`client/src/index.css`)

Four themes via CSS custom properties + `[data-theme]` on `<html>`:
- **classic** (default): warm newsprint (#F5F0E8, #8B4513 masthead)
- **broadsheet**: cool NYT-style (#FAFAF9, #1A365D masthead)
- **evening**: dark mode (#1A1A2E, #C9A04E masthead)
- **morning**: fresh green (#FDF6EC, #2D6A4F masthead)

Typography: Playfair Display (headings), Lora (body text), Inter (UI), Source Sans 3 (widgets).

Theme preference syncs to server via `PUT /api/settings/theme`.

### Database Tables

Core: `categories`, `feeds`, `summaries`, `summary_history` (sentiment_data/tags_data JSON), `articles`, `llm_usage`, `chat_messages`, `user_settings`, `jobs`, `ai_filtered_jobs`. Morning briefings use `category_id = 0` in `summary_history`.

Cognitive: `forensic_analyses`, `inoculation_sessions`, `inoculation_headlines`, `rethinking_journal`, `bridge_audits`, `study_analyses`, `disinfo_maps`, `narrative_maps`, `prompt_usage`.

## Key Patterns

- **Provider fallback**: `AI_PROVIDERS` in `lib/llm.js`, iterated with try/catch, `providerId` param prioritizes a specific provider
- **Widget data flow**: Single `useWidgets()` in App.tsx, data passed as props to both sidebars (avoids double-fetching)
- **AbortController**: `useSummary` and `useJobs` cancel in-flight requests on category/source switch
- **Chat**: Pessimistic UI — user message added immediately, server returns assistant response with summary context
- **Server-synced theme**: `useTheme` fetches from server on mount, PUTs on change, localStorage fallback
- **LLM JSON repair**: Triple-attempt parse in summaries.js with heuristics for trailing commas/brackets

## Environment Variables

**Server** (`server/.env`):
- `GROQ_API_KEY` — required for LLM (Groq provider)
- `OPENROUTER_API_KEY` — required for LLM fallback (OpenRouter/MiniMax)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — optional, send-to-Telegram feature
- `TMDB_API_KEY` — optional, movie/TV releases widget
- `DB_PATH` — path to SQLite (default: `./newsreader.db`). Set to a Railway volume path for persistence
- `PORT` — defaults to 3001

**Client** (build-time only):
- `VITE_API_URL` — backend URL for production split deployment (e.g., `https://your-railway-app.up.railway.app/api`)

## Deployment

- **Frontend**: Vercel (build command: `cd client && npm install && npm run build`, output: `client/dist`)
- **Backend**: Railway (root directory: `server`, start: `node index.js`, needs `PORT` env var)
- **Database persistence**: Attach a Railway volume (e.g. mounted at `/data`), then set `DB_PATH=/data/newsreader.db`
- `vercel.json` and `server/nixpacks.toml` configure deployment
- After deploying backend, set `VITE_API_URL` in Vercel env vars and redeploy
