# News Digest — Project Description for LLM Research

This document describes the News Digest application in structured detail, intended for use alongside a separate feature-ideas document. The goal is to map external feature ideas into this existing codebase, identifying integration points, reusable patterns, and required changes.

---

## 1. Application Summary

**News Digest** is a self-hosted AI news aggregation platform. It fetches RSS feeds, summarizes articles using LLM APIs, and presents them in a newspaper-inspired editorial UI. It includes a job board, real-time widgets, and a cognitive resilience training suite ("MindGames").

**Monorepo:** `server/` (Express 5 + SQLite, CommonJS) + `client/` (React 19 + TypeScript + Vite + Tailwind CSS 4). No shared code between packages.

**Deployment:** Frontend on Vercel, backend on Railway. SQLite with WAL mode for persistence.

---

## 2. Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript 5.9 (strict mode), Vite, Tailwind CSS 4, ShadCN UI (18 primitives), Recharts, react-markdown, lucide-react icons |
| Backend | Express 5, better-sqlite3 (sync API, WAL mode), rss-parser |
| AI/LLM | Groq (primary, `openai/gpt-oss-20b`) → Google AI Studio (fallback, `gemini-2.0-flash`). Automatic provider fallback. Usage tracked in `llm_usage` table. |
| Database | SQLite via better-sqlite3. 24 tables. All schema in `server/db.js`. |
| External APIs | TMDB (movies/TV), CoinGecko (crypto), Open-Meteo (weather), Frankfurter (exchange rates), Hacker News Firebase, PBS RSS, Telegram Bot |
| Job Sources | 8 aggregators: RemoteOK, WeWorkRemotely, Himalayas, Remotive, Arbeitnow, LinkedIn, Indeed, HackerNews |

---

## 3. Backend Architecture

### 3.1 Route Map (all routes prefixed with `/api`)

**Core routes:**

| Path | File | Methods | Purpose |
|---|---|---|---|
| `/categories` | `routes/categories.js` | GET `/`, GET `/:id`, POST `/`, PUT `/:id/name`, PUT `/:id/prompt`, PUT `/:id/language`, DELETE `/:id` | CRUD for feed categories. Custom prompt + language per category. |
| `/categories/:id/feeds` | `routes/feeds.js` | GET, POST | List/add RSS feeds per category |
| `/feeds/:id` | `routes/feedDelete.js` | DELETE | Delete a feed |
| `/categories/:id/summary` | `routes/summaries.js` | GET, POST `/refresh`, GET `/history` | Fetch RSS → LLM summarize → store. History with date_key. |
| `/chat` | `routes/chat.js` | POST `/`, GET `/:summaryId` | AI chat with article-scoped context. Pessimistic UI pattern. |
| `/briefing` | `routes/briefing.js` | POST `/generate`, GET `/latest` | Cross-category daily digest via LLM |
| `/settings` | `routes/settings.js` | GET `/`, PUT `/:key` | Key-value user preferences (theme, language, llm_model, custom_css, etc.) |
| `/discover-feed` | `routes/discovery.js` | POST `/` | Auto-discover RSS from any URL |
| `/stats` | `routes/stats.js` | GET `/llm`, GET `/trending` | LLM usage analytics, trending tags |
| `/homepage` | `routes/homepage.js` | GET `/`, POST `/refresh` | Newspaper grid with article images (5-min cache) |
| `/telegram` | `routes/telegram.js` | POST `/send`, POST `/digest` | Send summary or full digest to Telegram |
| `/models` | `routes/models.js` | GET `/` | Dynamic model list from providers |
| `/prompts` | `routes/prompts-manager.js` | GET `/`, GET `/:slug`, PUT `/:slug` | Database-backed prompt template management |
| `/widgets/*` | `routes/widgets.js` | GET `/weather`, `/rates`, `/headlines`, `/crypto`, `/hackernews`, `/releases` | Real-time widget data (server-side cached) |
| `/jobs` | `routes/jobs.js` | GET `/`, POST `/fetch`, PATCH `/:id/status`, POST `/ai-filter`, POST `/:id/save`, DELETE `/:id/save` | Job board with 8 sources, AI filtering, save/unsave |

