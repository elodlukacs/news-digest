# Feature review — 2026-10

Follow-up to `code-review-2026-08.md`. Prompted by the flydubai incident: the
category summary read only each feed's first 10 items and filtered *after*
capping to 30, so a major breaking story never appeared and a keyword search
found 2 articles (fixed in #27 + `claude/affectionate-euler-cd00oz`).

This review hunts for the same class of bug across the whole app — things that
silently break real usage or don't make sense to a user. Four parallel reviews
(news pipeline, core client, MindGames/bias-radar, jobs/widgets/LLM/deploy);
findings reported by more than one are merged. Items marked ✔ were re-verified
by hand against the code; the rest were verified by the reviewing agent (code
reading, and for some, running the route against a scratch DB).

Severity: **P0** breaks a main flow or loses data · **P1** wrong/empty output
the user can't diagnose · **P2** wrong but noticeable / limited scope · **P3** polish.

---

## P0 — fix first

### 1. A filtered summary replaces the category's real digest ✔
`jobs/refreshSummary.js:235-249`, `routes/summaries.js:57-71`, `useSummary.ts:92-110`, `CategoryRoute.tsx:67`, `routes/briefing.js:28-45`

Filter "flydubai", press ✕ → the flydubai-only digest stays. Reload → it is shown
as the normal digest. The archive lists it as a normal entry, the Morning
Briefing reuses it for 6 h as that category's section, and trending tags /
"Break" draw from it. `summary_history` has no keyword column; "latest" is just
the newest row, and Clear filter only re-reads it.

**Fix:** add `summary_history.keyword`; don't upsert `summaries` for keyword runs;
exclude keyword rows from latest/briefing/surprise/tags; badge them in the archive.

### 2. Changing category (or clearing the filter) during a refresh locks the page ✔
`useSummary.ts:16-20, 57-59, 87-88`; `SummaryView.tsx:247-255, 279-287`

Load, refresh and loadLatest share one `abortRef`. The aborted refresh's
`finally` skips `setRefreshing(false)` because its own signal is aborted, so
Refresh / Filter / Lens / Generate stay disabled ("Refreshing…") until reload.
Same on Home: "I want to know more" and chat stick after "Next story"
(`HomeRoute.tsx:144-146, 266`) ✔.

**Fix:** whoever aborts resets the flags (or use a request-id guard instead of
`signal.aborted`); disable ✕ while busy.

### 3. Per-category state leaks into the next category
`CategoryRoute.tsx:14-33`, `SummaryView.tsx:91-121`, `useSummary.ts:16-42`, `useLens.ts:40-44`

The route component isn't remounted on `:categoryName` change:
- a selected archive snapshot is sent as `summary_id` for the *new* category →
  "No summary for this section yet" + a paid **Generate summary** button;
- the filter keyword/chip, open quiz, chat article carry over;
- the old category's cards stay under the new title until (and if the load
  fails, after) the new response;
- a running lens from category A is rendered under category B.

**Fix:** `key={categoryId}` on the route content / `SummaryView`; reset
`selectedSnapshotId`, `setSummary(null)` on change; `lens.clear()` aborts.

### 4. Choosing a model disables the provider fallback chain ✔
`lib/llm.js:185-191`, `AppLayout.tsx:25-27, 99`

Every UI request sends `provider: selectedLlm` (default `openai/gpt-oss-120b`),
and `callLLM` then narrows to that one provider. One Groq 429/outage fails
summaries, triage, chat, briefing and MindGames even with DeepSeek / Google /
OpenRouter keys configured. A stale stored model (e.g. a retired Llama) fails
every call. Additionally the picker never persists: `onLlmChange={setSelectedLlm}`
bypasses `handleLlmChange` ✔.

**Fix:** treat `providerId` as *preferred first*, then the rest of the chain (or
add "Auto" as default); validate the stored model against `/api/models`; pass
`handleLlmChange`.

### 5. Refresh/filter errors are replaced by a generic message
`useSummary.ts:73-86`, `parseRateLimitError.ts:9-11`

With any archived summary, every refresh failure becomes "Refresh failed —
showing latest from archive" over the *unfiltered* digest while the filter chip
stays on. "No articles found matching X", 429s (so `RateLimitDialog` never
opens — it also ignores `code: 'rate_limited'`) and validation errors are lost.

**Fix:** keep `e.message`; skip the archive fallback on 4xx; clear the keyword on
failure; detect rate limits by status/`code`.

