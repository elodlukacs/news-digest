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

### Backend (`server/index.js` — single file)

- Express 5 with better-sqlite3 (WAL mode, auto-creates tables on startup)
- `callLLM()` helper with **provider fallback**: tries Groq (llama-3.3-70b-versatile). Filters by configured API keys, captures rate-limit headers into in-memory `providerQuotas` object
- Each summary generation triggers **two LLM calls**: main summary + enrichment (sentiment + tags)
- Category-level `custom_prompt` and `language` fields customize LLM output
- Widget endpoints proxy external APIs with server-side caching (crypto: 2min, TMDB: 30min)

### Frontend (`client/src/`)

- React 19 + TypeScript + Tailwind CSS 4 (using `@theme` directive, not `tailwind.config.js`)
- All API calls route through `API_BASE` from `client/src/config.ts` which reads `VITE_API_URL` env var (defaults to `/api`)
- Vite dev server proxies `/api` to `localhost:3001` (see `vite.config.ts`)
- `useApi.ts` has a `BASE` constant imported from config — all data hooks use this
- Three-column layout: `LeftSidebar` (releases, archive, HN) | main content | `WidgetSidebar` (weather, crypto, rates, trending, headlines)

### Theme System (`client/src/index.css`)

Four themes via CSS custom properties + `[data-theme]` attribute on `<html>`:
- **classic** (default): warm newsprint (#F5F0E8, brown masthead)
- **broadsheet**: cool NYT-style (#FAFAF9, navy masthead)
- **evening**: dark mode (#1A1A2E, gold masthead)
- **morning**: fresh green (#FDF6EC, green masthead)

Typography: Playfair Display (headings), Lora (body text), Inter (UI), Source Sans 3 (widgets).

### Database Tables

Core: `categories`, `feeds`, `summaries`, `summary_history` (with `sentiment_data`/`tags_data` JSON columns), `articles`, `llm_usage`, `chat_messages`, `user_settings`. Morning briefings use `category_id = 0` in `summary_history`.

## Key Patterns

- **Provider fallback**: `AI_PROVIDERS` array in server, iterated with try/catch per provider
- **Widget data flow**: Single `useWidgets()` call in `App.tsx`, data passed as props to both sidebars (avoids double-fetching)
- **AbortController**: `useSummary` cancels in-flight requests when switching categories
- **Chat**: Pessimistic UI — user message added immediately, then sent to server which returns assistant response with summary context

## Environment Variables

**Server** (`server/.env`):
- `GROQ_API_KEY` — required for LLM features
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — optional, for send-to-Telegram feature
- `TMDB_API_KEY` — optional, for movie/TV releases widget
- `DB_PATH` — path to SQLite file (default: `./newsreader.db`). Set to a Railway volume path for persistence.
- `PORT` — defaults to 3001

**Client** (build-time only):
- `VITE_API_URL` — backend URL for production split deployment (e.g., `https://your-railway-app.up.railway.app/api`)

## Deployment

- **Frontend**: Vercel (build command: `cd client && npm install && npm run build`, output: `client/dist`)
- **Backend**: Railway (root directory: `server`, start: `node index.js`, needs `PORT` env var)
- **Database persistence**: Attach a Railway volume (e.g. mounted at `/data`), then set `DB_PATH=/data/newsreader.db`
- `vercel.json` and `server/nixpacks.toml` configure deployment
- After deploying backend, set `VITE_API_URL` in Vercel env vars and redeploy
