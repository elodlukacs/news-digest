# News App Research → Adoption Plan

Cross-reference of ideas from `news-app-research.html` (April 2026 feature compendium) against the current **News Digest** application. Each idea is classified as:

- **✅ Already shipped** — exists in some form; note how
- **🟡 Partial** — related capability exists, could be extended
- **🟢 Adoptable** — not in the app, good fit, worth adding
- **⚪ Skip** — out of scope for this app's shape (desktop-first, single-user, editorial UI)

> **App context recap:** React 19 + Express 5 + SQLite, single-user (no accounts), newspaper-editorial UI, RSS → LLM summary pipeline, MindGames cognitive-resilience dashboard already covering bias/fallacy/compare-coverage, widgets (jobs, movies, weather, crypto, HN, PBS), chat-with-summary, morning briefing, Telegram export.

---

## 01 · AI-Powered Core Features

| Idea | Status | Notes |
|---|---|---|
| Multi-Source Story Clustering | 🟢 Adoptable | App summarizes **per category** but doesn't cluster the same event across sources. High value — would dedupe the current feed noise. Could leverage embeddings + a daily sliding window (the academic K-means + BoW pattern from §08 of the report). |
| AI Bullet-Point Summaries | ✅ Already shipped | Summaries already structured; consider tightening to a strict 3–5 bullet format at the top of each section for scannability. |
| Conversational Follow-Up Chat | ✅ Already shipped | "Ask about this news" exists. Worth surfacing the entry point at the **bottom** of every story section as Rize does, not only as a header button. |
| Guided Question Model | 🟢 Adoptable | After reading a summary, show 3 LLM-generated "angles you haven't considered." Natural fit next to existing chat — reuse the chat endpoint with a pre-seeded prompt. Complements the Scientist's Sandbox philosophy already in MindGames. |
| Story Timeline / Evolving Coverage | 🟢 Adoptable | Currently we have "Summary history by date" but not a per-story timeline that tracks an ongoing event across days. High value for elections/conflicts. Would require entity/event linking across summaries. |
| Sentiment Meter | 🟡 Partial | Per-section sentiment analysis exists. Surface it visually as a bar/dot next to each section header; include in morning briefing. |
| Global Perspectives View | 🟢 Adoptable | Not present. Would complement the existing Compare Coverage (Left/Center/Right) by adding a **geographic axis** (US / EU / non-Western). Could be a MindGames Analysis tab feature. |
| Morning AI Briefing | ✅ Already shipped | Already exists; consider adopting the **time-box + hard cap** idea (5–10 stories, auto-closes) as an explicit mode toggle. |

---

## 02 · Bias & Transparency

| Idea | Status | Notes |
|---|---|---|
| Bias Distribution Bar | ✅ Already shipped | `BiasBar` component renders a colored dot + bias label (e.g., "Ctr-R") next to the source badge on every article card (SummaryView) and homepage (HomeRoute). Bias data sourced from the 29-outlet static ratings via `server/lib/outletMatcher.js` fuzzy matching. |
| Blindspot Feed | 🟢 Adoptable | Not present. Would need cross-spectrum source ingestion and lopsided-coverage detection. Strong differentiator; aligns with the app's cognitive-resilience angle. |
| Source Credibility Score | ✅ Already shipped | `CredibilityBadge` shows `factCheckGrade` + credibility score (e.g., "A+ 92") as a colored pill on every article card and homepage. Same 29-outlet static dataset, color-coded by tier (green for 90+, amber for 70-89, red for <70). Filtering low-credibility sources is not yet implemented. |
| Ownership & Funding Transparency | 🟢 Adoptable | Static mapping of outlet → owner → known conflicts. Displayed on-hover over source name. Small dataset, one-time curation. |
| Full Coverage Side-by-Side | ✅ Already shipped | Compare Coverage view in MindGames does this. |
| My News Bias Dashboard | 🟢 Adoptable | A personal analytics page showing which outlets/political leans the user actually opens. Needs per-open event tracking — small schema addition to SQLite. Fits the "self-awareness" ethos of MindGames. |