### 6. Empty/odd LLM output is saved as a blank summary
`refreshSummary.js:171-195, 235-249`

`{"stories":[…]}`, `{"articles":[]}` or a single object → warning only, then an
empty summary is written over the good one: header says "30 articles", no cards,
no error; reload says "No summary yet"; archive gains an empty entry.

**Fix:** throw `RefreshError` before any write when no valid sections parse.

### 7. Jobs: data silently lost
- **Saved jobs vanish after 7 days** — the recency filter also applies to
  `saved=true` and the saved count (`routes/jobs.js:35, 61`) ✔.
- **One failing source wipes its jobs** — re-fetch deletes everything not saved,
  including sources that errored (`jobs.js:93-120`).
- **A failure on a later page discards earlier pages** — Himalayas/Remotive/
  Arbeitnow `throw` inside pagination (`jobs/sources.js:114, 161, 194`).
- **AI Curate failure empties "AI Only"** — failed batches return `[]`, the route
  deletes all rows and returns 200; the UI ignores the response
  (`ai-filter.js:83-85`, `jobs.js:157-161`, `useJobs.ts:149-161`). Every
  "Fetch New Jobs" also clears AI results (`jobs.js:117`).

**Fix:** exempt saved from the window; delete only successful sources; return
partial pages; 502 + keep rows when all batches fail; only drop orphaned
`ai_filtered_jobs`.

### 8. Deploying with auth enabled breaks the Docker setup
- `server/docker-compose.yml:16` healthcheck probes `/api/categories` (401 with
  `API_TOKEN`) and overrides the Dockerfile's correct `/api/health` → container
  permanently "unhealthy" ✔.
- `client/Dockerfile` / compose never pass `VITE_API_TOKEN` → every API call 401s.
- The two compose files use separate networks, so nginx's `newsreader-api:3001`
  never resolves → 502 unless the containers were joined by hand.

**Fix:** probe `/api/health`; add `ARG/ENV VITE_API_TOKEN`; declare a shared
external network in both compose files.

---

## P1 — wrong or empty output the user can't diagnose

