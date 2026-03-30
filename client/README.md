# News Digest — Frontend

React 19 + TypeScript + Tailwind CSS 4 frontend, built with Vite.

## Development

```bash
npm install
npm run dev        # Start dev server (port 5173, proxies /api to localhost:3001)
npm run lint       # ESLint
npm run build      # Production build → dist/
npx tsc --noEmit   # Type-check
```

## Architecture

**Entry**: `src/App.tsx` — manages active category, theme, widget data, and routing.

**Pages**: `NewspaperHome` (5-column grid), `SummaryView` (article view + chat), `JobsPage` (8-source aggregator), `ReleasesPage` (TMDB calendar), `MorningBriefing` (daily digest)

**Layout**: Three-column — `LeftSidebar` (archive, Hacker News) | main content | `WidgetSidebar` (weather, crypto, rates, trending, headlines)

**MindGames** (`src/features/mindgames/`): Cognitive Resilience Dashboard with 9 sub-modules organized into Overview, Training, Analysis, Reflection, Reference tabs plus Bias Radar.

**Hooks** (`src/hooks/`): `useApi.ts` (categories, feeds, summaries, chat, briefing, homepage, jobs), `useTheme.ts`, `useWidgets.ts`, `useMediaQuery.ts`, `usePullToRefresh.ts`

**Theme System** (`src/index.css`): 4 themes via CSS custom properties — Classic (warm newsprint), Broadsheet (NYT-style), Evening (dark mode), Morning (green). Synced to server via `PUT /api/settings/theme`.

**UI**: ShadCN components in `components/ui/`, Recharts for charts, Playfair Display + Lora + Inter + Source Sans 3 typography.

## Configuration

**Build-time env vars**:
- `VITE_API_URL` — backend URL for split deployments (defaults to `/api`)

See the root [README.md](../README.md) for full project documentation.
