# Agent Instructions

## Project Overview

Monorepo: `server/` (Express 5 + SQLite, CommonJS) + `client/` (React 19 + TypeScript + Vite + Tailwind CSS 4).
No shared code between packages. Frontend deploys to Vercel, backend to Railway.

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

### Available Sub-Agents (`.kilo/agent/`)

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `architect` | Structure, data flow, patterns | Before new features, after refactoring |
| `code-reviewer` | Bugs, quality, conventions | After every implementation step |
| `typescript-reviewer` | Type safety, strict mode | After writing/changing TypeScript |
| `frontend-reviewer` | UI/visual, themes, responsive | After any UI/styling change |

### Phased Workflow for New Features

```
1. RESEARCH → Grep/Glob to find affected files
2. PLAN → Use /plan command or architect agent
3. IMPLEMENT → Write code
4. REVIEW → Launch code-reviewer + typescript-reviewer
5. UI CHECK → If frontend changed, launch frontend-reviewer
6. BUILD CHECK → Run tsc --noEmit && npm run build
```

### Slash Commands (`.kilo/command/`)

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
- Typography: Playfair Display (headings), Libre Franklin (body), Inter (UI), Source Sans 3 (widgets)

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

## Architecture Notes

- API base URL configured via `VITE_API_URL` (defaults to `/api`), defined in `client/src/config.ts`
- Vite dev proxy: `/api` → `http://localhost:3001`
- LLM provider fallback: Groq first → OpenRouter, configured in `server/lib/llm.js`
- All widget endpoints have server-side caching (crypto 2min, releases 30min, homepage 5min)
- When adding new context to `AppOutletContext`, add it to the typed object in `App.tsx` AND to the interface in `types/routing.ts`
- Feature folders under `features/mindgames/` follow: `component files` + `index.ts` barrel export