**Cognitive/MindGames routes:**

| Path | File | Methods | Purpose |
|---|---|---|---|
| `/forensics` | `routes/forensics.js` | POST `/`, POST `/stream`, GET `/history` | Fallacy detection (14 types), Funnel of Misbelief, SSE streaming |
| `/inoculation` | `routes/inoculation.js` | POST `/generate`, POST `/answer`, POST `/craft`, GET `/tactics`, GET `/sessions` | Inoculation lab: passive detect + active craft modes, 6 viral antigens, antibody tracking |
| `/scientist` | `routes/scientist.js` | POST `/debate`, POST `/journal`, GET `/journal`, GET `/personas`, GET `/journal/trends` | ADEPT multi-agent debate (Skeptic/Institutionalist/Moralist), rethinking journal |
| `/bridge` | `routes/bridge.js` | POST `/audit`, POST `/bridge`, GET `/values`, POST `/values`, GET `/audits`, POST `/information-diet` | SOS audit, bridge-building questions, Schwartz values quiz |
| `/cognitive/narrative-map` | `routes/narrative.js` | POST, GET `/trending`, GET `/history` | Misinformation spread visualization |
| `/cognitive/disinfo-map` | `routes/disinfo.js` | POST, GET | Disinfo influencer funnel map |
| `/cognitive/prompts` | `routes/prompts.js` | GET `/`, POST `/custom` | Prompt library (30 templates, 5 categories) |
| `/compare` | `routes/compare.js` | POST `/coverage` | Multi-outlet coverage comparison (Ground News style) |
| `/spectrum` | `routes/spectrum.js` | GET `/outlet-ratings`, POST `/compare` | 30 outlet ratings with bias scores |
| `/progress` | `routes/cognitive.js` | DELETE `/reset` | Clear all cognitive data |

**Bias Radar routes (`/bias-radar/*`):**

| Path | File | Methods | Purpose |
|---|---|---|---|
| `/bias-radar/decode` | `routes/bias-radar/decode.js` | POST `/` | Detect 12 manipulation techniques in text |
| `/bias-radar/related` | `routes/bias-radar/related.js` | GET `/` | Find related articles across sources |
| `/bias-radar/daily-quiz` | `routes/bias-radar/daily-quiz.js` | GET `/` | Daily technique-guessing quiz |
| `/bias-radar/steelman` | `routes/bias-radar/steelman.js` | POST `/` | Generate strongest counter-argument |
| `/bias-radar/missing-story` | `routes/bias-radar/missing-story.js` | POST `/` | Identify under-reported stories |

### 3.2 Database Schema (24 tables)

All tables auto-created in `server/db.js` on startup.

**Core tables:**

```
categories          id, name, icon, sort_order, custom_prompt, language
feeds               id, category_id (FK), name, url
summaries           id, category_id (FK), summary, article_count, feed_count, generated_at
summary_history     id, category_id, summary, date_key, sentiment_data (JSON), tags_data (JSON), provider
articles            id, category_id, feed_name, title, description, link, pub_date, topic_id, body_text
llm_usage           id, provider, model, input_tokens, output_tokens, purpose, latency_ms, created_at
chat_messages       id, summary_id, role, content, article_title, created_at
user_settings       key (PK), value
jobs                id, title, company, url, source, date_posted, status, country, work_type, description
ai_filtered_jobs    id, job_id (FK), remote, filtered_at
saved_jobs          job_id (PK), saved_at
prompts             id, slug (UNIQUE), name, description, category, system_message, user_prompt
```

**Cognitive tables:**

```
cognitive_users         id, antibody_count, primary_values (JSON), inoculation_level, last_inoculation_date
forensic_history        id, user_id, raw_text, fallacy_data (JSON), bias_score, emotional_intensity, funnel_stage
rethinking_journal      id, user_id, topic, initial_confidence, final_confidence, shifting_evidence (JSON), mode
inoculation_sessions    id, user_id, level, score, choices (JSON), completed, created_at
bridge_audits           id, user_id, sources (JSON), siloing_score, shared_values (JSON), questions (JSON)
study_analyses          id, user_id, headline, analysis_data (JSON)
narrative_maps          id, user_id, topic, map_data (JSON)
disinfo_maps            id, user_id, map_data (JSON)
prompt_usage            id, prompt_id, used_at
```

