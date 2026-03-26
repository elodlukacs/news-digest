# Codebase Overview

Quick reference for the news-reader project. See CLAUDE.md for build commands.

## Architecture

Monorepo: `server/` (Express + SQLite) + `client/` (React + Vite)

### Frontend (`client/src/`)

**Entry**: `App.tsx` - Main state: `activeId` (category), `managingId` (feed manager), `selectedDate` (history), `theme`

**Components**:
| File | Purpose |
|------|---------|
| `Header.tsx` | Masthead, date, theme switcher (4 themes), stats button |
| `CategoryNav.tsx` | Horizontal nav bar with categories |
| `SummaryView.tsx` | Main article view with chat panel |
| `NewspaperHome.tsx` | Front page when no category selected |
| `LeftSidebar.tsx` | Archive/historical summaries |
| `RightSidebar.tsx` | Widgets + date picker for history |
| `WidgetSidebar.tsx` | Weather, crypto, rates, HN, releases |
| `FeedManager.tsx` | Modal to add/remove RSS feeds |
| `ChatPanel.tsx` | AI chat about current summary |
| `LlmStatsModal.tsx` | Usage statistics modal |
| `MorningBriefing.tsx` | Cross-category daily digest |

**Hooks** (`hooks/useApi.ts`):
- `useCategories()` - CRUD for categories
- `useFeeds(categoryId)` - CRUD for feeds in a category
- `useSummary(categoryId, date)` - Load/refresh summaries with AbortController
- `useSummaryHistory(categoryId)` - Get dates with summaries
- `useChat(summaryId)` - Chat messages for a summary
- `useBriefing()` - Morning briefing (load + generate)
- `useTheme()` - Theme state (persisted to localStorage)
- `useWidgets()` - All widget data (weather, crypto, rates, HN, releases, headlines)

**Types** (`types/index.ts`):
- `Category`, `Feed`, `Summary`, `HistoryEntry`, `ChatMessage`
- `SentimentSection` - `{title, sentiment: 'positive'|'negative'|'neutral'|'mixed', tags}`
- `LlmStats`, `ProviderQuota`
- `CryptoPrice`, `HackerNewsItem`, `UpcomingRelease`

**Styling** (`index.css`):
- Tailwind CSS 4 with `@theme` directive
- CSS vars for colors: `--color-paper`, `--color-ink`, `--color-masthead`, etc.
- Themes: `classic` (warm), `broadsheet` (NYT cool), `evening` (dark), `morning` (fresh green)
- Fonts: Playfair Display (headings), Lora (body), Inter (UI), Source Sans 3 (widgets)

### Backend (`server/index.js`)

**Database** (SQLite with WAL):
- `categories` - id, name, icon, sort_order, custom_prompt, language
- `feeds` - category_id, name, url
- `summaries` - category_id, summary, article_count, feed_count, generated_at
- `summary_history` - date_key based archives with sentiment_data/tags_data JSON
- `articles` - cached raw articles
- `llm_usage` - usage tracking
- `chat_messages` - per-summary chat history

**API Routes**:
```
GET/POST/DELETE /api/categories
GET/PUT    /api/categories/:id/prompt
GET/PUT    /api/categories/:id/language
GET/POST   /api/categories/:id/feeds
GET        /api/categories/:id/summary?date=YYYY-MM-DD
GET        /api/categories/:id/history
POST       /api/categories/:id/refresh  (fetch feeds → LLM → save)
POST       /api/briefing/generate
GET        /api/briefing/latest
GET/POST   /api/chat/:summaryId
GET        /api/stats/llm?days=30
```

**LLM** (`callLLM` function):
- Provider array: currently Groq only (llama-3.3-70b-versatile)
- Falls through providers on failure
- Tracks rate limits in `providerQuotas` (in-memory)
- Stores usage in `llm_usage` table
- 2 calls per summary: main + enrichment (sentiment + tags)

**Widgets** (proxied with caching):
- Crypto: CoinGecko
- Weather: Open-Meteo
- Rates: Frankfurter (RON)
- Movies/TV: TMDB
- HN: Hacker News API

## Key Patterns

1. **Provider fallback**: Iterate `AI_PROVIDERS` with try/catch, capture rate limits
2. **AbortController**: `useSummary` cancels in-flight requests on category switch
3. **Pessimistic chat UI**: User message added immediately, then sent to server
4. **Widget data flow**: Single `useWidgets()` in App, passed as props to both sidebars
5. **Summary history**: `summary_history` table with date_key for archive navigation

## Env Vars

- Server: `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TMDB_API_KEY`
- Client: `VITE_API_URL` (production backend URL)
