# Changelog

All notable changes to the news-reader project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Pending (not yet addressed)

- ReleasesPage missing error state for fetch failures (medium priority)
- SummaryView.tsx at ~435 lines needs extraction to smaller components (medium priority)
- Props drilling 7+ levels deep for widget data (low priority, architectural)

---

## [2026-03-27] — Initial Review

### Added
- `client/src/types/widgets.ts` — shared types for Weather, Rates, Headline, ForecastDay, Briefing
- `NavigationBar.tsx` — unified masthead replacing Header + CategoryNav
- `JobsPage.tsx` — full job board with 8 source aggregation and AI filtering
- `ReleasesPage.tsx` — movie/TV release calendar with TMDB integration
- `SentimentBadge.tsx` — sentiment indicator badge component
- `PullToRefresh.tsx` — mobile pull-to-refresh UI
- `SharedWidgets.tsx` — shared WeatherIcon and WidgetHeader
- `useHomepage()` hook — homepage briefs with article images
- `useJobs()` hook — full job board state management
- `usePullToRefresh()` hook — mobile pull-to-refresh logic
- `useMediaQuery()` hook — responsive breakpoint detection
- `src/utils/date.ts` — date formatting utilities
- Server-synced theme preference (GET/PUT `/api/settings`)
- OpenRouter (MiniMax) as second LLM provider
- `POST /api/discover-feed` — RSS feed auto-discovery from URL
- `GET /api/stats/trending` — trending tags from summaries
- `src/components/ui/` — ShadCN UI component library

### Changed
- Refactored widget types to centralized `types/widgets.ts`, removing 15+ duplicate interface definitions
- `useSummaryHistory` refresh now actually works (was a no-op before)
- `useSummary` effect now correctly depends on `providerId`
- NewspaperHome column logic — removed duplicate HN section that was never reachable
- NewspaperHome extra leading space in className (`" mt-3"` → `"mt-3"`)
- SummaryView RateLimitDialog `open={true}` prop ignored (removed redundant prop)
- useJobs updateStatus now rolls back optimistic update on API failure
- NavigationBar removed unused `now` variable and dead `themeRef` / `useRef` import
- NavigationBar moved `LLM_OPTIONS` outside component to avoid recreation on every render
- NavigationBar removed unused `Category` and `Theme` type imports
- App.tsx `handleRefresh` now wrapped in `useCallback` to fix exhaustive-deps warning
- usePullToRefresh ref update moved into `useEffect` to fix "Cannot access refs during render" error
- ChatPanel auto-scroll now respects user scroll position (won't jump to bottom if user scrolled up)
- FilterButton now has `aria-pressed` for accessibility
- JobCard now has `role="button"`, `tabIndex={0}`, and keyboard handler
- ReleasesPage release card now uses `<button>` instead of `<div>` for proper keyboard accessibility
- Theme system now persists to server via `PUT /api/settings/theme`
- All lint errors resolved

### Fixed
- RightSidebar.tsx removed (269 lines, dead code)
- useLlmStats hook removed (was exported but unused)
- DiscoveredFeed interface removed (defined but never imported)
- ReleasesPage missing error state for fetch failures
