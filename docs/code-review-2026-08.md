# Code Review & Feature Roadmap — August 2026

Produced by five parallel review agents (backend, frontend, security, architecture, feature ideation) against commit `f60f4bd`. All four review agents returned **request changes**.

> **Status:** all 10 must-fix items, the whole [Should fix](#should-fix) list,
> and 6 of the 7 [ideation bugs](#bugs-found-during-ideation) are **fixed**.
> Still open: the [Structural](#structural) refactors, 9 remaining lint errors,
> and all Part 2 features. See [What was fixed](#what-was-fixed).

- [What was fixed](#what-was-fixed)
- [Part 1 — Code review](#part-1--code-review)
  - [Must fix](#must-fix-data-loss--cost--broken-in-prod)
  - [Should fix](#should-fix)
  - [Structural](#structural)
- [Part 2 — Feature roadmap](#part-2--feature-roadmap)
  - [Bugs found during ideation](#bugs-found-during-ideation)
  - [New features](#new-features)
  - [Upgrades to existing features](#upgrades-to-existing-features)
- [Suggested order of work](#suggested-order-of-work)

---

# What was fixed

Every must-fix item below is resolved. Findings keep their original wording as a
record of the defect; where the implementation deviated from the proposed fix,
the reason is noted here.

### New modules

| File | Purpose |
|---|---|
| `server/lib/safeFetch.js` | SSRF-hardened fetch: protocol allowlist, DNS resolution checked against loopback/RFC1918/link-local/CGNAT/IPv6-ULA/6to4/Teredo, redirects re-validated per hop (max 3), timeout, streamed body cap. Exports `safeFetch`, `assertPublicUrl`. |
| `server/lib/inFlight.js` | `runExclusive` (second caller joins the first run) and `lockHandler` (second caller gets 409) for expensive POSTs. |
| `server/middleware/auth.js` | Bearer/`x-api-key` check with `timingSafeEqual`. No-op when `API_TOKEN` is unset, so local dev is unchanged. |
| `server/middleware/rateLimit.js` | Fixed-window per-IP limiter, dependency-free. |
| `server/middleware/errors.js` | JSON 404 + terminal error handler. Only `err.expose`/4xx messages reach the client. |
| `client/src/utils/safeHref.ts` | Returns `undefined` for anything that isn't http(s), making the anchor inert. |
| `client/src/lib/apiFetch.ts` | One-time `window.fetch` patch: attaches `VITE_API_TOKEN`, and turns an HTML response to an API request into an explicit error. |

### Deviations from the proposed fixes

- **#1** — used a `prompts.source_hash` content hash rather than
  `updated_at == created_at`. The timestamp heuristic can't distinguish a user
  edit from the old force-update's own write, so it would have frozen every
  prompt permanently. Now a prompt is overwritten only while it still hashes to
  what the code last wrote; anything edited is preserved and named in the startup
  log, and `PROMPT_SEED_FORCE=1` adopts the code versions deliberately.
- **#2** — `config.ts` warns instead of throwing when `VITE_API_URL` is unset in
  production, because the nginx `/api` proxy added in the same change makes the
  `/api` default *correct* for the Docker deploy. Throwing would break a valid
  setup. The silent-failure mode is instead caught at runtime by `apiFetch.ts`,
  which covers all call sites rather than just the ones using hooks. The nginx
  upstream is held in a variable with a `resolver` directive so nginx still
  starts if the backend name doesn't resolve (502s rather than refusing to boot).
- **#3** — hand-rolled auth/rate-limit/security-headers instead of adding
  `helmet` + `express-rate-limit`. Single-process server serving only JSON; a
  shared rate-limit store buys nothing and the dependency count stays flat.
- **#5** — 90 s timeout (`LLM_TIMEOUT_MS`), not 60 s: a 30-article summary on a
  slow free-tier model legitimately runs longer than a minute.
- **#7** — delegated to the `compare-coverage` prompt rather than returning 501,
  so `NewsSpectrum.tsx` keeps working. The prompt instructs the model to describe
  characteristic framing and leave `keyQuote` empty rather than invent quotes.

### Round 2 — the rest of "should fix" and the ideation bugs

**New modules (round 2)**

| File | Purpose |
|---|---|
| `server/lib/attribution.js` | Matches an LLM summary section back to its source article: `source_index` → normalized URL → exact title → fuzzy title. Fixes the missing bias bars/badges/images. |
| `server/lib/retention.js` | The single retention policy, run on a timer from startup. Replaces the two racing implementations. |
| `server/lib/feedHealth.js` | Feed URL normalization (`feeds.url_key`) plus success/failure tracking. |

**Backend**

- **Attribution** — the exact-title match is replaced by a four-step cascade with a similarity threshold, a minimum shared-token count, and a runner-up margin, so an ambiguous wire story stays unattributed rather than getting a *wrong* source badge. Unmatched sections are now counted and logged instead of failing silently.
- **Retention** — one `generated_at`-based policy, on a 6-hour timer, no longer mutating the DB inside a GET. It also purges the Break feature's `summary_id = 0` chat rows, which neither old policy could reach. First run cleared a backlog of 136 summaries and 1402 usage rows.
- **Briefing** — reads *all* feeds per category (was `ORDER BY id ASC LIMIT 1`), reuses a category summary generated in the last 6 hours instead of re-fetching and re-summarising, and persists `sentiment_data`/`tags_data` so briefing sections get source badges and feed trending tags. Adds a reading-time estimate.
- **`/api/stats/llm`** — three `GROUP BY` queries instead of loading the table and running five reduce passes.
- **Indexes** — `articles(link)`, `chat_messages(summary_id, article_title)`, `llm_usage(purpose)`, `llm_usage(provider)`.
- **`renderPrompt`** — function-form `replaceAll`, so `$&`/`$1` in article text no longer rewrites the prompt.
- **`routes/logs.js`** — `Europe/Bucharest` via `toLocaleString('sv-SE')` instead of a hardcoded UTC+3 that was wrong half the year.
- **`widgets.js`** — `lat`/`lon` parsed and range-checked, TMDB `id` restricted to digits (it lands in the upstream *path*), and all eight upstream calls status-checked via one `fetchUpstreamJson`.
- **`parseJSON`** — the four implementations collapse to one, and the shared version gains the truncation recovery it previously lacked, so all 13 routes that use it can now salvage a response cut off mid-array.
- **`matchOutlet`** — precomputed index + bounded memo cache; was four O(n) passes with `normalize()` recomputed per outlet per pass, per article.
- **`decode`** — results cached in `article_decodes`; the same article no longer re-runs the model on every open.
- **`settings.js`** — `custom_css` removed from `ALLOWED_KEYS` (no reader anywhere), plus a value-length cap.
- **`stats/trending`** removed — a byte-identical duplicate of `tags/trending`, which is the one the client calls.
- **Feed health** — `feeds.url_key` (normalized) is used for insert dedupe and the Explore page's `subscribed` flag; `last_ok_at`/`last_error`/`consecutive_failures` are recorded per refresh and returned with each feed.
- **`skill_events`** — one answer log across every exercise, plus `GET /api/gamification/mastery` returning per-technique accuracy, weakest first.

**Frontend**

- Abort + cleanup on `NewsSpectrum`, `ManipulationLabPanel` (its `abortRef` was declared and never used) and `InoculationPanel` (one shared ref across three streams meant answering cancelled an in-flight craft request).
- `ManipulationLabPanel` checks `res.ok` before pushing into `roundScores` and restores `stage` on error instead of spinning forever.
- `useWidgets` rewritten: module-level TTL cache + shared in-flight request, so navigating between Briefing and Releases no longer re-fires eight requests, and per-widget errors are exposed.
- Outlet context memoized; `selectedLlm` persisted.
- `SummaryView` keys sections by `url || title` instead of array index.
- `EchoChamberSimulator` uses a deterministic per-post hash — the simulation is now reproducible and the render is pure.
- `DisinfoMap` (3 shapes) and `NarrativeMapPanel` simulate-mode nodes are keyboard-reachable with `role`/`tabIndex`/Enter+Space.
- `escapeHtml` removed from React children (it was double-escaping `&`), timeouts tracked and cleared, `ChallengeQuiz` aborts on close, `PatternTests` non-null assertions replaced with a guard.

### Also fixed (from "should fix", round 1)

- `req.body || {}` across all 23 route files — a non-JSON POST returned 500, now 400.
- `page`/`limit` clamped in `GET /api/jobs` (`clampInt`, max 200).
- `runExclusive`/`lockHandler` on `POST /:id/refresh`, `/api/jobs/fetch`, `/api/briefing/generate`.
- `jobs/ai-filter.js` discards LLM results whose job ID wasn't in the batch.
- `llm_usage.model` now records `resolvedModel`, so stats match the model actually called.
- Upstream provider error bodies are logged, not returned.
- `useGamification` returns `applyRecoveryBoost` — the `use*` name was a genuine `rules-of-hooks` violation.
- `DisinfoMap.tsx` stale closure: `loadMap` now depends on `selectedLlm`.
- `ExploreFeedsPage.tsx` hardcoded `/api/categories` → `API_BASE`, plus a `res.ok` check.
- `HomeRoute` elaborate/chat calls now abort and guard against a superseded article.
- Docker health check probes `/api/health` instead of `/api/categories`.
- `SIGTERM`/`SIGINT` checkpoint the WAL and close the DB.

Lint went from **14 errors / 6 warnings to 9 / 7**. `tsc --noEmit` and
`npm run build` are clean.

### Verified by hand

Round 1: prompt edit survives restart and `PROMPT_SEED_FORCE=1` restores;
`assertPublicUrl` rejects loopback/link-local/RFC1918/CGNAT/ULA/IPv4-mapped and
non-http schemes; 401 without token / 200 with / 403 on a disallowed origin; 429
after 20 LLM-route requests; JSON 404; `?limit=999999&page=abc` clamps to 200/1;
SSRF rejected at both feed-insert and discovery; real feed discovery against
theverge.com works through `safeFetch`.

Round 2, with throwaway test scripts:

- **Attribution, 12 cases** — exact URL, URL with tracking params, http-vs-https,
  exact title, two *rewritten* titles (the actual bug), explicit `source_index`,
  unmatchable input; plus adversarial cases proving two near-identical wire
  headlines stay unattributed rather than getting a wrong badge, and that a
  single shared token is not enough. All pass.
- **`parseJSON`, 7 cases** — plain, fenced, trailing comma, leading prose,
  truncated array, truncated nested object, garbage. All pass.
- **`matchOutlet`** — output unchanged after memoization.
- **Live endpoints** — TMDB path traversal → 400; weather param injection
  sanitised; `skill-event` → `mastery` round-trip returns the recorded accuracy.

### Not addressed

- **All of [Structural](#structural)** — the two enabling refactors (prompts out
  of `db.js`, a real migration runner), repositories, the shared `biasRatings`
  data, route-mount cleanup, lazy-loading the mindgames tabs, splitting
  `SummaryView`, observability, and a real test framework. The round-2 test
  scripts are throwaway files in the session scratchpad, not committed — they
  should become the first Vitest suite.
- **9 remaining lint errors** — all instances of two patterns the React Compiler
  rejects: `setState` called synchronously inside an effect
  (`ArticleChatPopup`, `SummaryView`, `OverviewTab`, `useSummaryHistory`) and
  refs accessed during render (`useSwipeGesture`, a dead file). Each needs the
  hook restructured, not a one-line change.
- **Dead code** — ~556 lines across 6 files with zero importers, plus a `.bak`
  file. Not deleted: that needs your go-ahead.
- **`routes/telegram.js`** still unmounted — deliberately, since exposing an
  unauthenticated outbound-message endpoint should be a conscious choice.
- **`articles.topic_id`** still computed and unread. Left in place because
  Story Threads (feature #1) is exactly what it was built for.
- **All Part 2 features** (10 new, 6 upgrades) — except that upgrades **B**, **D**
  and **F** are now partly delivered by the `skill_events` table, the briefing
  rewrite, and feed health/normalization respectively.

---

# Part 1 — Code review

## Must fix (data loss / cost / broken in prod)

### 1. Startup wipes user-edited prompts — ✅ FIXED
`server/db.js:890-1134`, `:1137-1334`, `:1337-1393`, `:1398-1427`

`updateInoculationPrompts` / `updateEnhancementPrompts` / `updateSurprisePrompts` run
`ON CONFLICT(slug) DO UPDATE SET system_message=excluded.system_message, user_prompt=excluded.user_prompt`
on **every boot**. Any edit made through `PUT /api/prompts/:slug` (`routes/prompts-manager.js:25`) is destroyed on the next restart — i.e. on every deploy.

**Fix:** seed with `INSERT OR IGNORE`; gate force-updates on a `prompts.version` / `source_hash` column so only untouched prompts (`updated_at == created_at`) get overwritten.

### 2. API base URL resolves to HTML in production — ✅ FIXED
`client/src/config.ts`, `vercel.json`, `client/nginx.conf`, `client/Dockerfile`

`config.ts` is `import.meta.env.VITE_API_URL || '/api'`. Both production paths break when the env var is unset:

- **Vercel** — `vercel.json` rewrites `/((?!assets/).*)` → `/index.html`, which **matches `/api/*`**.
- **CasaOS/Docker** (what the GitHub workflows actually use) — `nginx.conf` has **no `location /api/` proxy block**, and `Dockerfile` defaults `ARG VITE_API_URL=/api`, so `try_files … /index.html` does the same.

Every API call returns HTTP 200 with an HTML body, so `res.ok` is true and `res.json()` throws — surfacing as "Invalid response from server" rather than a network error.

**Fix:** (a) add `location /api/ { proxy_pass http://newsreader-api:3001; }` and put both containers on one compose network — then `/api` is correct by default with no build-time env var; (b) exclude `api/` from the Vercel rewrite regex; (c) make `config.ts` throw at module load when `import.meta.env.PROD && !VITE_API_URL` instead of degrading to a same-origin guess.

### 3. No authentication, wildcard CORS, on LLM-spending endpoints — ✅ FIXED
`server/index.js:8` (`app.use(cors())`) + all ~40 routers mounted at `:12-51`

`Access-Control-Allow-Origin: *` with no auth middleware, and the backend is reachable by the Vercel frontend per `.github/workflows/deploy-backend.yml` — so this is not localhost-only. Any web page the owner visits can:

- `DELETE /api/categories/:id` and wipe feeds
- Rewrite system prompts via `PUT /api/prompts/:slug` or `PUT /api/categories/:id/prompt` → **persistent prompt injection** into every future summary and Telegram digest
- Drain the Groq/OpenRouter keys via `/api/chat`, `/api/forensics`, `/api/spectrum`, `/api/briefing/generate`
- Read every response (wildcard CORS makes responses readable, not just fire-and-forget)

**Fix:** `cors({ origin: [<vercel origin>], credentials: false })`, a shared-secret bearer check (`crypto.timingSafeEqual`) applied before all routers, and `express-rate-limit` with a tighter bucket on LLM routes. Neither `helmet` nor `express-rate-limit` is currently a dependency.

### 4. SSRF — unauthenticated arbitrary server-side fetch — ✅ FIXED
`server/routes/discovery.js:6-13`, `server/routes/feeds.js:16-23`

`POST /api/discover-feed` fetches `req.body.url` verbatim: no protocol allowlist, no private-IP/DNS-rebind check, no `AbortController` (the existing `lib/fetchWithTimeout.js` is not used here), unbounded `await resp.text()`. `discovered[]` echoes regex-extracted `<link>` titles/hrefs back, so it is partly reflective. Combined with #3, any page can port-scan and fingerprint the LAN behind the CasaOS box (`http://192.168.1.1/`, `http://169.254.169.254/`, `http://localhost:<port>/`).

`feeds.js` validates protocol only, not host — and stored feed URLs are later fetched server-side by `routes/summaries.js:130`, `routes/briefing.js:26`, `routes/widgets.js:82`, `routes/telegram.js:92`, `jobs/refreshSummary.js:61`. POST a feed with `url=http://192.168.1.10:8080/admin`, trigger a summary, and the internal response body is fed to the LLM and rendered in the summary — blind SSRF becomes data exfil.

**Fix:** shared helper — allowlist `http:`/`https:`, resolve the hostname and reject loopback / link-local / RFC1918 / CGNAT / IPv6-ULA, re-check after redirects (cap at 3), route through `fetchWithTimeout`, cap the body (~512 KB–2 MB, stream and abort). Apply at insert time *and* at fetch time (stored rows predate validation). Also set `{ timeout, maxRedirects: 3 }` on the shared parser in `server/lib/rss.js:3`.

### 5. `callLLM` has no request timeout — ✅ FIXED
`server/lib/llm.js:107`

`fetch` is called with no `signal`. The provider loop only advances on throw / `!ok`, so a stalled connection **never** falls back to the next provider and the HTTP request never resolves. A specified `providerId` also collapses `providers` to one entry (`:57-80`), so a single 429 fails the whole request with no retry.

**Fix:** `AbortController` with a per-call budget (~60 s), treat `AbortError` as a provider failure so the loop continues, and add one retry with backoff on 429/5xx before moving on.

### 6. Destructive job wipe happens outside the insert transaction — ✅ FIXED
`server/routes/jobs.js:76-93`

`DELETE FROM ai_filtered_jobs` + `DELETE FROM jobs` commit in their own transaction; the inserts run in a **second** transaction at `:90`. If `fetchAllSources` returns an empty/partial set (all-sources-erroring is silently tolerated — `jobs/sources.js:671-693`) or the insert loop throws mid-way, the jobs table is left empty. `GET /api/jobs` served between the two transactions sees zero rows.

**Fix:** one `db.transaction(() => { delete…; insert… })()`, plus an early 502 when `sources.every(s => s.error)`.

### 7. Fabricated analysis served as real output — ✅ FIXED
`server/routes/spectrum.js:511-616`

`POST /api/spectrum/compare` is declared `async`, awaits nothing, and returns ~110 lines of hardcoded `mockHeadlines` / `commonFacts` plus a `summary` string asserting *"This analysis compares how N outlets … cover {topic}"*, tagged `provider: 'static'`. For a media-literacy product this is the worst possible defect class. `routes/compare.js:10` already does this properly via the `compare-coverage` prompt.

**Fix:** delete the mock block and delegate to the same LLM path, or return 501 until implemented.

### 8. Refetch storm + implicit paid LLM call on mount — ✅ FIXED
`client/src/components/routes/HomeRoute.tsx:179,186,292,302`; `client/src/hooks/useApi/useSummary.ts:40-51,61`

- `fetchArticle` depends on `selectedCategoryIds`, and the effect depends on `fetchArticle`. `toggleCategory` (`:292`) mutates that array on every tap **inside the still-open sheet**, so each chip tap aborts and re-issues `GET /homepage/surprise` — then "Apply" (`:302`) fires another. Fix: separate `appliedCategoryIds` (written only by `handleApplyFilter`) from sheet-local draft state.
- `useSummary`: when `GET /summary` returns nothing the effect immediately `POST`s `/refresh` — **an LLM call with no user intent**. `providerId` is in the deps, so changing the model in the navbar re-runs the load and can re-fire it. Fix: drop `providerId` from the load effect (only `refresh` needs it) and add an explicit "Generate summary" affordance.

### 9. `javascript:` hrefs from feed data — ✅ FIXED
`HomeRoute.tsx:526`, `features/mindgames/bias-radar/SourceCard.tsx:30`, `features/mindgames/quiz/DailyQuiz.tsx:136`, `components/JobsPage.tsx:410`, `components/WidgetSidebar.tsx:145`

React does not block `javascript:` in `href`, so a malicious RSS item's `<link>` yields script execution on click.

**Fix:** one `safeHref(url)` helper returning `undefined` unless the parsed protocol is `http:`/`https:`. Note `dompurify` is in `client/package.json` and never imported anywhere — use it or drop it.

### 10. No 404 or error-handling middleware — ✅ FIXED
`server/index.js:53`

`app.listen` follows the routers with nothing in between. Six route files have **zero** `catch` (`bias-mirror.js`, `gamification.js`, `feedDelete.js`, `logs.js`, `settings.js`, `spectrum.js`). Express 5 forwards async rejections, but the *default* handler answers with an HTML stack-trace page whenever `NODE_ENV !== 'production'`, and unmatched `/api/*` returns HTML too — so the client's `res.json()` throws instead of reading `{error}`.

**Fix:** terminal `app.use((req,res) => res.status(404).json({error:'Not found'}))` and `app.use((err,req,res,next) => …)` always emitting `{ error, code }`. This also removes ~59 duplicated `res.status(500).json({ error: err.message })` blocks. Add `process.on('unhandledRejection'/'uncaughtException')` logging and a `SIGTERM` handler calling `db.close()` — restarts currently leave WAL unflushed. Add a real `GET /api/health`; both Dockerfile healthchecks currently probe `/api/categories`, i.e. they exercise the DB and prompt seeding to answer "is the process up".

---

## Should fix

> **All items in both tables below are fixed.** Kept for the record of what
> the defect was; see [Round 2](#round-2--the-rest-of-should-fix-and-the-ideation-bugs)
> for how each was addressed.

### Frontend

| Issue | Location | Fix |
|---|---|---|
| `npm run lint` is at **14 errors / 6 warnings** — no CI gate is meaningful | — | Get to zero |
| Real `rules-of-hooks` violation: `useGamification` returns a plain async function named `useRecoveryBoost` | `features/mindgames/quiz/QuizTab.tsx:23`, `hooks/useGamification.ts` | Rename to `applyRecoveryBoost` at definition + both call sites |
| Stale closure pins the LLM provider forever — `useCallback` with `[]` deps reads `selectedLlm` | `features/mindgames/reference/DisinfoMap.tsx:86-107` (reads at `:95`) | Add `selectedLlm` to deps |
| Elaborate/chat fetches have no `signal` and no article guard — a late response paints the previous article's text under the new headline | `HomeRoute.tsx:212-240,242-290` | Per-request controller aborted in `fetchArticle`; capture `article.link` and bail if changed |
| `setState` after unmount, no abort — `ManipulationLabPanel` even declares an `abortRef` at `:67` and never aborts it | `NewsSpectrum.tsx:91-130`, `DisinfoMap.tsx:86-111`, `ManipulationLabPanel.tsx:70-87` | Controller per call + `return () => ctrl.abort()` |
| One shared `abortRef` across three independent request streams — answering kills an in-flight craft request | `InoculationPanel.tsx:104,146,179,235` | One ref per stream |
| Stale-state write from closure | `InoculationPanel.tsx:165` | `setSession(prev => ({ ...data, score: prev?.score ?? 0 }))` |
| Error path leaves panel spinning; `res.ok` unchecked so an error body is pushed into `roundScores` | `ManipulationLabPanel.tsx:141-144,156-182` | Check `res.ok`; `setStage('guessing')` in catch |
| Hardcoded `/api/categories` ignores `API_BASE`; `res.ok` unchecked | `ExploreFeedsPage.tsx:422-423` | Import `API_BASE`; better, have `addCategory` return the created row |
| Array-index key tied to per-item UI state — a refresh reorder leaves the quiz open on the wrong article | `SummaryView.tsx:455`, state at `:119` | Key and track by `section.url \|\| section.title` |
| `Math.random()` inside `useMemo` — posts flicker non-monotonically per slider tick; also a React Compiler impurity error | `EchoChamberSimulator.tsx:61` | Seed a stable per-post roll once |
| Outlet context object recreated every render → all `useOutletContext` consumers re-render, downstream `useCallback` deps churn | `AppLayout/AppLayout.tsx:56-66`, `CategoryRoute.tsx:47` | `useMemo` with the nine fields; depend on `ctx.deleteCategory` not `ctx` |
| Widget requests re-issued per route mount — 8 parallel requests on every nav between Briefing and Releases, no per-widget error state | `hooks/useWidgets.ts:22-31` | Hoist into a provider above `Outlet`, or module-level TTL cache |
| Clickable SVG shapes keyboard-unreachable (no `tabIndex`/`role`/`onKeyDown`/`aria-expanded`) — the whole funnel and simulate mode are mouse-only | `DisinfoMap.tsx:262-273,305-316,354-367`; `NarrativeMapPanel.tsx:489-495` | Real `<button>`s in an HTML overlay, or `tabIndex={0} role="button"` + Enter/Space |
| Hardcoded Tailwind palette colors break non-`evening` themes (`index.css:4` defines `dark` as `[data-theme="evening"]` only) | Worst: `TechniqueCard.tsx` (20×), `LogicalFallacyDojo.tsx` (19×), `SourceCredibilityLab.tsx` (16×), `ConspiracyAnatomyPanel.tsx` (16×), `ManipulationLabPanel.tsx:337` | Route through existing semantic tokens (`--color-observation`, `--color-outrage`, `--color-curiosity`, `--color-paper-dark`) |
| Every `res.json()` is an implicit `any` flowing into typed state | `HomeRoute.tsx:231,267`; `useCategories.ts:19`; `useWidgets.ts:23-30`; `NewsSpectrum.tsx:94,123`; `DisinfoMap.tsx:100`; `ManipulationLabPanel.tsx:73,107,175`; `BridgePanel.tsx:71,111,137,149` | One `fetchJson<T>(url, init)` with a minimal shape guard |
| Duplicated type definitions — `BiasDistribution` vs `BiasSpectrum` are structurally identical; 9 mindgames types re-declared locally despite existing in `types/index.ts:388-497` | `types/index.ts:328-336` vs `:457-465`; `DisinfoMap.tsx:11-61`; `NewsSpectrum.tsx:24-58` | Collapse and import |
| `escapeHtml()` on React text children double-escapes — `&` renders as `&amp;` | `NarrativeMapPanel.tsx:515`, `DisinfoMap.tsx:276,279` | Remove the calls |
| Uncleared `setTimeout(onClose, 800)` | `ExploreFeedsPage.tsx:407,429`, `NarrativeMapPanel.tsx:134` | Store and clear in cleanup |
| `{managingId && …}` treats category id `0` as absent | `AppLayout.tsx:94` | `managingId != null` |
| `selectedLlm` not persisted while `articleFontSize` is | `AppLayout.tsx:23-24` | Persist both |
| Non-null assertions where an early-return guard exists at `:408` | `PatternTests.tsx:399,401` | Use the guard pattern |
| Empty `interface Props` + unused `_props` (two lint errors) | `ScientistPanel.tsx:16,54` | Delete both |
| POST with no AbortController — closing the quiz mid-request leaves a pending `setResult` | `ChallengeQuiz.tsx:53` | Add controller |

### Backend

| Issue | Location | Fix |
|---|---|---|
| Unbounded / `NaN` pagination — `?limit=999999999` dumps the table (each row carries a full `description`), `?page=abc` binds a non-integer | `routes/jobs.js:34,42` | `Math.min(200, Math.max(1, parseInt(limit,10) \|\| 50))`, same for `page` — mirroring `routes/widgets.js:137-138` |
| No concurrency guard on long-running POSTs — two Refresh clicks run two full feed+LLM cycles, both writing `summaries`/`summary_history`. The debounce AGENTS.md documents does not exist (no `setInterval`/cron anywhere) | `routes/summaries.js:91`, `routes/jobs.js:72`, `routes/briefing.js:10`, `routes/telegram.js:70` | Module-level in-flight `Map<key, Promise>` keyed `refresh:${categoryId}` etc.; return the existing promise or 409 |
| LLM-hallucinated job IDs written unchecked; `ai_filtered_jobs` has no FK, so orphans persist and inflate `counts.aiFiltered` while `aiOnly=true` silently drops them | `jobs/ai-filter.js:65-69`, `routes/jobs.js:131`, `db.js:100-104` | `const ids = new Set(batch.map(j => j.id))` filter + `FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE` |
| `req.body` destructured without a default → 500 on any non-JSON POST (body-parser 2 leaves it `undefined`) | `discovery.js:7`, `chat.js:9`, `telegram.js:12`, `spectrum.js:512`, `prompts-manager.js:27`, `bias-radar/decode.js:10`, `jobs.js:116` | `req.body \|\| {}` — the pattern `summaries.js:93` already uses |
| Unbounded client text into prompts; `max_tokens` defaults to 8192 | `chat.js:9,27`; `surprise.js:216,238,284,302` | Cap at ~8000 chars with a 400 (as `bias-radar/decode.js:17` already does), plus a daily token ceiling read from `llm_usage` before dispatch |
| `renderPrompt` uses *string* `replaceAll`, so `$&`, `` $` ``, `$'`, `$1` in article text or a chat message get substituted, silently corrupting prompts | `lib/promptManager.js:39` | Function form: `replaceAll(\`{{${key}}}\`, () => value ?? '')` |
| Missing indexes on the hottest lookups | `db.js:245-270` | `articles(link)` — scanned per candidate in `surprise.js:97,136`, the real N+1; `chat_messages(summary_id, article_title)` — every query in `chat.js:18,60` and `surprise.js:274,291`; `llm_usage(purpose)`, `llm_usage(provider)` |
| `/api/stats/llm` loads the whole table into JS — five `reduce` passes and three grouping loops for what `GROUP BY` does. `llm_usage` has no retention policy | `routes/stats.js:11-39` | Three `GROUP BY` queries + startup `DELETE … WHERE created_at < datetime('now','-90 days')` |
| Two racing retention policies, one mutating the DB inside a GET, comparing different columns (`generated_at` vs `date_key`). Both purge `chat_messages` by `summary_id IN (…)`, but the Break feature writes with sentinel `summary_id = 0` — never purged, unbounded growth | `surprise.js:172-182,300,324` vs `jobs/refreshSummary.js:198-203` | One `lib/retention.js` from a single caller, keyed on `generated_at`, also deleting `chat_messages WHERE summary_id = 0 AND created_at < cutoff` |
| `llm_usage.model` records the wrong model when the OpenRouter free-model auto-switch fires — logs `provider.model`, request used `resolvedModel` (the response string at `:175` is correct, so stats and response disagree) | `lib/llm.js:159-162,86-94` | Pass `resolvedModel` to the insert |
| Unvalidated params interpolated into upstream URLs — `lat`/`lon` allow `&`-separated param injection into open-meteo; `req.params.id` goes into a TMDB **path**, so an encoded traversal reaches other TMDB endpoints with your key attached. No `resp.ok` check in five handlers, so upstream failures surface as `TypeError` | `routes/widgets.js:12-16,243,18,63` | `parseFloat` + range check; `/^\d+$/.test(id)`; check `resp.ok` |
| Upstream provider error bodies relayed to anonymous callers — leaks provider identity, model routing, org/quota metadata | `lib/llm.js:149-151` → `chat.js:52`, `forensics.js:47` | Log server-side, return a generic message |
| Hardcoded UTC+3 — wrong from late October to late March, and the day-grouping key at `:59,75` splits one local day into two buckets. Duplicated in two functions | `routes/logs.js:15,28` | `toLocaleString('sv-SE', { timeZone: 'Europe/Bucharest' })` |
| `custom_css` is writable and has no reader anywhere — becomes a CSS-injection sink the day one is added | `routes/settings.js:14` | Drop from `ALLOWED_KEYS` until there's a sanitized consumer |
| No security headers / CSP | `server/index.js`, `vercel.json` | `helmet()` on the API, CSP header for the SPA |
| Four independent LLM-JSON-repair implementations — the shared one is the weakest and the one that gets ignored | `lib/parseJSON.js:8`, `refreshSummary.js:30-49`, `ai-filter.js:41-63`, `bias-radar/decode.js:37` | Consolidate on the strongest |
| Two `fetchWithTimeout` (the `jobs/common.js` one is better — signal chaining, UA header); two identical trending-tags endpoints | `lib/fetchWithTimeout.js:1` vs `jobs/common.js:3`; `routes/stats.js:64` vs `routes/tags.js:5` | Keep one of each |
| `matchOutlet` does four sequential O(n) passes over the ratings table per article, no memoization | `lib/outletMatcher.js:477-517` | `Map` cache keyed on normalized source name |

---

## Structural

1. **`server/db.js` is 1432 lines, ~1200 of them prompt literals.** Lines 1–270 are schema + indexes; ~275–1432 is prompt seeding, plus a `DELETE FROM prompts WHERE slug IN (...)` at `:1430`. Move prompts to `server/prompts/*.md` (or one `.js` per domain) loaded by a single seeding loop; `db.js` drops to ~60 lines. **Highest-leverage change in the repo** — prompts are content currently versioned as code inside the DB bootstrap, and editing one means touching the file every route depends on. It also fixes must-fix #1 by construction.

2. **Replace idempotent-DDL-on-boot with a versioned migration runner.** Currently 24 `CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE` in try/catch swallowing "duplicate column" (`db.js:231`). This cannot express renames, type changes, backfills, or a down path, and it silently diverges — a DB created today and one created six months ago match only by luck, with no way to assert it. Note the data migration at `~:303` (`UPDATE feeds SET url = …` for dead Reuters URLs) re-runs on **every** startup. Fix: `server/migrations/001_init.sql`, `002_….sql`, a 30-line runner using `PRAGMA user_version` inside a transaction. Ship `001` as the current full schema and stamp `user_version` on existing DBs. Prompt seeding then becomes a migration, not a startup side effect.

3. **Give each domain a repository; stop importing the raw `db` handle into 40+ routes.** Every route does `require('../db')` and inlines SQL — `routes/summaries.js:20-80` has the same 10-field row→DTO mapper **three times in one handler**. Add `server/repos/{categories,summaries,articles,prompts,gamification,jobs,llmUsage}.js` holding prepared statements and one mapper each. `lib/promptManager.js` is already exactly this pattern and proves it works. Payoff: statements prepared once instead of per-request, response shape in one place, and repos are the unit you can test without HTTP.

4. **Copy-pasted reference data.** `server/lib/bias-radar/biasRatings.js` (281 lines) and `client/src/utils/biasRatings.ts` (187 lines) are **the same AllSides table**, differing only in export syntax and added TS types. `lib/outletMatcher.js` embeds a 500-line `OUTLET_RATINGS` array the client also renders. Given CommonJS server + ESM client: put the ratings in `shared/` as JSON + a `.d.ts`, `require`d by the server and imported by the client via a Vite alias. For request/response types, Zod schemas in `shared/` used for server validation *and* `z.infer` on the client would replace both the 62 hand-written `res.status(400)` checks and the 496-line hand-mirrored `client/src/types/index.ts`, which currently matches the server only by convention.

5. **31 components bypass the 11 well-built `useApi` hooks** with raw `fetch`, each reinventing loading/error state. `useSummary.ts` is the right shape (abort control, JSON-parse guards, `data.error` extraction, stale-archive fallback) — extract it into `client/src/lib/apiClient.ts` (base URL, abort, `{error}` unwrapping, typed generic) plus generic `useApiQuery<T>`/`useApiMutation<T>`, and convert the mindgames panels (the bulk of the 31, all the same POST-prompt-then-render shape). This is where TanStack Query earns its keep — these are all cacheable reads.

6. **Route mounting is incoherent.** Handler-level naming is good (kebab-case, `{ error }` in 139/139 error responses). The problem is `index.js`: three routers share `/api/categories` (`categories.js`, `feeds.js`, `summaries.js`), so `GET /:id` in one file and `GET /:id/summary` in another are order-dependent; `narrative.js` and `disinfo.js` both mount at `/api/cognitive`; `cognitive.js` mounts at **`/api/progress`**; `surprise.js` at `/api/homepage/surprise`. Rename files to match mount points, one router per prefix, and replace the 52 hand-written `app.use` lines with a directory-walking loader deriving the prefix from the path (`routes/bias-radar/decode.js` → `/api/bias-radar/decode`). Then a new endpoint is a file, not a file plus a manifest edit.

7. **Fix the `features/` vs `components/` boundary — it's inverted at the routing layer.** `features/mindgames/{overview,training,analysis,reflection,reference,quiz,bias-radar,dashboard,common}/` is coherent. But the mindgames route wrappers live *outside* the feature in `components/routes/`, split across `MindGamesRoute.tsx` and `MindGamesRoutes.tsx` (a `TAB_COMPONENTS` map wrapped by a `createMindGamesRoute` factory that throws on unknown keys — a runtime check the type system should own). Move both to `features/mindgames/routes.tsx` and drop the factory. Meanwhile `components/` mixes `ui/` primitives (correct), small co-located components with barrels (`SourceBadge/`, `BiasBar/` — correct), and 500–700-line page components (`ExploreFeedsPage`, `MorningBriefing`, `ReleasesPage`, `HomeRoute`, `FeedManager`, `NavigationBar`) — those are features; promote them to `features/{feeds,briefing,releases,home}/` and leave `components/` as shared UI only.

8. **Bundle: mindgames tabs aren't lazy.** `PatternTests.tsx` (854 lines) plus `DisinfoMap` / `NarrativeMapPanel` / `InoculationPanel` (~600 each) all ship in the initial bundle for users who never open MindGames. `lazy()` the six tabs.

9. **`SummaryView.tsx` is 691 lines with six unrelated concerns** (`:161-689`): header/toolbar, lens result renderer, mobile action drawer, section list, radar wiring, scroll-to-top — and the keyword-filter block is duplicated verbatim for mobile (`:221-249`) and desktop (`:264-292`). Extract `SummaryHeader`, `LensResult`, `SummarySectionCard`, `KeywordFilter`, `useScrollTop()`.

10. **~556 lines of dead files**, zero importers each: `components/WidgetSidebar.tsx` (205), `components/ChatPanel.tsx` (123), `hooks/useSwipeGesture.ts` (122), `components/MoodPicker.tsx` (41), `components/ReadingTimeFilter.tsx` (35), `components/SentimentBadge.tsx` (30). Plus dead exports `defaultModel` (`hooks/useModels.ts:44`) and `StressDiagnosticTrigger` (`features/mindgames/reflection/index.ts:8`), a stray `components/_snippets/SummaryView-fade-image-layout.tsx.bak`, and `PatternTests.tsx:286-340,354-356` constructing `AbortController`s in a file that makes no network calls. *(Confirm before deleting.)*

11. **Tests — Vitest, five targets.** AGENTS.md says none is configured; the client already has Vite 8 and the CommonJS server runs fine as a second workspace project (`environment: 'node'`). Add `supertest` for routes.
    1. `server/lib/llm.js` `callLLM` — the provider fallback chain, the five string heuristics routing `providerId` (`gemini-`/`gemma-` → Google, `openai/` → Groq, contains `/` → OpenRouter, else Groq), non-OK/empty-content retry, the `llm_usage` insert. Mock `fetch`. Most consequential and least verifiable function in the codebase.
    2. `server/jobs/refreshSummary.js` — the summary pipeline, `RefreshError.statusCode` mapping, `enrichSentimentData`. The core write path.
    3. `client/src/components/SummaryView/utils/parseSummaryMarkdown.ts` and `parseRateLimitError.ts` — pure functions over untrusted LLM output; cheapest tests, most likely to catch a real regression when a model changes formatting.
    4. The migration runner (once #2 exists) — apply all migrations to `:memory:`, snapshot the schema, assert it matches a fresh install. This is what makes the schema trustworthy.
    5. `routes/summaries.js` + `feeds.js` via supertest against in-memory SQLite — covers `validateId`, 404/400 paths, feed URL validation, and locks the DTO shape (pair with #4 so client types derive from it).

12. **Observability.** Cost tracking is better than expected — `llm_usage` records provider/model/tokens/purpose/latency, `GET /api/stats/llm` aggregates by provider/purpose/day, `providerQuotas` scrapes `x-ratelimit-*`. Two gaps: **tokens are tracked but never priced** (add a per-model cost table so stats report currency), and `providerQuotas` is in-memory so quota state dies on restart. Logging is 186 `console.log` + 83 `console.error` with ad-hoc `[LLM]`-style prefixes — no levels, no request correlation. No error tracking at all, which matters more than usual because must-fix #2 fails silently. Add `pino-http` + Sentry.

13. **Docs drift.** `AGENTS.md` / `README.md` describe Vercel + Railway and reference a `server/nixpacks.toml` that doesn't exist; the real deploy is SSH-to-CasaOS Docker via `.github/workflows/deploy-*.yml`. They also document a job-fetch 30-min debounce and a scheduler that no longer exist. Nothing anywhere records that the API is *intentionally* unauthenticated — the assumption every route silently depends on.

14. **Repo hygiene.** `news-digest-rust.vercel.app-20260401T165452.json` (758 KB Lighthouse report) is tracked — `git rm --cached` and add `lighthouse*` / `*.report.json` to `.gitignore`. Content is a perf report, not a secret leak.

### Clean bill

- **No SQL injection.** The template-literal queries at `routes/jobs.js:16,36,46-53` and `db.js:233` interpolate only module-level constants; all user values are bound (`@source`, `@search`, `?`). `middleware/validateId.js` coerces to positive integers. Worth documenting the invariant so the `${recentFilter}` pattern isn't later fed a request value.
- **No hardcoded secrets.** All 294 tracked files scanned for `sk-`/`gsk_`/`xoxb-`/`ghp_`/`AKIA`/PEM blocks and `key|token|secret|password` literal assignments: zero hits. `.env`, `newsreader.backup.db` and its `-shm`/`-wal` are correctly untracked. Secrets read exclusively via `process.env`.
- **No path traversal.** Only filesystem read is the fixed `path.join(__dirname,'..','data','feeds-catalog.json')` at `routes/explore-feeds.js:8`. No `sendFile`/`createReadStream`/user-influenced paths.
- **No `dangerouslySetInnerHTML`** anywhere; external links use `rel="noopener noreferrer"`.
- **Dependency versions current** — express 5.2.1, better-sqlite3 12.8, react 19.2, vite 8.0.1.

---

# Part 2 — Feature roadmap

## Bugs found during ideation

> **6 of 7 fixed.** Only #1 (mount `telegram.js`) is deliberately left — see
> [Not addressed](#not-addressed). #5 (`topic_id`) is left in place for Story Threads.

1. **`server/routes/telegram.js` is fully implemented and never mounted** in `server/index.js` — MarkdownV2 escaping, 4096-char chunking, `/send`, `/digest`, zero client references. One line to ship it.

2. **Section metadata silently vanishes.** `jobs/refreshSummary.js` matches LLM output back to the source article by exact URL *or* exact lowercased title:
   ```js
   const original = allArticles.find(orig =>
     orig.link === a.url || orig.title.toLowerCase() === (a.title || '').toLowerCase()
   );
   ```
   But the `category-summary` prompt asks the model to **rewrite** titles (and translate them when `language` isn't English). Every rewritten title that also loses its URL falls through to `original = undefined`, zeroing `source`, `pub_date` and `image` — and since `enrichSentimentData` keys off `entry.source`, `matchOutlet` never runs. **This is almost certainly the cause of intermittently missing bias bars, credibility badges and article images.** Fix: pass an explicit `[n]` index into the prompt and require the model to echo `source_index`; fall back to normalized-URL match, then fuzzy title similarity; log a counter when a section can't be attributed instead of failing silently.

3. **The briefing reads one feed per category.** `routes/briefing.js` selects with `SELECT * FROM feeds WHERE category_id = ? ORDER BY id ASC LIMIT 1` — every category contributes only its **oldest-added** feed; the rest are silently ignored. It then re-fetches RSS and makes a second full LLM pass over content summarized minutes earlier, storing the result with `sentiment_data`/`tags_data` NULL — so briefings have no bias bars, no credibility badges, no tags, and are invisible to `tags/trending`.

4. **`bias-radar/decode` has no cache** — the same article re-runs the LLM on every open. And `ChallengeQuiz.tsx`, the in-reading-flow quiz and highest-frequency exercise, calls `bias-radar/decode` + `gamification/complete-challenge` and records **the user's guess nowhere** — the richest available signal about detection skill is discarded.

5. **`articles.topic_id` is computed on every refresh and indexed twice, and never read.**

6. **`explore-feeds` `subscribed` flag uses exact URL equality** (`subscribed.has(f.url)`) — a catalog feed added earlier via discovery, or an `http`-vs-`https` / `?format=xml` variant, shows as unsubscribed, and re-adding creates a duplicate.

7. **`bias-radar/missing-story` is registered but gated behind `INTERNAL_API_SECRET` with no UI** — dead capability.

8. **No scheduler anywhere** — auto-refresh was removed in `f60f4bd`; everything is manual. Also unused: `fts5` (no full-text search), no TTS, no reading telemetry, no article bookmarks (only `saved_jobs`), no paywall handling, no OPML.

## New features

### 1. Story Threads — cross-source clustering and de-duplication · **M**
Group today's articles describing the same event into one thread; render the digest as "one story, N outlets" instead of N near-identical sections. Thread cards show the outlet strip (reusing `BiasBar` / `CredibilityBadge`) sorted left→right, with one LLM summary per thread rather than per article.

*Why it fits:* the app's whole argument is that framing is visible only in comparison — today that comparison is a manual per-article Bias Radar click. Threads make it the default reading unit.

*Sketch:* `deriveTopicId()` already stores a keyword fingerprint in `articles.topic_id` and `lib/bias-radar/topicCluster.js` already has `keywordOverlap()` + `BIAS_ORDER` — the primitives exist and are unused. New `server/lib/cluster.js` (agglomerative on `topic_id` overlap ≥3 keywords within 36 h, no embeddings); call it in `refreshSummary.js` before building `articleText`; tables `story_threads(id, date_key, label, keywords)` + `story_thread_members(thread_id, article_id, bias)`; `GET /api/threads?date=`; render in `SummaryView` and `HomeRoute`.

*Value:* kills duplicate-headline fatigue and cuts tokens spent on redundant inputs.

### 2. Follow This Story — durable arcs across days · **M**
A "Follow" button on any article or thread creates a persistent watch. Each refresh appends matching new articles and one cheap LLM call produces a "what changed since your last read" delta.

*Why it fits:* counter-programs the amnesia of a daily digest and makes narrative drift — currently visualized only abstractly in Narrative Map — observable on the user's own stories. Category `summary_history` is purged after 3 days, so nothing survives long enough to show an evolving event today.

*Sketch:* `followed_stories(id, label, keywords, created_at, last_seen_at)`, `story_updates(story_id, date_key, article_json, delta_summary)`; `server/routes/stories.js`; hook into `refreshCategorySummary` after article insert; `/stories` route + `LeftSidebar` section; prompt slug `story-delta`.

*Value:* the only feature that gives the app memory.

### 3. Blindspot Board — surface the gaps you already compute · **S–M**
Expose the orphaned `missing-story` endpoint as a real page backed by an actual lopsidedness metric: for each thread, compute the bias distribution of covering outlets from `outletMatcher` and list threads covered ≥80% by one side, plus stories present in `newsSearch` results that no subscribed feed carried.

*Why it fits:* the Ground News differentiator, and the natural completion of Compare Coverage + News Spectrum — which currently only work on an article you already chose.

*Sketch:* drop the `INTERNAL_API_SECRET` gate or add `GET /api/blindspots`; reuse `lib/bias-radar/newsSearch.js` + `matchOutlet`; `features/mindgames/analysis/BlindspotBoard.tsx` in the Analysis tab.

*Value:* high, and it rescues dead code.

### 4. Read Ledger — behavioral bias dashboard · **M**
Log what the user actually opens (link, source, bias, credibility, dwell seconds, entry point: home / category / radar). Then replace the self-reported and LLM-guessed inputs of `InformationDiet` and `bias-mirror` with measured data: your real left/center/right split, top 5 outlets, average credibility of what you clicked vs. what you were served.

*Why it fits:* every MindGames reflection module currently *asks* you to describe your diet. This measures it — the strongest possible version of "self-awareness" for this app.

*Sketch:* `article_events(id, link, source, bias, credibility, category_id, event_type, dwell_ms, created_at)`; batched `POST /api/events` via `navigator.sendBeacon`; instrument the existing link handlers in `HomeRoute.tsx`, `SummaryView.tsx`, `SourceCard.tsx`; `features/mindgames/reflection/ReadLedger.tsx`; feed `InformationDiet` from it.

*Value:* high; also unlocks #5 and #10.

### 5. Archive Search (FTS5) · **S–M**
There is currently no way to find anything you read. FTS5 virtual table over `articles(title, body_text)` and `summary_history(summary)`, with a ⌘K command palette filterable by category, source, bias tier and date.

*Why it fits:* an archive you can't query isn't an archive; the "newspaper of record" identity demands a morgue file.

*Sketch:* `CREATE VIRTUAL TABLE articles_fts USING fts5(...)` + triggers in `db.js`; `routes/search.js` (`GET /api/search?q=`); **split retention** — purge `body_text` at 3 days, keep a slim `article_index` row indefinitely; `SearchPalette.tsx` in `AppLayout`.

*Value:* high, permanently.

### 6. Digest Radio — zero-cost audio briefing · **S**
Play button per section and a "Play all" queue over the parsed digest, driven by the browser `speechSynthesis` API — no vendor, no cost, no new env var. Queue continues across sections and categories, shows position, remembers where you stopped, and can be assembled as a playlist from the morning briefing plus selected categories.

*Why it fits:* `parseSummaryMarkdown` already yields ordered `{title, content}` sections — short, clean prose in a known structure is the ideal TTS payload, and audio is the one consumption mode with zero support today.

*Sketch:* pure client — `hooks/useSpeechQueue.ts`, `components/AudioPlayerBar.tsx`, buttons in `SummaryView.tsx` and `MorningBriefing.tsx`; persist voice/rate via `PUT /api/settings/:key`.

*Value:* highest per unit of effort on this list.

### 7. Watchlist → Telegram push · **S**
User-defined watch terms (`"EU AI Act"`, `"Cluj"`, an outlet, a tag). Each refresh queues matched sections; a "Send watch digest" action pushes them to Telegram.

*Why it fits:* the app already supports one-off keyword-focused refreshes — a watchlist is that made persistent and push-based, and it gives the digest a reason to reach you instead of vice versa. Also fixes the unmounted-router bug.

*Sketch:* register the router in `server/index.js`; `watch_terms(id, term, scope, notify)`, `watch_hits(term_id, article_link, date_key, sent_at)`; match inside `refreshCategorySummary`; sidebar panel + badge; extend the message template with the bias/credibility line.

*Value:* medium-high; converts a dead module into a shipped feature.

### 8. Scheduled digest runs with a run log · **S–M**
Auto-refresh was removed wholesale; the middle ground is a scheduler you can see and trust — per-category cron expressions, sequential execution with a token budget cap, and a run history (started, provider, articles in, sections out, parse-repair used, error) surfaced in the existing `/logs` page.

*Why it fits:* a self-hosted newspaper should be waiting for you in the morning. The reason auto-refresh was removed was almost certainly opacity and cost — both of which a budgeted, logged scheduler addresses directly.

*Sketch:* `server/jobs/scheduler.js` (`node-cron`, guarded by `ENABLE_SCHEDULER`), reusing `refreshCategorySummary` verbatim; `refresh_runs` table; `categories.cron` column; extend `routes/logs.js` + `LogsRoute.tsx`. Alternative: a GitHub Action hitting an authenticated `/api/cron/run`.

*Value:* high — turns a manual tool into a product.

### 9. Reader Extract — read the source without leaving · **M**
Every "Read full article" link ejects the user to a tab with cookie walls and ads, right after the app spent effort establishing whether the source is trustworthy. Add server-side Readability extraction cached on the article row, rendered in the existing Sheet with the source badges, credibility, bias bar and the Radar / Chat / Decode actions attached to the **full text**.

*Why it fits:* closes the loop between "here's how trustworthy this outlet is" and actually reading the piece — and materially improves Decode and Forensics, which currently analyze a 3000-char snippet.

*Sketch:* add `@mozilla/readability` + `linkedom` to `server/package.json`; `GET /api/articles/:id/extract` with an `articles.extracted_html` cache column; tag known paywall domains from `server/data/paywalls.json` and show a "paywalled" pill; render in the `SummaryView` sheet.

*Value:* high; direct quality lift to every downstream analysis feature.

### 10. Prediction Ledger with calibration scoring · **S–M**
Log a falsifiable prediction attached to a story ("this bill passes by Sept 30") with a confidence percentage and resolve date. On that date the app resurfaces it, asks for the outcome, and maintains a Brier score plus a calibration curve (confidence bucket vs. actual hit rate) in Recharts.

*Why it fits:* the sharpest extension of the Scientist's Sandbox. `rethinking_journal` already tracks initial vs. final confidence on *opinions*; this tracks confidence against *reality* — the only real test of the whole MindGames premise.

*Sketch:* `predictions(id, story_label, article_link, claim, confidence, resolve_date, outcome, resolved_at)`; `routes/predictions.js`; `features/mindgames/reflection/PredictionLedger.tsx` + a due-today nudge in `OverviewTab`; optional LLM pass to sharpen a vague claim into a falsifiable one (prompt slug `sharpen-prediction`).

*Value:* high for the target user; genuinely differentiating.

## Upgrades to existing features

### A. MindGames — the app collects mastery data and throws it away
**Weakness:** `fallacy_dojo_logs` stores `fallacy_type`, `difficulty_tier`, `success` and `time_to_identify` per attempt, and `routes/gamification.js` only ever aggregates it into a flat accuracy percentage. Generation ignores it entirely: `fallacy-dojo/generate` and `inoculation/generate` produce items independent of what you keep missing, and difficulty comes from `req.body.difficulty || 'beginner'` — the **client** decides, not your performance.

**Upgrade:** `server/lib/mastery.js` computing per-technique / per-fallacy mastery (accuracy weighted by recency, latency as tiebreak) returning a weakness-weighted sampling distribution plus a proposed tier. Feed it into the `generate` routes so ~60% of items target your three weakest types; promote/demote tiers automatically; add SM-2-style spaced re-tests of previously failed types. Surface a 12 techniques × 14 fallacies mastery heatmap in `OverviewTab` so progress is legible.

### B. MindGames — six diverging scoreboards, and Decode re-pays for the same article
**Weakness:** `cognitive_users.antibody_count`, `user_gamification.total_antibodies`, `fallacy_dojo_logs`, `bias_fingerprints`, `inoculation_sessions` and `forensic_history` are six independent progress stores that can and do disagree. `ChallengeQuiz.tsx` — the highest-frequency exercise — records the user's guess **nowhere**. And `decode` has no cache, so every open of the same article re-runs the LLM.

**Upgrade:** one `skill_events(id, module, item_type, item_ref, user_answer, correct_answer, correct, latency_ms, created_at)` table written by *all* modules (dojo, inoculation, challenge quiz, technique picker, daily quiz), with existing tables kept for module-specific payloads. Derive streak / antibodies / mastery from it so the numbers can't diverge. Separately cache decode in `article_decodes(link_hash, result_json, created_at)` — the same content always yields the same analysis, and the quiz becomes free after the first play.

### C. Summarization pipeline — blind input selection, and the attribution bug
**Weakness (1):** input selection is `slice(0, 10)` per feed then `sort(pubDate).slice(0, 30)` — no de-duplication and no relevance step, so five outlets covering one wire story consume five of your thirty slots and the digest repeats itself. A high-volume feed also crowds out quieter ones.

**Weakness (2):** the exact-URL-or-exact-title match documented in [ideation bug #2](#bugs-found-during-ideation) above.

**Upgrade:** insert a pre-LLM stage — near-duplicate collapse via `topicCluster.keywordOverlap` (or trigram Jaccard on titles), a per-feed quota so no single source exceeds ~25% of the batch, and an optional cheap triage call scoring articles 0–10 for newsworthiness before the expensive summarization. Make matching robust as described in bug #2.

### D. Digest & briefing — one feed per category, paid for twice
**Weakness:** as in [ideation bug #3](#bugs-found-during-ideation) — oldest-added feed only, a redundant second LLM pass, and NULL `sentiment_data`/`tags_data`.

**Upgrade:** build the briefing from the freshest `summary_history` row per category, falling back to a live fetch only for stale categories, passing the already-parsed sections in. That's map-reduce instead of a second map: cheaper, faster, consistent with what the user just read. Persist `sentiment_data` with source attribution so briefing sections carry the same badges as category views. Add a hard cap (`briefing_max_stories` setting → "top 7 across all categories") and a reading-time estimate in the header.

### E. Summarization reliability — all-or-nothing JSON with a homemade repair pass
**Weakness:** one LLM call must emit a well-formed JSON array covering up to 30 articles. On truncation, `repairAndParseJSON` tries three heuristics then throws `'LLM returned invalid response format. Please try again.'` — the entire refresh is lost, the tokens are billed, and the only recourse is a retry with the same odds. Longer categories are structurally the most likely to fail.

**Upgrade:** three cheap layers.
1. Request `response_format: { type: 'json_schema' }` in `lib/llm.js` for providers that support it — Groq does — removing most malformation at the source.
2. Chunk the batch (~10 articles per call, `Promise.all`, concatenate sections) so one bad chunk costs a third of the digest instead of all of it, and per-call output stays well inside the token ceiling that causes truncation today.
3. On unrecoverable parse failure, **salvage**: extract whatever complete `{...}` objects the response does contain, emit those sections, and report `partial: true` rather than discarding everything.

### F. Feed discovery — no validation, no health tracking, and a `subscribed` flag that lies
**Weakness:** four distinct gaps.
- `routes/discovery.js` returns URLs it has often never parsed (the `<link>` regex path never validates), so you can subscribe to a 404 or an empty feed and only find out at the next refresh.
- `explore-feeds.js` computes `subscribed` with exact string equality — see [ideation bug #6](#bugs-found-during-ideation).
- Broken feeds fail invisibly forever: `refreshSummary.js` catches per-feed errors with `console.warn` and returns `[]`. Nothing in the UI ever says a source has been dead for a week, silently shrinking your digest.
- The catalog is a static 68 feeds across 12 topics, with no search, no language facet, and no use of the trust dataset you already own.

**Upgrade:** make discovery return a **validated preview** — parse each candidate and return title, item count, latest `pubDate`, detected language, plus `matchOutlet(site)` bias/credibility/ownership so you can judge a source *before* subscribing — with one-click add-to-category. Normalize URLs (strip scheme / `www` / trailing slash / tracking params) into a `feeds.url_key` column used for both insert-dedupe and the `subscribed` flag. Add `feed_health(feed_id, last_ok_at, last_error, consecutive_failures, avg_items)` written by `refreshCategorySummary`, with a red dot in `FeedManager` and an auto-pause suggestion after N failures. Then add the recommendation this app is uniquely positioned to make: compute the bias distribution of a category's feeds and suggest catalog feeds that fill the gap ("your Politics category is 80% lean-left; consider these three center/right sources"). Plus OPML import/export so the catalog isn't the ceiling.

---

# Suggested order of work

**~~Wave 1 — correctness and exposure~~ (done).** Must-fix #1–#10, plus the cheap
"should fix" items listed under [What was fixed](#what-was-fixed).

**Before the next deploy:** set `API_TOKEN` + `ALLOWED_ORIGINS` on the server and
`VITE_API_TOKEN` on the client. Auth is opt-in so local development is unchanged,
which also means it does nothing until those are set. Also confirm the backend
container is reachable as `newsreader-api:3001` from the frontend container, or
change the `set $api_upstream` line in `client/nginx.conf`.

**~~Wave 2 — cheap wins~~ (done).** Ideation bugs #2–#7, the full Should-fix
list, and lint from 14 errors down to 9.

**Wave 3 — the two enabling refactors.** Prompts out of `db.js` (~1200 of its
1432 lines) and a `PRAGMA user_version` migration runner. Both still open, and
both get easier now that retention, attribution, feed health and prompt seeding
have been pulled into their own modules. Worth pairing with the first Vitest
suite — the throwaway attribution and parseJSON tests from round 2 are the
obvious seed.

**Wave 4 — features.** Highest leverage: **Story Threads** (unlocks Blindspot Board and Follow This Story, and uses clustering code already written), **Digest Radio** (S effort, entirely new consumption mode), **Archive Search** (permanent value), then upgrade **E** (stops losing whole digests) and **A/B** (makes MindGames actually adaptive).
