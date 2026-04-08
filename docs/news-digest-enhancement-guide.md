# News Digest — Enhancement Guide: Fun, Informative & Break-Time Reading

> Based on the full project description (Express 5 + SQLite + React 19 + Vite + Tailwind CSS 4 monorepo, deployed on Vercel/Railway). All suggestions are mapped to existing integration surfaces defined in `PROJECT.md §6`.

---

## Table of Contents

1. [RSS Sources to Add](#1-rss-sources-to-add)
2. [New Break-Time Reading Modes](#2-new-break-time-reading-modes)
3. [Prompt Library Additions](#3-prompt-library-additions)
4. [Suggested New Categories](#4-suggested-new-categories)
5. [Implementation Quick Reference](#5-implementation-quick-reference)

---

## 1. RSS Sources to Add

### 1.1 Fun & Fascinating (the "5-minute delight" cluster)

| Source | RSS URL | Why it's worth it |
|---|---|---|
| **Kottke.org** | `https://feeds.kottke.org/main` | The OG curated web since 1998. Art, science, film, culture — handpicked by one person with extraordinary taste. Short posts, dense links, zero SEO slop. |
| **Atlas Obscura** | `https://www.atlasobscura.com/feeds/latest` | Hidden places, forgotten history, bizarre geography. Every article is a 3-minute rabbit hole that ends with you knowing something genuinely strange about the world. |
| **Mental Floss** | `https://www.mentalfloss.com/feed` | Trivia, word origins, pop science, unexpected history. Ideal break-time content: quick, surprising, never pretentious. |
| **Futility Closet** | `https://feeds.feedburner.com/FutilityCloset` | Paradoxes, historical oddities, logic puzzles, absurd true stories. Infrequent but extremely high quality. The kind of blog where you find yourself reading for 45 minutes without noticing. |
| **Damn Interesting** | `https://www.damninteresting.com/rss` | Long-form deep dives into bizarre true stories (disasters, science, crime, history). Low volume — maybe one post per month — but consistently excellent. Good for the "Long Read" category. |
| **Today I Found Out** | `https://feeds.feedburner.com/TodayIFoundOut` | Answers to questions you didn't know you had. High volume, short reads, addictive. Great complement to the Fascinating Corners category. |

### 1.2 Science & Curiosity (the "feel smarter in 5 minutes" cluster)

| Source | RSS URL | Why it's worth it |
|---|---|---|
| **Quanta Magazine** | `https://www.quantamagazine.org/feed` | Arguably the best science journalism alive. Physics, math, biology, computer science — written for curious non-experts with actual intellectual depth. Award-winning. |
| **Nautilus Magazine** | `https://nautil.us/feed` | Science meets philosophy meets culture. Long, beautiful essays at the edge of human knowledge. Slower pace than Quanta, more meditative. Good for the weekend read. |
| **Mind Hacks** | `https://mindhacks.com/feed` | Neuroscience and psychology news with smart commentary. Short, research-backed posts. Directly relevant to your Bias Radar and inoculation work — the science behind persuasion techniques. |
| **Behavioral Economics Blog** | `https://behavioraleconomics.com/feed` | Research-backed insights on how humans actually make decisions. Direct cross-reference material for the MindGames inoculation system — the academic underpinning of what you're building. |
| **New Scientist — Mind** | `https://www.newscientist.com/subject/mind/feed` | Brain, consciousness, cognition. Snappy 3–5 minute articles, always substantive. Good volume (several per week). |
| **NASA Image of the Day** | `https://www.nasa.gov/rss/dyn/lg_image_of_the_day.rss` | One stunning image per day with scientific context. Quick, delightful, puts everything in perspective. Works well as a WidgetSidebar card. |

### 1.3 Tech & Dev — With Personality

| Source | RSS URL | Why it's worth it |
|---|---|---|
| **Interconnected (Matt Webb)** | `https://interconnected.org/home/feed` | Speculative tech thinking: AI, weird product ideas, protocols, strange software concepts. One of the most original tech writers working today. Directly relevant to your LLM work. |
| **Hacker News Best** | `https://hnrss.org/best` | Only HN posts scoring above 100. Curated signal vs the full firehose. You already have HN in the app — this is a smarter filter on top of it via `hnrss.org`. |
| **Simon Willison's Weblog** | `https://simonwillison.net/atom/everything` | Extremely prolific and technically precise AI/LLM explainer. Covers local models, tool use, safety, new releases. Very relevant to your Ollama + OpenRouter work. |

### 1.4 Geopolitics & Media Literacy (your existing interest, elevated)

| Source | RSS URL | Why it's worth it |
|---|---|---|
| **Bellingcat** | `https://www.bellingcat.com/feed` | OSINT investigations, disinformation exposure, conflict analysis. Perfect complement to your Bias Radar + disinfo map features. When you need real examples for the inoculation lab, Bellingcat provides them. |
| **EU DisinfoLab** | `https://www.disinfo.eu/feed` | Investigations into disinformation campaigns across Europe, including CEE operations. Directly feeds your interest in Fidesz/Romanian oligarchic structures + media literacy. |
| **Foreign Affairs** | `https://www.foreignaffairs.com/rss.xml` | Long-form analysis from policymakers and academics. Dense, slow, high signal. Good for the "Long Read" category — save for weekends. |
| **Balkan Insight** | `https://balkaninsight.com/feed` | Investigative journalism covering Southeast Europe, Romania, Hungary, EU accession politics. Fills a real gap between Romanian domestic press and Western coverage. |
| **EU Observer** | `https://euobserver.com/rss` | EU regulatory news, institutional politics, Eastern Partnership. Good complement to existing CEE sources. |

---

## 2. New Break-Time Reading Modes

These are feature ideas mapped to the existing architecture. Each section includes the integration surface from `PROJECT.md §6`.

---

### 2.1 Break Mode — "Surprise Me"

**What it is:** A dedicated "5-minute break" entry point. Picks one random article from the last 48h across all categories, filtered for short read time. Shows it in a clean focus layout with a soft countdown timer, and a single "Rabbit Hole" action below.

**UX flow:**
1. User taps "Surprise Me" button (WidgetSidebar or homepage header)
2. App fetches `GET /api/homepage/surprise` — returns one article
3. Article renders in full-screen focus mode (sidebars hidden)
4. 5-minute timer displayed as a progress ring (optional, dismissible)
5. Below the article: a "Rabbit Hole →" button and a "Next article" button

**Integration surface:**
- **Backend:** New route `server/routes/surprise.js`. Query `articles` table ordered by `RANDOM()`, filtered to `pub_date > now - 48h`, prefer rows where `LENGTH(description) < 1200` (short read proxy).
- **Frontend:** New route `/break` in `App.tsx`. Minimal layout — no `LeftSidebar`, no `WidgetSidebar`. Just the article + timer + actions.
- **No new tables needed.** Uses existing `articles` table.

```js
// server/routes/surprise.js (sketch)
router.get('/', (req, res) => {
  const article = db.prepare(`
    SELECT * FROM articles
    WHERE pub_date > datetime('now', '-48 hours')
    AND LENGTH(description) < 1500
    ORDER BY RANDOM()
    LIMIT 1
  `).get();
  res.json(article);
});
```

---

### 2.2 Mood Picker

**What it is:** On homepage or via a sidebar button, show 4 mood options. Each maps to a specific category + custom prompt combination. No new backend work — uses the existing `custom_prompt` field on categories and the existing summary generation flow.

| Mood | Label | Category suggestion | Prompt override |
|---|---|---|---|
| ✨ | Amaze me | Fascinating Corners | `weird-daily` — extract the strangest fact |
| 😄 | Make me laugh | Fascinating Corners / Mental Floss | `bad-movie-plot` prompt |
| 🧠 | Teach me something | Brain Food | `most-counterintuitive-fact` prompt |
| 😬 | Disturb me gently | Disinfo Watch / Bellingcat | `hidden-incentives` prompt |

**Integration surface:**
- **Frontend only change:** `NewspaperHome.tsx` — add a 4-button mood row near the top. On click, call `POST /api/categories/:id/summary` with `{ overridePrompt: moodPrompt }`. The existing `buildMessages` system already supports custom prompts.
- **Backend:** Minor — `routes/summaries.js` already accepts `customPrompt` in body. Just pass it through to `buildMessages`.

---

### 2.3 Rabbit Hole Button (per article)

**What it is:** A fourth tab inside the existing `BiasRadarPanel` — "Explore". Given the current article, the LLM finds the most interesting adjacent topic to dive into and returns a rabbit hole suggestion with a Wikipedia summary.

**UX flow:**
1. User opens BiasRadarPanel on any article
2. Taps "Explore" tab
3. LLM returns: `{ topic, whyItConnects, wikiSummary, searchQuery, funFact }`
4. User sees a short teaser, taps "Go deep →" which opens the search in a new tab

**Integration surface:**
- **Backend:** New file `server/routes/bias-radar/rabbit-hole.js`. `POST /` body: `{ headline, content, language }`. Uses `callLLM` with a new prompt slug `bias-radar-rabbit-hole`. Optionally fetches Wikipedia summary via `fetchWithTimeout`.
- **Frontend:** New tab in `BiasRadarPanel.tsx`. New component `BiasRadarExplore.tsx` under `features/mindgames/bias-radar/`. Follow exact pattern of `BiasRadarSteelman.tsx`.
- **New type** in `types/lens.ts`:
  ```typescript
  interface RabbitHoleResult {
    topic: string;
    whyItConnects: string;
    wikiSummary: string;
    searchQuery: string;
    funFact: string;
  }
  ```
- **New prompt slug:** `bias-radar-rabbit-hole` — seed in `server/db.js`.

**Wikipedia API call (no auth needed):**
```js
// In server/routes/bias-radar/rabbit-hole.js
const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
const wiki = await fetchWithTimeout(wikiUrl, {}, 3000);
const wikiData = await wiki.json();
```

---

### 2.4 Daily Weird Fact Widget

**What it is:** A small card in `WidgetSidebar` showing one fascinating short article from Atlas Obscura or Today I Found Out. Cached server-side, refreshes at midnight. One line, one link, zero noise.

**Integration surface:**
- **Backend:** Add to `server/routes/widgets.js` — new cache key `weird-fact`, TTL = daily. Parse Atlas Obscura RSS via `lib/rss.js`, pick the first item published today (or most recent if none today).
- **Frontend:** New card in `WidgetSidebar.tsx`. Add `weirdFact?: WeirdFactWidget` to `client/src/types/widgets.ts`. Fetch in `hooks/useWidgets.ts`.

```js
// Addition to server/routes/widgets.js
const weirdFactCache = { data: null, ts: 0 };
router.get('/weird-fact', async (req, res) => {
  const TTL = 24 * 60 * 60 * 1000;
  if (weirdFactCache.data && Date.now() - weirdFactCache.ts < TTL) {
    return res.json(weirdFactCache.data);
  }
  const items = await parseRSS('https://www.atlasobscura.com/feeds/latest');
  weirdFactCache.data = items[0]; // most recent
  weirdFactCache.ts = Date.now();
  res.json(weirdFactCache.data);
});
```

---

### 2.5 Reading Time Filter on Homepage

**What it is:** A "I have X minutes" quick filter bar on `NewspaperHome`. Articles get a reading time estimate badge. Filter hides anything above the selected threshold. Pure client-side.

**Integration surface:**
- **Backend:** Return `word_count` or estimate it from `LENGTH(description)` in `routes/homepage.js`.
- **Frontend:** In `NewspaperHome.tsx`, add `[2, 5, 10]` minute filter buttons. Estimate read time: `Math.ceil(wordCount / 200)` minutes. Show badge on each article card. Filter state in `useState`.

---

### 2.6 On This Day — Mini Panel

**What it is:** A collapsible "On this day in history" section on the homepage or morning briefing. Powered by the Wikipedia REST API — no API key, no cost, returns 3–5 historical events for today's date.

**Integration surface:**
- **Backend:** New route `GET /api/widgets/on-this-day`. Calls `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/MM/DD`. Cache with daily TTL. Parse `selected` events array — return top 3 with `text`, `year`, `pages[0].titles.normalized`.
- **Frontend:** New collapsible panel in `MorningBriefing.tsx` or as a WidgetSidebar card.

```js
// server/routes/widgets.js addition
router.get('/on-this-day', async (req, res) => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${mm}/${dd}`;
  const data = await fetchWithTimeout(url).then(r => r.json());
  const events = (data.selected || data.events || []).slice(0, 3).map(e => ({
    year: e.year,
    text: e.text,
    link: e.pages?.[0]?.content_urls?.desktop?.page
  }));
  res.json(events);
});
```

---

## 3. Prompt Library Additions

These are ready-to-seed prompts for the `prompts` table in `server/db.js`. Each follows the existing `{ slug, name, description, category, system_message, user_prompt }` schema. The `{{articles}}` and `{{category}}` variables are already handled by `lib/promptManager.js`.

---

### `contrarian-take`

**Category:** `mindgames`
**Name:** Contrarian Take
**Description:** Finds and articulates the strongest opposing view to the article's main premise.

```
System: You are an intellectually honest contrarian. Your job is not to be difficult — it is to find the most legitimate, best-supported challenge to a dominant narrative. Be fair, be specific, be provocative but not dishonest.

User: Read these articles about {{category}}:

{{articles}}

Give me: (1) The main premise the articles seem to agree on. (2) The strongest possible counterargument — not a strawman, the real steelman of the opposing view. (3) What the contrarian would need to believe to be right, and how likely that is. Make it engaging. Max 200 words.
```

---

### `bad-movie-plot`

**Category:** `news`
**Name:** Netflix Thriller Summary
**Description:** Summarizes the news as a mediocre Netflix thriller pitch. Funny but accurate.

```
System: You are a movie pitch writer for a streaming platform that makes thrillers that are just slightly too on the nose. You can turn any news story into a dramatic but slightly ridiculous logline.

User: Here are today's articles from the {{category}} category:

{{articles}}

Summarize the main story as if it's the plot synopsis of a Netflix thriller that nobody asked for. Add dramatic but slightly ridiculous character motivations. Include a fake movie title. Keep it under 120 words. It should be funny, but the reader should recognize the real story inside it.
```

---

### `hidden-incentives`

**Category:** `mindgames`
**Name:** Hidden Incentive Map
**Description:** Maps the incentive structure and who benefits from each article being told the way it is.

```
System: You are an investigative analyst trained in political economy and incentive mapping. You don't assume malice, but you always ask: who benefits, who loses, and who is protecting whom?

User: These articles cover {{category}}:

{{articles}}

For the main story: (1) Who are the key actors? (2) What does each actor gain or lose from this outcome? (3) Who is notably absent from the story — and why might they be? (4) What would change about how you read this article if you knew the answer to one specific hidden fact? Present as a brief incentive map, max 200 words. No conspiracy theories — just structural analysis.
```

---

### `100-years-ago`

**Category:** `news`
**Name:** 100 Years Ago
**Description:** Puts the news story in historical context by asking what would be different — and what would be identical — if this happened a century ago.

```
System: You are a historian and social analyst. You find genuine illumination in comparing present events to historical parallels — not to make cheap analogies, but to isolate what is truly new vs. what is the same old human drama.

User: Here are articles about {{category}}:

{{articles}}

Pick the most significant story. Then answer: If this exact situation were happening in {{year}}, what would be fundamentally different? What technology, political structure, or social norm would change it? And what core human dynamic — greed, fear, tribalism, ambition — would be completely identical? Keep it under 180 words. Make it genuinely insightful, not just nostalgic.
```

---

### `unintended-consequences`

**Category:** `mindgames`
**Name:** Unintended Consequences
**Description:** Predicts the 3 most likely unintended side effects of the main news story, with historical parallels.

```
System: You are a systems thinker and historian of unintended consequences. You have studied how policies, decisions, and events produce effects that nobody anticipated — especially the ones that seem obvious in retrospect.

User: Here are today's articles about {{category}}:

{{articles}}

Identify the main event or decision. Then predict the 3 most likely unintended consequences — effects nobody is currently discussing but that history strongly suggests are probable. For each: name the consequence, cite a historical parallel, and rate likelihood as high/medium/low. Be specific. Max 220 words.
```

---

### `explain-to-alien`

**Category:** `news`
**Name:** Explain to an Alien
**Description:** Forces first-principles clarity by explaining the news to someone with no concept of money, nation-states, or social media.

```
System: You explain things to beings who are highly intelligent but have no familiarity with human institutions, money, politics, or social media. Your explanations must use only first principles and observable facts — no jargon, no assumed shared context.

User: Here are articles about {{category}}:

{{articles}}

Explain the main story to a highly intelligent visitor who has never encountered: money, nation-states, political parties, or social media. What background do they need first? What would confuse them most? And — most interestingly — what would seem completely obvious to them that humans have somehow missed or normalized? Max 200 words.
```

---

### `most-counterintuitive-fact`

**Category:** `news`
**Name:** Most Counterintuitive Fact
**Description:** Finds the single most surprising or counterintuitive claim buried in the articles.

```
System: You are a fact-hunter who reads between the lines of news articles looking for the one claim that most contradicts common assumptions. You are not interested in the obvious headline — you are interested in the detail that, if true, changes everything.

User: Read these articles about {{category}}:

{{articles}}

Find the single most counterintuitive or surprising factual claim. Not the headline — the detail buried inside. The one thing that, if true, changes how a reader understands the whole story. Surface it, explain why it's counterintuitive, and explain why it matters. Max 150 words. If you find nothing genuinely surprising, say so.
```

---

### `five-minute-rabbit-hole`

**Category:** `mindgames`
**Name:** 5-Minute Rabbit Hole
**Description:** Finds the most interesting adjacent topic a curious reader should explore next, with a specific search query and opening question.

```
System: You are a guide for the intellectually curious. You find the most interesting hidden connection from any news story to an adjacent topic that most readers would never think to explore — not the obvious follow-up, but the genuinely surprising one.

User: Here is an article from {{category}}:

{{articles}}

Give me one specific rabbit hole I can fall into for exactly 5 minutes. It must be: (1) adjacent but non-obvious, (2) genuinely fascinating on its own, not just "more on this topic". Return: { topic: string, whyItConnects: string (1 sentence), openingQuestion: string, searchQuery: string }. The opening question should make me actually want to look it up.
```

---

## 4. Suggested New Categories

These map directly to the category CRUD system (`routes/categories.js`) and use existing RSS feed infrastructure (`routes/feeds.js` + `routes/summaries.js`).

---

### Fascinating Corners

**Purpose:** Break-time delight. Open the app, get amazed in 90 seconds.

**Feeds to add:**
- `https://www.atlasobscura.com/feeds/latest` — Atlas Obscura
- `https://feeds.feedburner.com/FutilityCloset` — Futility Closet
- `https://feeds.kottke.org/main` — Kottke.org
- `https://www.damninteresting.com/rss` — Damn Interesting
- `https://feeds.feedburner.com/TodayIFoundOut` — Today I Found Out

**Custom prompt:** Set `weird-daily` mode — a prompt that extracts the one strangest fact from the batch and presents it as a punchy, delightful paragraph with a hook. Seed as `category-weird-daily` in the prompt manager.

**Language:** `en`
**Icon:** 🔭 or 🌀

---

### Brain Food

**Purpose:** 5-minute intellectual upgrade. Not news, not entertainment — genuine learning.

**Feeds to add:**
- `https://www.quantamagazine.org/feed` — Quanta Magazine
- `https://nautil.us/feed` — Nautilus Magazine
- `https://mindhacks.com/feed` — Mind Hacks
- `https://www.newscientist.com/subject/mind/feed` — New Scientist: Mind
- `https://behavioraleconomics.com/feed` — Behavioral Economics

**Custom prompt:** "Teach me the most important idea in these articles as if I'm a smart person with no background in this field. Use one analogy. Under 200 words. End with one question I should sit with."

**Language:** `en`
**Icon:** 🧠

---

### Disinfo Watch

**Purpose:** Real-world fuel for MindGames, inoculation lab examples, and Bias Radar decode training.

**Feeds to add:**
- `https://www.bellingcat.com/feed` — Bellingcat
- `https://www.disinfo.eu/feed` — EU DisinfoLab
- `https://firstdraftnews.org/feed` — First Draft (check if still active)

**Custom prompt:** Use `hidden-incentives` prompt. Optionally chain with disinfo-map visualization on generation.

**Language:** `en`
**Icon:** 🕵️

---

### The Long Read

**Purpose:** Weekend reading. Slow, dense, high-quality.

**Feeds to add:**
- `https://nautil.us/feed` — Nautilus
- `https://www.foreignaffairs.com/rss.xml` — Foreign Affairs
- `https://aeon.co/feed.rss` — Aeon Magazine
- `https://longreads.com/feed` — Longreads

**Custom prompt:** "Give me: (1) The main argument in one sentence. (2) The most interesting quote worth remembering — exactly as written, under 30 words. (3) One question this piece leaves deliberately unanswered. Max 150 words total."

**Language:** `en`
**Icon:** 📚

---

### CEE Radar

**Purpose:** Your personal geopolitics feed, tuned for Central and Eastern European patterns — disinformation, oligarchy, EU politics, Romanian/Hungarian dynamics.

**Feeds to add:**
- `https://balkaninsight.com/feed` — Balkan Insight
- `https://euobserver.com/rss` — EU Observer
- `https://www.bellingcat.com/feed` — Bellingcat (or share with Disinfo Watch)
- Your existing Romanian/Hungarian sources

**Custom prompt:** "Identify: (1) Any cross-border coordination patterns — decisions that seem domestic but align across multiple countries. (2) EU regulatory angles — which Brussels framework is being invoked or avoided? (3) Oligarchic network signals — which private interests stand to gain, and who owns the outlets covering this? Present as a brief intelligence-style summary. Max 220 words."

**Language:** `ro` / `en` (set per feed)
**Icon:** 🗺️

---

## 5. Implementation Quick Reference

### Priority order (highest ROI first)

| # | Feature | Effort | Files touched | Impact |
|---|---|---|---|---|
| 1 | Add RSS sources (Fascinating Corners category) | Low — 20min | DB only | Immediate content quality lift |
| 2 | Seed new prompts in db.js | Low — 30min | `server/db.js` | Unlocks all new reading angles |
| 3 | Daily Weird Fact widget | Medium — 1h | `routes/widgets.js`, `types/widgets.ts`, `hooks/useWidgets.ts`, `WidgetSidebar.tsx` | Delight on every app open |
| 4 | Reading time filter on homepage | Medium — 1.5h | `routes/homepage.js`, `NewspaperHome.tsx` | Core break-mode UX |
| 5 | On This Day panel | Medium — 1.5h | New widget route, `MorningBriefing.tsx` | Zero API cost, high delight |
| 6 | Surprise Me route + Break Mode | Medium-High — 3h | New route, new `/break` React route, focus layout | Best break-time UX |
| 7 | Rabbit Hole tab in BiasRadarPanel | High — 4h | `routes/bias-radar/rabbit-hole.js`, `BiasRadarPanel.tsx`, new `BiasRadarExplore.tsx`, `types/lens.ts` | Deepest feature, most memorable |
| 8 | Mood Picker | Medium — 2h | `NewspaperHome.tsx`, minor `routes/summaries.js` change | Personalizes every session |

### New prompt slugs to seed in `server/db.js`

```js
// Add to the prompts seed array in db.js
{ slug: 'contrarian-take',           category: 'mindgames', name: 'Contrarian Take' },
{ slug: 'bad-movie-plot',            category: 'news',      name: 'Netflix Thriller Summary' },
{ slug: 'hidden-incentives',         category: 'mindgames', name: 'Hidden Incentive Map' },
{ slug: '100-years-ago',             category: 'news',      name: '100 Years Ago' },
{ slug: 'unintended-consequences',   category: 'mindgames', name: 'Unintended Consequences' },
{ slug: 'explain-to-alien',          category: 'news',      name: 'Explain to an Alien' },
{ slug: 'most-counterintuitive-fact',category: 'news',      name: 'Most Counterintuitive Fact' },
{ slug: 'five-minute-rabbit-hole',   category: 'mindgames', name: '5-Minute Rabbit Hole' },
{ slug: 'bias-radar-rabbit-hole',    category: 'bias-radar',name: 'Rabbit Hole Explorer' },
{ slug: 'category-weird-daily',      category: 'news',      name: 'Weird Daily (Fascinating Corners)' },
```

### External APIs used (no new API keys needed)

| API | Endpoint | Auth | TTL |
|---|---|---|---|
| Wikipedia On This Day | `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/MM/DD` | None | Daily |
| Wikipedia Page Summary | `https://en.wikipedia.org/api/rest_v1/page/summary/:title` | None | Per request |
| Atlas Obscura RSS | `https://www.atlasobscura.com/feeds/latest` | None | 1–6h |
| hnrss.org Best | `https://hnrss.org/best` | None | 30min |

All calls should go through existing `lib/fetchWithTimeout.js` and follow the `Map + TTL` caching pattern already used in `routes/widgets.js`.

---

*Generated for the News Digest project. Architecture references map to `PROJECT.md` §3–6.*
