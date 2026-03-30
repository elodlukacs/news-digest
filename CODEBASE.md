# Codebase Overview

Quick reference for the news-reader project. See CLAUDE.md for build commands.

## Architecture

Monorepo: `server/` (Express + SQLite) + `client/` (React + Vite)

### Frontend (`client/src/`)

**Entry**: `App.tsx` — Main state: `activeId` (category), `managingId` (feed manager), `selectedDate` (history), `theme`

**Page Components** (`components/`):
| File | Purpose |
|------|---------|
| `NavigationBar.tsx` | Unified masthead + category nav + theme switcher + LLM model selector (desktop + mobile drawer) |
| `NewspaperHome.tsx` | 5-column newspaper grid homepage with article images, headlines, weather, crypto, rates |
| `SummaryView.tsx` | Main article view with parsed markdown, sentiment badges, tags, rate limit dialog, chat panel |
| `FeedManager.tsx` | Modal for managing feeds with 4 tabs: Sources, Discover, Prompt, Language |
| `ChatPanel.tsx` | AI chat with optimistic UI, markdown rendering, scroll tracking |
| `LlmStatsModal.tsx` | Usage stats: tokens, calls, by-provider/by-purpose breakdowns, quota gauges, daily chart |
| `MorningBriefing.tsx` | Cross-category daily digest with rich markdown rendering |
| `JobsPage.tsx` | Job board aggregated from 8 sources, filters (status/source/workType/country/AI), search, pagination, AI curation |
| `ReleasesPage.tsx` | Movie/TV release calendar with type filter, date range, search, detail sheet |
| `WidgetSidebar.tsx` | Right sidebar: weather (temp/condition/wind/humidity + 3-day forecast), crypto ticker, RON rates, trending, headlines |
| `LeftSidebar.tsx` | Left sidebar: archive/history navigation, Hacker News feed |
| `SharedWidgets.tsx` | WeatherIcon (WMO code mapping), WidgetHeader |
| `SentimentBadge.tsx` | Colored sentiment badge (positive/negative/neutral/mixed) with dot indicator |
| `PullToRefresh.tsx` | Mobile pull-to-refresh with touch tracking and progress animation |

**MindGames Feature** (`features/mindgames/`):

Feature-organized folder with 9 sub-modules, each exporting via `index.ts` barrel:

| Folder | Contents |
|--------|----------|
| `common/` | `FeaturePanelHeader` (icon+title row, "The science" dialog, right-side slot), `TabHeader` (tab page header) |
| `dashboard/` | `CognitiveDashboard` (top-level tab router), `CognitiveTabNav` (6-tab bar), `CognitiveTab` type |
| `overview/` | `OverviewTab` — stats grid, quick actions, research credits |
| `training/` | `TrainingTab`, `InoculationPanel` (CDO/detective game), `PatternTests` (coincidence/scatter/sequence/correlation) |
| `analysis/` | `AnalysisTab`, `ForensicPanel` (fallacy detector + psych funnel), `StudyStressTester`, `CompareCoverage`, `NewsSpectrum` |
| `reflection/` | `ReflectionTab`, `ScientistPanel` (ADEPT debate + rethinking journal), `JournalTrends` (Recharts), `BridgePanel` (SOS audit), `InformationDiet` (radial SVG), `StressDiagnostic` (modal) |
| `reference/` | `ReferenceTab`, `PromptLibrary` (searchable prompt templates), `NarrativeMapPanel`, `DisinfoMap` (SVG funnel) |
| `quiz/` | `QuizTab`, `DailyQuiz` (daily technique-guessing quiz) |
| `bias-radar/` | `BiasRadarPanel` (5-tab slide-over), `TechniquePicker` (12-option grid), `TechniqueCard` (result card), plus Compare, Decode, Steelman, Timeline, DietReport, GutCheck, SourceCard |

- `BiasRadarPanel` is used outside MindGames (from SummaryView, NewspaperHome) via `features/mindgames/bias-radar`
- `DailyQuiz` bridges cognitive and bias-radar, importing TechniquePicker + TechniqueCard
- `FeaturePanelHeader` replaces the duplicated header pattern across all 10 feature panels

**UI Components** (`components/ui/`):
Button, Badge, Card, Dialog, Drawer, Sheet, Tabs, Tooltip, ScrollArea, Separator, Progress, Skeleton, Alert, Input, Textarea, DropdownMenu

**Hooks** (`hooks/`):
| Hook | Purpose |
|------|---------|
| `useApi.ts` | useCategories, useFeeds, useSummary (with providerId), useSummaryHistory, useChat, useBriefing, useHomepage, useJobs |
| `useTheme.ts` | Theme state synced to server via GET/PUT /settings |
| `useWidgets.ts` | All widget data: weather, rates, headlines, crypto, HN, releases, trending |
| `useMediaQuery.ts` | Responsive breakpoint detection |
| `usePullToRefresh.ts` | Mobile pull-to-refresh with AbortController |