### 3.3 Shared Libraries

| File | Purpose |
|---|---|
| `lib/llm.js` | Provider fallback system. `callLLM({ messages, providerId, purpose })`. Iterates AI_PROVIDERS with try/catch. Captures rate-limit headers. Logs to `llm_usage`. |
| `lib/rss.js` | RSS parsing with image extraction from media:content, enclosure, media:thumbnail |
| `lib/telegram.js` | Message escaping (MarkdownV2), 4096-char chunk splitting |
| `lib/fetchWithTimeout.js` | HTTP fetch with AbortController timeout |
| `lib/promptManager.js` | `getPrompt(slug)`, `renderPrompt(slug, vars)` with `{{variable}}` substitution, `buildMessages(slug, vars)` |
| `lib/parseJSON.js` | Robust JSON parsing with fallback |

### 3.4 Key Backend Patterns

- **Provider fallback:** Iterate `AI_PROVIDERS` array, try each until one succeeds. Respect optional `providerId` param.
- **JSON repair:** Triple-attempt parse in summaries — direct parse → trailing comma fix → truncation fix.
- **Route param validation:** `middleware/validateId.js` ensures `:id` params are valid integers.
- **Error responses:** `{ error: 'message' }` with appropriate HTTP status codes.
- **Parameterized queries only:** Never interpolate user input into SQL.

---

## 3.5 Bias Radar — Detailed Component Architecture

The Bias Radar is a cross-cutting feature: a slide-over panel accessible from both the **SummaryView** (per article in a category summary) and **NewspaperHome** (homepage article grid). It is **not** limited to the MindGames dashboard — it's woven into the core reading experience.

### Trigger & Entry Points

**From SummaryView** (`components/SummaryView.tsx:378-386`): Each article section card has a "Bias Radar" button in the card footer alongside "Read full article" and "Chat". Clicking it sets `radarSection` state with `{ title, content, url, originalContent }` and opens the panel with `initialTab="decode"`.

**From NewspaperHome** (`components/NewspaperHome.tsx:519`): Same pattern — each homepage article card has a Bias Radar button, opens with `initialTab="compare"` (default).

### Panel Component (`features/mindgames/bias-radar/BiasRadarPanel.tsx`)

A **portal-based, focus-trapped slide-over panel** rendered via `createPortal(document.body)`:
- **Desktop:** Right-side drawer, `max-w-[560px]`, full height
- **Mobile:** Bottom sheet with rounded top corners, swipe-to-dismiss (120px threshold)
- Locks body scroll on open, restores on close
- Escape key closes
- Props: `headline`, `content`, `originalContent`, `currentArticle` (SourceArticle), `sourceName`, `language`, `onClose`, `initialTab`, `sections`, `categoryName`

### 3 Tabs

#### Tab 1: Compare (`BiasRadarCompare.tsx`)

**Flow:** GutCheck → fetch related articles → SourceCard list

1. **GutCheck** (`GutCheck.tsx`): Pre-reading emotional state — user picks one of 4 reactions: `outraged`, `skeptical`, `interested`, `bored`. Blocks until selection.
2. **Fetch related:** `GET /api/bias-radar/related?articleId=<title>&source=<excludeSource>&language=<lang>` — returns `SourceArticle[]`
3. **Display:** Current article as main SourceCard (marked "You're reading this"), related articles sorted by `BIAS_SORT_ORDER` (left → lean-left → center → lean-right → right → unknown)
4. **SourceCard** (`SourceCard.tsx`): Shows source name, bias rating badge (color-coded per AllSides), title, excerpt, link. Uses `BIAS_COLORS` and `BIAS_LABELS` from `utils/biasRatings.ts`.
5. **Closing prompt:** "What single fact would change how you interpret this story?"