| # | Issue | Where | Fix |
|---|---|---|---|
| 9 | **Keyword filter matches word prefixes** (introduced in #27): "AI" → "Airline", "US" → "User", "war" → "Warner", "Fed" → "Federer" ✔ | `lib/articleTriage.js:65-72` | whole-token match `(^| )kw( |$)` (+ plural), keep joined match for ≥6 chars |
| 10 | **Coverage merges unrelated stories sharing 2 words** — six "Donald Trump …" headlines each score 6 outlets; a single-feed plane crash ranks below them | `articleTriage.js:106-132` | require overlap relative to title size (≥50 % of smaller set or ≥3 words) |
| 11 | **Morning briefing still has the truncation bug** — first 5 items/feed, `slice(0,15)` in feed order → only ~3 feeds, no age window | `routes/briefing.js:16, 60, 114-135` | reuse `selectArticles`; carry outlet names from `sentiment_data` |
| 12 | **Lens uses the old selection** — 10/feed, NaN sort for undated, string `.replace` with `$&` corruption, no language, no lock | `routes/summaries.js:140-176` | reuse `selectArticles` (or the stored summary's articles) + `renderPrompt` |
| 13 | **Card links use the URL the model echoed**, not the matched article → `(undefined)`, mangled Google News URLs, "Full story" opening `app/undefined`; chat can't find the stored body | `refreshSummary.js:193-214`, `utils/safeHref.ts:14` | write `original.link` once attributed; `safeHref` rejects non-absolute |
| 14 | **Feed health computed but never shown** — dead feeds keep shrinking digests silently | `routes/feeds.js:108-118`; `Feed` type lacks `health` | render unhealthy dot / `lastError` / `suggestPause` in FeedManager |
| 15 | **Feed Manager errors silent or shown as success** — duplicate/invalid feed does nothing (unhandled rejection); prompt/language show "Saved" on 4xx/5xx; Discover error = "no feeds found" | `FeedManager.tsx:89-162`, `useFeeds.ts:41` | surface `data.error`; check `res.ok` |
| 16 | **Article "Ask AI" errors swallowed**, input cleared; reply can land in another article's thread | `useArticleChat.ts:128-160`, `ArticleChatPopup.tsx` | render error / assistant "Sorry" message; compare against current title ref |
| 17 | **Chat dead after 3 days without refresh** — retention deletes the newest history row; fallback summary has no `id` | `lib/retention.js:37-41`, `summaries.js:76-88` | keep newest row(s) per category |
| 18 | **Disinfo Map makes a paid LLM call on every Playbook visit** (and on model change); server ignores `regenerate`/provider; rows never purged ✔ | `DisinfoMap.tsx:84-110`, `routes/disinfo.js` | GET cached on mount, POST only on "Regenerate" |
| 19 | **"Reset progress" always 500s**, UI reports nothing — `req.body.userId` on bodyless DELETE ✔ | `routes/cognitive.js:8`, `OverviewTab.tsx:62-71` | `(req.body || {})`; check `res.ok`; reset all stores or reword |
| 20 | **Antibody decay compounds per page load** — 100→90→81→72… | `routes/inoculation.js:28-43` | GET must not write; track `last_decay_at` |
| 21 | **Bias Radar "Compare" keeps ≤1 Google result** — dedupe by hostname, all are `news.google.com` ✔ | `lib/bias-radar/newsSearch.js:234-244` | dedupe by publisher |
| 22 | **Outlet ratings mismatched** — "Financial Times"/"Times of India"/"NY Post" → NYT; "Daily Mail" → Daily Wire; "News" → AP | `lib/outletMatcher.js:492-519` | whole-token match on distinctive tokens; stoplist; return null |
| 23 | **Compare Coverage (URL) and Source Lab fabricate coverage** — URL never fetched, LLM invents headlines | `routes/compare.js:17-38`, `source-lab.js:31-50` | fetch via `safeFetch` / real search, or label hypothetical |
| 24 | **Quizzes that can't be won** — ChallengeQuiz omits `tribal-signaling`/`source-laundering`; Fallacy Dojo accepts unnormalised names → "Unknown fallacy" 400; decode cached 30 days unvalidated | `ChallengeQuiz.tsx:8-19`, `fallacy-dojo.js:59-96`, `decode.js:56-68` | single 12-value enum everywhere; normalise before caching |
| 25 | **Recovery boost revives any dead streak and blocks today's Daily Quiz**; in-article and daily quiz share one slot (daily gives 0 silently) | `gamification.js:65-128`, `QuizTab.tsx` | boost only for 1-day gap, set date to yesterday; key completion by source |
| 26 | **Parse failures shown and stored as neutral real results** (bias 5/10, silo 5, all-Center diet, random virality) | forensics, bridge, narrative, conspiracy-anatomy, source-lab, rabbit-hole | 502 + don't persist |
| 27 | **No error boundary** — one malformed response (Information Diet, Logs on 401/429) blanks the app | no `ErrorBoundary` in `client/src`; `LogsRoute.tsx:30-76` | route-level boundary; validate arrays |
| 28 | **Category delete: one click, no confirm, unrecoverable** ✔ | `SummaryView.tsx:310, 417`, `CategoryRoute.tsx:44-47` | confirm dialog + error handling |

---

## P2 — wrong but limited

- **AI Curate**: re-classifies the whole table every time (status never leaves
  `new`), no `runExclusive`, not rate-limited, can exceed nginx's 120 s →
  504 while the server keeps paying (`jobs.js:145`, `nginx.conf:38`). Depends on
  the model echoing 16-hex ids exactly — use batch-local indices.
- **Job ids** `sha256(source:title:company)` merge same-title postings in
  different cities; no cross-source dedupe (`jobs/common.js:49-55`).
- **Region/role filter**: "Berlin" rejected, "Jerusalem" rejected ("usa"
  substring), "Remote (US)" accepted; "Reactor Physicist" matches role
  (`jobs/profile.js:117-123`).
- **Hacker News source** scans `topstories`, falls back to a hard-coded 2025
  thread whose comments are outside the 7-day window → stored, never shown.
- **LinkedIn** stops after ~2 search terms (shared 60 cap) and hides errors.
- **Widgets**: errors collected in `useWidgets` but never rendered; headlines/
  crypto return 200 `[]` on upstream failure; a failure is cached empty for 5 min.
  On This Day serves yesterday for most of the day (24 h TTL, not date-keyed).
- **Releases**: totals computed from 3 popularity pages *before* the language
  filter — same truncate-then-filter pattern.
- **Logs**: per-day totals computed from the first 500 rows.
- **Pull-to-refresh** does `window.location.reload()` (cancels in-flight paid
  calls, doesn't fetch new stories) and hijacks scroll inside inner lists.
- **Home category filter** pill shows unapplied selections; deleted ids linger →
  permanent 404.
- **Deep links** flash (or, on fetch failure, permanently show) "Category not found".
- **Briefing double-run**: `lockHandler` releases on client disconnect; filtered
  and plain refreshes of one category run concurrently (lock key includes keyword).
- **Triage timeout** doesn't abort the underlying LLM call; it keeps retrying in
  the background against the same quota as the summary.
- **LLM rate limiter** doesn't cover `/refresh` or `/lens`; an `LLMError` 429
  becomes a 500 in `summaries.js:113`.
- **`articles` table** duplicates rows each refresh, no retention; trending tags
  scale with how often you press Refresh, "AI"≠"ai"; "Break" lookback is ~48 h
  (ISO vs SQLite datetime string compare).
- **Inoculation difficulty inverted** (beginners get "Subtle", experts "Obvious").
- **Scientist**: confidence 0 saved as 50 (`|| 50`).
- **Bias Mirror**: biased option always index 0, never shuffled; scores 0 or 10.
- **PatternTests**: "the answer was 57" from a fresh random number.
- **Daily Quiz**: `ORDER BY pub_date` sorts RFC-822 strings by weekday; article
  changes during the day; empty descriptions fail *after* the user guesses;
  date-sum seed collides.
- **Mastery data** recorded only by ChallengeQuiz and never displayed; antibodies
  split across two tables (still open from 2026-08 A/B).
- **LLM picker ignored** by decode, steelman, inoculation, disinfo, bridge.
- **Tables without retention**: `disinfo_maps`, `narrative_maps`,
  `article_decodes`, `skill_events`, `study_analyses`, `forensic_history`,
  `fallacy_dojo_logs`, `inoculation_sessions`, `articles`.

## P3 — doesn't make sense / polish

- Header shows only a time, no date — a 3-day-old summary looks fresh. "30
  articles · 12 sources" counts inputs (cards are ≤8) and failed feeds.
- Archive sidebar is `hidden lg:block` — no history on mobile/tablet.
- Archive `date_key` is the UTC day but the time is local; ordered by
  `date_key` only.
- Selected snapshot stays highlighted after a refresh; clicking it does nothing.
- Briefing language comes from whichever category sorts first; "Today's Front
  Page" label on old briefings.
- Renaming a category navigates to Home.
- `psychological-lesson` prompt isn't reachable in Prompt Manager; 7 prompts
  (`bias-mirror-generate`, `surprise-brief`, …) are editable but never read.
- Settings `language`, `llm_model`, `briefing_time` are writable but unused.
- Slug collisions ("AI" vs "A.I.") and non-Latin names → unreachable category.
- Theme picked before `/settings` responds flips back.
- Weather: several WMO codes show "Unknown"; location hard-coded to Cluj-Napoca.
- Groq quota stats overwrite each other (keyed by provider name, not model).
- README says `deploy-backend.sh`, workflow runs `deploy.sh`.
- Ask the Manipulator sends no conversation history.
- GDELT excerpt shows an image URL; non-Latin keywords stripped.
- `client` lint: 9 errors / 7 warnings (unchanged since 2026-08); `tsc` clean.

## Still open from 2026-08
`routes/telegram.js` unmounted · `discover-feed` returns unparsed `<link>`
candidates · `articles.topic_id` never read · `missing-story` gated with no UI ·
dead components `useSwipeGesture`, `WidgetSidebar`, `ChatPanel`,
`ReadingTimeFilter`, `MoodPicker`.

## Checked and OK
Keyword now matched across the full pool before capping; own-feed items reserved
ahead of Google results; triage fallback/timeout · prompt seeding preserves
edits and edits apply immediately · `renderPrompt`/`parseJSON` · attribution
guards · retention timer · `runExclusive` · `/api/health` before auth, CORS
allowlist, 5xx messages hidden · jobs wipe+insert in one transaction, `clampInt`
· decode cache key · all MindGames endpoints mounted and reachable · inoculation
grading server-side · `apiFetch` token/HTML detection · client↔server contracts
for categories, feeds, summary, history, refresh, lens, chat, briefing, stats,
jobs, explore, widgets · `tsc --noEmit` clean.

## Suggested order
1. P0 #1–#6 (summary page correctness) — one PR, mostly `useSummary`,
   `CategoryRoute`, `refreshSummary`, `llm.js`; plus #9/#10/#13 in the same area.
2. P0 #8 (deploy) — tiny, unblocks enabling auth.
3. P0 #7 + jobs P2 — one jobs PR.
4. P1 #11/#12 (briefing + lens onto `selectArticles`).
5. MindGames P1 batch (#18–#26).