**Types** (`types/`):
- `types/index.ts`: Category, Feed, Summary, SentimentSection, HistoryEntry, ChatMessage, LlmStats, ProviderQuota, HackerNewsItem, UpcomingRelease, Job, JobStatus, JobSource, RemoteAssessment, JobFilters, JobCounts, ReleaseDetail, HomepageArticle, HomepageBrief
- `types/widgets.ts`: CryptoPrice, ForecastDay, Weather, Rates, Headline, Briefing

### Backend (`server/`)

**Structure**: Modular routes under `routes/`, shared libraries under `lib/`

**Database** (SQLite with WAL, `server/db.js`):
- `categories` — id, name, icon, sort_order, custom_prompt, language
- `feeds` — category_id, name, url
- `summaries` — category_id (UNIQUE), summary, article_count, feed_count, generated_at
- `summary_history` — id, category_id, summary, article_count, feed_count, provider, sentiment_data/tags_data (JSON), date_key, generated_at
- `articles` — cached raw articles
- `llm_usage` — provider, model, prompt/completion/total_tokens, purpose, category_id, latency_ms, created_at
- `chat_messages` — summary_id, role, content, created_at
- `user_settings` — key (PK), value
- `jobs` — id (TEXT PK), title, company, url, source, date_posted, status, country, work_type, description
- `ai_filtered_jobs` — job_id (TEXT PK), remote, filtered_at

**API Routes** (`routes/`):
```
categories.js:
  GET/POST      /api/categories
  GET           /api/categories/:id
  PUT           /api/categories/:id/prompt
  PUT           /api/categories/:id/language
  DELETE        /api/categories/:id

feeds.js:
  GET/POST      /api/categories/:id/feeds

feedDelete.js:
  DELETE        /api/feeds/:id

summaries.js:
  GET           /api/categories/:id/summary?date=&snapshotId=
  GET           /api/categories/:id/history
  POST          /api/categories/:id/refresh

chat.js:
  GET           /api/chat/:summaryId
  POST          /api/chat

briefing.js:
  GET           /api/briefing/latest
  POST          /api/briefing/generate

jobs.js:
  GET           /api/jobs?status=&source=&workType=&search=&country=&aiOnly=&page=&limit=
  POST          /api/jobs/fetch
  PATCH         /api/jobs/:id/status
  POST          /api/jobs/ai-filter

stats.js:
  GET           /api/stats/llm?days=30
  GET           /api/stats/trending

widgets.js:
  GET           /api/widgets/weather
  GET           /api/widgets/rates
  GET           /api/widgets/headlines
  GET           /api/widgets/crypto
  GET           /api/widgets/hackernews
  GET           /api/widgets/releases?from=&to=
  GET           /api/widgets/releases/:type/:id

homepage.js:
  GET           /api/homepage
  POST          /api/homepage/refresh

settings.js:
  GET           /api/settings
  PUT           /api/settings/:key

telegram.js:
  POST          /api/telegram/send

discovery.js:
  POST          /api/discover-feed
```

**LLM** (`lib/llm.js`):
- Provider array: Groq (openai/gpt-oss-20b) + OpenRouter (minimax/minimax-m2.7)
- Provider fallback with try/catch, respects `providerId` parameter
- Rate limit headers captured into `providerQuotas` (in-memory)
- Token usage logged to `llm_usage` table
- 2 calls per summary: main + enrichment (sentiment + tags)

**Jobs** (`jobs/`):
- 8 source fetchers: RemoteOK, WeWorkRemotely, Himalayas, Remotive, ArbeitNow, LinkedIn, Indeed, HackerNews
- AI filter batches 100 jobs at a time for relevance + remote assessment
- Status tracking: new → applied/ignored

**Caching**:
- Crypto (CoinGecko): 2min
- Releases (TMDB): 30min (Map, max 20 entries, LRU)
- Homepage: 5min
- Job fetch debounce: 30min

## Key Patterns

1. **Provider fallback**: Iterate `AI_PROVIDERS` with try/catch, captures rate limits
2. **AbortController**: useSummary and useJobs cancel in-flight requests
3. **Pessimistic chat UI**: User message added immediately, server returns assistant response
4. **Widget data flow**: Single `useWidgets()` in App, passed as props to both sidebars
5. **Server-synced theme**: Theme preference persisted to `user_settings` table
6. **LLM JSON repair**: Triple-attempt parse with fallback heuristics for malformed JSON

## Env Vars

**Server** (`server/.env`):
- `GROQ_API_KEY` — LLM provider (Groq)
- `OPENROUTER_API_KEY` — LLM provider fallback (MiniMax)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — optional, send-to-Telegram
- `TMDB_API_KEY` — optional, movie/TV releases
- `DB_PATH` — path to SQLite (default: `./newsreader.db`)
- `PORT` — defaults to 3001

**Client** (build-time only):
- `VITE_API_URL` — backend URL for production split deployment