**Bias ratings** (`utils/biasRatings.ts`): Static mapping of ~40 domains to `BiasRating` type (`left | lean-left | center | lean-right | right | unknown`). Derived from AllSides (CC BY-NC 4.0). Domain matching supports subdomain fallback.

#### Tab 2: Decode (`BiasRadarDecode.tsx`)

Thin wrapper around `ForensicPanel` (from `features/mindgames/analysis`). Passes through `headline`, `content`, `originalContent`, `sections`, `categoryName`.

**Backend:** `POST /api/bias-radar/decode` — LLM-based detection of manipulation techniques.

**12 detectable techniques** (`types/lens.ts` `TechniqueName`):
```
fear-mongering, outrage-bait, false-urgency, us-vs-them,
tribal-signaling, vague-attribution, false-dichotomy,
anecdote-as-trend, framing-by-omission, headline-body-mismatch,
source-laundering, none
```

Each result (`TechniqueResult`): `technique`, `displayName`, `evidence` (quoted excerpt), `explanation`, `difficulty` (easy/medium/hard), `confidence` (high/medium/low).

**TechniqueCard** (`TechniqueCard.tsx`): Renders detected technique with difficulty badge (color-coded), quoted evidence, explanation, confidence label. Special green card for `none` (clean article).

**TechniquePicker** (`TechniquePicker.tsx`): Interactive quiz — user guesses the technique before seeing the analysis. Shows 12 technique options with toggleable hints. Used in DailyQuiz flow.

#### Tab 3: Steelman (`BiasRadarSteelman.tsx`)

**Flow:** User position → LLM counter-argument → rating → rebuttal → follow-up question

1. **Input:** User states their position on the story (textarea, 300 char max)
2. **LLM call:** `POST /api/bias-radar/steelman` with `{ userPosition, articleContext, language, provider }` → returns `SteelmanResponse { counterArgument, followUpQuestion }`
3. **Rating:** User rates convincingness 1-5
4. **Rebuttal:** Optional one-sentence rebuttal (200 char max)
5. **Follow-up:** Displays follow-up question from LLM ("Sit with this question")
6. **Reset:** "Try a different position" to start over

### API Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/bias-radar/decode` | POST | Detect manipulation techniques in text |
| `/api/bias-radar/related` | GET | Find related articles across outlets |
| `/api/bias-radar/steelman` | POST | Generate strongest counter-argument |
| `/api/bias-radar/daily-quiz` | GET | Daily technique quiz from recent articles |
| `/api/bias-radar/missing-story` | POST | Under-reported story detection (requires INTERNAL_API_SECRET) |

### Types (`types/lens.ts`)

```typescript
type BiasRating = 'left' | 'lean-left' | 'center' | 'lean-right' | 'right' | 'unknown';
type TechniqueName = 'fear-mongering' | 'outrage-bait' | 'false-urgency' | 'us-vs-them'
  | 'tribal-signaling' | 'vague-attribution' | 'false-dichotomy' | 'anecdote-as-trend'
  | 'framing-by-omission' | 'headline-body-mismatch' | 'source-laundering' | 'none';
type GutCheckReaction = 'outraged' | 'skeptical' | 'interested' | 'bored';
interface SourceArticle { id, title, url, source, biasRating: BiasRating, publishedAt, excerpt }
interface TechniqueResult { technique, displayName, evidence, explanation, difficulty, confidence }
interface SteelmanResponse { counterArgument, followUpQuestion }
```

### Barrel Export (`features/mindgames/bias-radar/index.ts`)

Exports: `BiasRadarPanel`, `BiasRadarCompare`, `BiasRadarDecode`, `BiasRadarSteelman`, `TechniquePicker`, `TechniqueCard`, `GutCheck`, `SourceCard`

---

## 4. Frontend Architecture

### 4.1 Routing (React Router v7)