---

## 03 · Personalization & Curation

| Idea | Status | Notes |
|---|---|---|
| Conversational Onboarding | ⚪ Skip | Single-user, config-driven app — onboarding flow is overkill. |
| Thumbs Up/Down Feedback Loop | 🟢 Adoptable | Per-section 👍/👎 would feed the LLM prompt for next generation ("avoid topics the reader downvoted"). Simple SQLite table + prompt injection. |
| Capped Daily Story Counts | 🟡 Partial | Morning briefing is finite; the homepage feed is not. Add a per-category "max N stories/day" setting that prunes AI output. |
| Hyper-Local Coverage | ⚪ Skip | Not aligned with the current editorial/global shape. |
| Preferred Sources Whitelist | 🟡 Partial | Feed management exists. Add a "boost this source" toggle that raises weight in morning briefing. |
| Paywall / Ad Filter | 🟢 Adoptable | Detect known-paywalled domains and either hide or tag them. Small curated list. |
| Scrap / Topic Collections | 🟢 Adoptable | "Save to collection" with named folders. Pairs well with existing summary history. |
| Keyword Alert System | 🟢 Adoptable | User-defined keywords → Telegram push (Telegram integration already exists). Very low effort given the existing pipeline. |

---

## 04 · Reading Experience

| Idea | Status | Notes |
|---|---|---|
| Reader / Clean View Mode | 🟡 Partial | Summaries are already clean; for **source articles**, an extracted reader view (Jina / Readability) would replace the "open in new tab" jump. |
| Reading Time Estimate | 🟢 Adoptable | Trivial: `wordCount / 200 wpm`. Add to every summary section + morning briefing. Great expectation-setter. |
| Offline Mode / Download | 🟡 Partial | Summaries are cached server-side. A client-side PWA service-worker cache + "download today's digest" button would close the loop. |
| Cross-Device Reading Sync | ⚪ Skip | Single-user, self-hosted shape; sync is implicit via the server. |
| Swipe Card Interface | 🟢 Adoptable (optional) | Could be an alternative mobile layout — "Focus Mode" — one summary per screen with swipe. Paired with the capped-count idea, this becomes the app's anti-doomscroll mode. |
| Magazine-Style Layout | ✅ Already shipped | 5-column newspaper grid is already the editorial identity. |
| Data Visualisation Inline | 🟡 Partial | Recharts is in the stack (used in MindGames). Extend to inline charts in summaries when the LLM detects numeric/time-series content. |
| Dark / Light Theme | ✅ Already shipped | 4 newspaper themes. |

---

## 05 · Audio & Multimedia

| Idea | Status | Notes |
|---|---|---|
| TTS Article Narration | 🟢 Adoptable | Web Speech API is free and works in-browser — zero cost play button on each section. ElevenLabs upgrade path available. High demand per the report. |
| AI Audio Briefing / Podcast | 🟢 Adoptable | Render the morning briefing as a single TTS stream. With the existing chat endpoint, "PodTalk"-style interactive pause-and-ask is technically feasible. |
| Video News Tab | ⚪ Skip | Off-brand for an editorial text app. |
| Newsletter/Podcast Inbox | 🟡 Partial | RSS already ingests newsletters via feeds. A dedicated "Newsletters" category with a different render treatment could be a small addition. |

---

## 06 · Gamification & Engagement