| Path | Component | Description |
|---|---|---|
| `/` | `HomeRoute` | Newspaper grid homepage |
| `/category/:categoryName` | `CategoryRoute` | Category summary + chat |
| `/briefing` | `BriefingRoute` | Morning briefing |
| `/jobs` | `JobsRoute` | Job board |
| `/releases` | `ReleasesRoute` | Movies & TV releases |
| `/prompts` | `PromptManagerRoute` | Prompt template editor |
| `/mindgames` | `MindGamesRoute` | Cognitive dashboard (parent layout) |
| `/mindgames` (index) | Overview tab | Stats, quick actions |
| `/mindgames/training` | Training tab | Inoculation lab, pattern tests |
| `/mindgames/analysis` | Analysis tab | Forensics, study tester, compare coverage, news spectrum |
| `/mindgames/reflection` | Reflection tab | Scientist sandbox, bridge builder, information diet |
| `/mindgames/reference` | Reference tab | Prompt library, narrative map, disinfo map |
| `/mindgames/quiz` | Quiz tab | Daily quiz |

### 4.2 Key Components

| Component | File | Purpose |
|---|---|---|
| `NavigationBar` | `components/NavigationBar.tsx` | Top nav: categories, theme switcher, model selector |
| `NewspaperHome` | `components/NewspaperHome.tsx` | 5-column newspaper grid with article images |
| `SummaryView` | `components/SummaryView.tsx` | Category summary display with sentiment badges |
| `ArticleChatPopup` | `components/ArticleChatPopup.tsx` | Per-article AI chat popup |
| `ChatPanel` | `components/ChatPanel.tsx` | Summary-level chat panel |
| `LeftSidebar` | `components/LeftSidebar.tsx` | Archive navigation, trending tags |
| `WidgetSidebar` | `components/WidgetSidebar.tsx` | Weather, rates, crypto, HN, releases, headlines |
| `FeedManager` | `components/FeedManager.tsx` | Modal for managing RSS feeds per category |
| `MorningBriefing` | `components/MorningBriefing.tsx` | Briefing display |
| `JobsPage` | `components/JobsPage.tsx` | Job board with filters |
| `ReleasesPage` | `components/ReleasesPage.tsx` | Movies & TV with detail modals |
| `SentimentBadge` | `components/SentimentBadge.tsx` | Sentiment indicator (positive/negative/neutral/mixed) |
| `BiasRadarPanel` | `features/mindgames/bias-radar/BiasRadarPanel.tsx` | 3-tab bias analysis slide-over (Compare, Decode, Steelman). Portal-based, focus-trapped. See §3.5 for full details. |
| `BiasRadarCompare` | `features/mindgames/bias-radar/BiasRadarCompare.tsx` | GutCheck → related articles across outlets |
| `BiasRadarDecode` | `features/mindgames/bias-radar/BiasRadarDecode.tsx` | Wraps ForensicPanel for technique detection |
| `BiasRadarSteelman` | `features/mindgames/bias-radar/BiasRadarSteelman.tsx` | LLM counter-argument generator with rebuttal flow |
| `GutCheck` | `features/mindgames/bias-radar/GutCheck.tsx` | Pre-reading emotional state check (4 reactions) |
| `TechniquePicker` | `features/mindgames/bias-radar/TechniquePicker.tsx` | Interactive technique guessing quiz (12 options) |
| `TechniqueCard` | `features/mindgames/bias-radar/TechniqueCard.tsx` | Displays detected technique with evidence & confidence |
| `SourceCard` | `features/mindgames/bias-radar/SourceCard.tsx` | Article card with AllSides bias rating badge |

### 4.3 Custom Hooks

| Hook | File | Purpose |
|---|---|---|
| `useCategories` | `hooks/useApi.ts` | Fetch/manage categories |
| `useFeeds` | `hooks/useApi.ts` | Fetch feeds for a category |
| `useSummary` | `hooks/useApi.ts` | Fetch/refresh summary with AbortController |
| `useSummaryHistory` | `hooks/useApi.ts` | Fetch summary history by date |
| `useArticleChat` | `hooks/useApi.ts` | Per-article chat |
| `useBriefing` | `hooks/useApi.ts` | Morning briefing |
| `useHomepage` | `hooks/useApi.ts` | Homepage articles |
| `useJobs` | `hooks/useApi.ts` | Job listing with filters |
| `useStudyAnalysis` | `hooks/useApi.ts` | Study stress-test |
| `useInformationDiet` | `hooks/useApi.ts` | Information diet analysis |
| `useWidgets` | `hooks/useWidgets.ts` | All widget data in parallel (weather, rates, headlines, crypto, HN, releases, trending) |
| `useTheme` | `hooks/useTheme.ts` | Server-synced theme with localStorage fallback |
| `useModels` | `hooks/useModels.ts` | Fetch available LLM models |
| `useMediaQuery` | `hooks/useMediaQuery.ts` | CSS media query hook |
| `usePullToRefresh` | `hooks/usePullToRefresh.ts` | Mobile pull-to-refresh gesture |