| Idea | Status | Notes |
|---|---|---|
| Reading Streak | 🟢 Adoptable | Count consecutive days the user opens at least one summary. Flame icon in header. SQLite: single `user_activity(date)` table. Proven 2.3× daily-engagement lift. |
| Milestone Badges | 🟢 Adoptable | "Read 100 summaries," "Explored 10 topics," "Completed 50 MindGames exercises." Complements the MindGames dashboard naturally. |
| Daily Current Events Quiz | ✅ Already shipped | MindGames has a Daily Quiz. Consider auto-generating additional quiz items from **today's summaries** (not just MindGames techniques). |
| Polls & Prediction Games | 🟢 Adoptable (small) | Single-user so no "community" — but a private prediction log ("I think X will happen") with a look-back review is an interesting self-reflection tool. |
| Leaderboard | ⚪ Skip | Single-user app. |
| "Daily 5" Format | 🟡 Partial | Fits neatly alongside morning briefing — 5 quiz questions auto-generated from the day's summaries at 8 PM. |

---

## 07 · Social & Community

| Idea | Status | Notes |
|---|---|---|
| In-Article Discussions | ⚪ Skip | Single-user app. |
| Smart Share with Preview | 🟢 Adoptable | When exporting to Telegram, include bias-bar snapshot + source-count line. Telegram integration already exists — small prompt/template change. |
| Custom Magazines / Boards | 🟡 Partial | Same as Scrap Collections (§03). |
| Opinion Spectrum View | ✅ Already shipped | MindGames' Compare Coverage / News Spectrum covers this. |

---

## 08 · Technical Patterns

| Idea | Status | Notes |
|---|---|---|
| LLM Summarization Pipeline | ✅ Already shipped | Current pipeline mirrors this. Missing piece: **relevance scoring / noise reduction** as a distinct step before summarization. Would improve the signal-to-noise ratio significantly. |
| Microservice Architecture | ⚪ Skip | Monolithic Express is right-sized for a single-user self-hosted app. |
| Self-Hosted RSS Reader | ✅ Already shipped | `rss-parser` + SQLite WAL ≈ newspipe's shape. |
| React Frontend Patterns | ✅ Already shipped | React 19 + shadcn + Tailwind + Vite + TS — exact stack match. |
| AI Classification + Clustering (sliding window) | 🟢 Adoptable | The **5-day sliding-window K-means** approach is the right pattern for story clustering (§01) without re-embedding the entire corpus daily. |

---

## Priority Recommendation (for this app specifically)

Mapping the report's matrix to what's actually missing here:

### Ship First (high value, low effort)
1. ~~**Source credibility badge**~~ ✅ shipped
2. **Reading time estimate** — one `wordCount/200` util, displayed everywhere
3. **Reading streak counter** — single table, header badge
4. **Keyword alerts to Telegram** — reuses existing Telegram pipeline
5. **Thumbs up/down feedback** — feeds next-day prompt
6. **TTS play button** — Web Speech API, zero cost
7. ~~**Inline bias bar on homepage cards**~~ ✅ shipped
8. **Paywall tagging** — curated domain list

### Plan for V2 (high value, higher effort)
1. **Multi-source story clustering** (sliding-window embeddings)
2. **Story timeline across days** for ongoing events
3. **Audio briefing** (TTS-rendered morning digest with queue)
4. **Guided question model** after each summary
5. **Ownership transparency hover cards**
6. **Blindspot feed** — needs cross-spectrum ingestion
7. **My News Bias dashboard** — event tracking + self-reflection view

### Experiment With (differentiators)
1. **Focus Mode** — swipe-card single-story layout for mobile, auto-closes after N
2. **Daily 5** — 5 quiz questions generated from today's actual summaries (extends existing Daily Quiz)
3. **Global perspectives axis** in Compare Coverage (geographic, not just political)
4. **Private prediction log** with look-back review

### Meta-principles worth stealing
From the report's closing callout: *"40% of people now actively avoid the news. The apps that win make staying informed feel manageable, trustworthy, and even fun."* This app already leans hard into **trust** (MindGames) and **editorial calm** (newspaper UI). The gaps to close are **habit mechanics** (streaks, quizzes, audio) and **story-level clustering** (kill duplicate-headline fatigue).

---

*Compiled from `news-app-research.html` · 2026-04-22*