### 4.4 Context & State

- **`LlmContext`** (`contexts/LlmContext.tsx`): Provides selected LLM model ID to all children.
- **`AppOutletContext`** (`types/routing.ts`): Typed object flowing from `AppLayout` via React Router Outlet — categories, selected model, callbacks.
- **Widget data:** Single `useWidgets()` in `App.tsx`, passed as props to both sidebars (avoids double-fetching).

### 4.5 Design System & Theming

- **4 themes** via `[data-theme]` on `<html>`: `classic`, `broadsheet`, `evening`, `morning`
- **Dark mode:** `evening` theme maps to Tailwind `dark` variant
- **CSS custom properties** defined in `index.css` using Tailwind CSS 4 `@theme` directive
- **Typography:** Literata (headings), Source Serif 4 (body), Inter (UI), Source Sans 3 (widgets)
- **Three-column layout:** left sidebar (archive/trending) | main content | right sidebar (widgets)
- **ShadCN UI primitives** in `components/ui/`: alert, badge, button, card, dialog, drawer, dropdown-menu, input, progress, scroll-area, separator, sheet, skeleton, slider, tabs, textarea, tooltip

### 4.6 TypeScript Configuration

- `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `verbatimModuleSyntax` — must use `import type` for type-only imports
- Path alias: `@/*` → `./src/*`
- Target: ES2023, module: ESNext, JSX: react-jsx

### 4.7 Code Style Conventions

- Single quotes, semicolons, 2-space indentation, trailing commas
- Components: PascalCase files (`SummaryView.tsx`)
- Hooks: camelCase with `use` prefix (`useCategories`)
- Types/Interfaces: PascalCase (`Category`, `Summary`)
- Constants: UPPER_SNAKE_CASE (`API_BASE`, `DEFAULT_FILTERS`)
- CSS custom properties: kebab-case (`--color-ink`, `--font-serif`)
- Barrel exports via `index.ts` in feature folders
- `try/catch` in all async hooks with `AbortError` check
- `useCallback` for handlers passed as props or used in dependencies
- Feature folders under `features/` with barrel exports

---

## 5. LLM Integration Detail

### 5.1 Provider System (`server/lib/llm.js`)

```js
// Primary: Groq
{ id: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'openai/gpt-oss-20b' }
// Fallback: Google AI Studio  
{ id: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.0-flash' }
```

- `callLLM({ messages, providerId, purpose })` — returns `{ content, provider, model, usage }`
- Automatic fallback: tries providers in order until one succeeds
- Rate-limit headers captured into `providerQuotas` object
- Every call logged to `llm_usage` table

### 5.2 Prompt System (`server/lib/promptManager.js`)

- Prompts stored in `prompts` table with `slug` as lookup key
- Template variables: `{{variable}}` syntax
- `buildMessages(slug, variables)` → `[{ role, content }]` array
- 25+ seeded prompts across categories: news, mindgames, bridge, bias-radar, jobs
- Editable via `/api/prompts` endpoint and UI

### 5.3 Summary Generation Flow

1. `POST /api/categories/:id/refresh`
2. `Promise.allSettled` fetch all feeds in category
3. Insert articles into `articles` table
4. `buildMessages('category-summary', { category, lang, customPrompt, articles })`
5. `callLLM({ messages, purpose: 'summary' })`
6. Triple-attempt JSON parse (direct → trailing comma fix → truncation fix)
7. Extract sentiment + tags per article section
8. Save to `summaries` (latest) + `summary_history` (archive, 30-day retention)
9. Return structured summary to client

---

## 6. Extension Points for New Features

When mapping external feature ideas into this application, these are the primary integration surfaces:

### 6.1 Adding a New API Route

1. Create `server/routes/<feature>.js` following the Express Router pattern
2. Register in `server/index.js` with `app.use('/api/<feature>', require('./routes/<feature>'))`
3. Add any new tables to `server/db.js` (auto-created on startup)
4. Use `const db = require('../db')` for SQLite access
5. Use `const { callLLM } = require('../lib/llm')` for LLM calls
6. Use `const { buildMessages } = require('../lib/promptManager')` for prompt templates
7. Seed new prompts in `server/db.js` alongside existing ones

### 6.2 Adding a New Frontend Feature

1. Create feature folder under `client/src/features/<feature>/`
2. Add barrel export `index.ts`
3. Create route component in `components/routes/`
4. Register route in `App.tsx` React Router config
5. If the feature needs shared data, add fields to `AppOutletContext` in `types/routing.ts` and the typed object in `App.tsx`
6. Create custom hooks in `hooks/` for data fetching (include AbortController)
7. Extend ShadCN primitives from `components/ui/` — don't duplicate
8. Add types to `types/index.ts` or create `types/<feature>.ts`

### 6.3 Adding a New Widget

1. Add fetch logic to `server/routes/widgets.js`
2. Add type to `client/src/types/widgets.ts`
3. Fetch in `hooks/useWidgets.ts`
4. Render in `WidgetSidebar.tsx` or `SharedWidgets.tsx`

### 6.4 Adding a New MindGames Tab

1. Create subfolder under `features/mindgames/<tab>/`
2. Add route in `features/mindgames/dashboard/CognitiveTabNav.tsx`
3. Add route component in `components/routes/MindGamesRoutes.tsx`
4. Add backend routes for LLM-powered analysis
5. Add types to `types/index.ts`

### 6.5 Using LLM for New Features

- Seed a new prompt in `server/db.js` `prompts` table
- Use `buildMessages('your-prompt-slug', variables)` to construct messages
- Call `callLLM({ messages, purpose: 'your-feature' })`
- Response is logged to `llm_usage` automatically
- Provider fallback is handled automatically

### 6.6 Adding External API Integration

- Create fetcher in `server/lib/` or `server/<feature>/`
- Use `lib/fetchWithTimeout.js` for HTTP requests
- Add caching with simple `Map` + TTL pattern (see `routes/widgets.js` for examples)
- Add env vars to `server/.env.example`
- Expose via route handler

---

## 7. Data Flow Diagrams

### Summary Generation
```
User clicks Refresh → POST /api/categories/:id/refresh
  → Fetch all RSS feeds (Promise.allSettled)
  → Insert articles into articles table
  → buildMessages('category-summary', { articles, lang, customPrompt })
  → callLLM() → Groq or fallback to Google
  → JSON parse with triple-attempt repair
  → Extract sentiment + tags
  → Save to summaries + summary_history
  → Return to client → useSummary hook updates UI
```

### Widget Data
```
App.tsx mounts → useWidgets() fires parallel requests
  → /api/widgets/weather, /rates, /headlines, /crypto, /hackernews, /releases, /tags/trending
  → Each has server-side cache (Map + TTL)
  → Passed as props to LeftSidebar + WidgetSidebar
```

### Chat
```
User types message → POST /api/chat { summaryId, message }
  → User message appended immediately (pessimistic UI)
  → Server fetches summary context + article context
  → callLLM() with conversation history
  → Response added to UI
  → Saved to chat_messages table
```

### Bias Radar (from SummaryView or NewspaperHome)
```
User clicks "Bias Radar" on article card → opens BiasRadarPanel (portal, focus-trapped)
  → Tab: Compare
    → GutCheck: user picks emotional reaction (outraged/skeptical/interested/bored)
    → GET /api/bias-radar/related?articleId=<title>&source=<exclude>&language=<lang>
    → Server searches multiple sources, returns SourceArticle[] with bias ratings
    → SourceCards sorted by BIAS_SORT_ORDER (left → right)
  → Tab: Decode
    → POST /api/bias-radar/decode { headline, content }
    → LLM detects manipulation technique from 12 types
    → TechniqueCard shows: technique name, quoted evidence, explanation, difficulty, confidence
  → Tab: Steelman
    → User types position → POST /api/bias-radar/steelman { userPosition, articleContext }
    → LLM returns { counterArgument, followUpQuestion }
    → User rates convincingness 1-5 → optional rebuttal → follow-up question displayed
```

### MindGames Inoculation
```
User starts session → POST /api/inoculation/generate
  → LLM generates headline with manipulation tactic
  → User identifies tactic → POST /api/inoculation/answer
  → Score updated in cognitive_users table
  → Antibody count incremented
  → Immunity decays 10% after 7 days inactive
```

---

## 8. Configuration Reference

### Server Environment Variables (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Yes (one of two) | Groq LLM provider |
| `OPENROUTER_API_KEY` | Yes (one of two) | OpenRouter/Google fallback |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot integration |
| `TELEGRAM_CHAT_ID` | No | Telegram chat destination |
| `TMDB_API_KEY` | No | Movies/TV releases widget |
| `DB_PATH` | No | SQLite path (default: `./newsreader.db`) |
| `PORT` | No | Server port (default: 3001) |

### Client Environment Variables (build-time)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL for production (default: `/api`) |

---

## 9. File Reference (Key Files)

```
server/
  index.js                    # Express entry, all routes registered
  db.js                       # SQLite schema, table creation, seed data
  lib/llm.js                  # LLM provider system
  lib/rss.js                  # RSS parsing
  lib/promptManager.js        # Prompt template engine
  lib/telegram.js             # Telegram integration
  lib/fetchWithTimeout.js     # HTTP utility
  routes/categories.js        # Category CRUD
  routes/summaries.js         # Summary generation
  routes/chat.js              # AI chat
  routes/jobs.js              # Job board
  routes/widgets.js           # Widget data
  routes/briefing.js          # Morning briefing
  routes/settings.js          # User preferences
  routes/forensics.js         # Fallacy detection
  routes/inoculation.js       # Inoculation game
  routes/scientist.js         # ADEPT debate
  routes/bridge.js            # SOS audit
  routes/bias-radar/          # Bias radar (5 endpoints)
  jobs/sources.js             # 8 job source fetchers
  jobs/ai-filter.js           # AI job relevance filter

client/
  src/App.tsx                 # Root component, routes, widget data flow
  src/config.ts               # API_BASE config
  src/index.css               # Theme definitions (4 themes)
  src/types/index.ts          # All TypeScript types
  src/types/routing.ts        # AppOutletContext interface
  src/types/widgets.ts        # Widget types
  src/types/lens.ts           # Bias radar types (TechniqueName, SourceArticle, GutCheckReaction, etc.)
  src/utils/biasRatings.ts    # AllSides domain → bias rating mapping (~40 outlets)
  src/hooks/useApi.ts         # All data-fetching hooks
  src/hooks/useWidgets.ts     # Widget data hook
  src/hooks/useTheme.ts       # Theme management
  src/components/             # Page-level components
  src/components/ui/          # ShadCN primitives (18)
  src/components/routes/      # Route wrappers
  src/features/mindgames/     # Cognitive dashboard (9 sub-modules)
  src/features/mindgames/bias-radar/
    BiasRadarPanel.tsx        # Slide-over panel (3 tabs, portal, focus-trap)
    BiasRadarCompare.tsx      # Compare tab: GutCheck → related articles
    BiasRadarDecode.tsx       # Decode tab: wraps ForensicPanel
    BiasRadarSteelman.tsx     # Steelman tab: LLM counter-argument flow
    GutCheck.tsx              # Pre-reading emotional state picker
    TechniquePicker.tsx       # Interactive technique guessing (12 options)
    TechniqueCard.tsx         # Detected technique display with evidence
    SourceCard.tsx             # Article card with bias rating badge
    index.ts                  # Barrel exports
```
