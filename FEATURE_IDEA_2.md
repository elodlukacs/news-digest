# Critical Thinking & Media Literacy Feature — "Bias Radar"
### Feature Design Brief for The Daily Brief

---

## Table of Contents

1. [What the Research Says](#1-what-the-research-says)
2. [Feature Architecture](#2-feature-architecture-the-lens-mode)
3. [The Five Interaction Modes](#3-the-five-interaction-modes)
4. [Core Taxonomy: Manipulation Techniques](#4-core-taxonomy-manipulation-techniques-to-teach)
5. [Prompt Engineering Layer](#5-the-prompt-engineering-layer)
6. [Engagement Design](#6-engagement-design-what-makes-this-sticky)
7. [Handling Political Polarization](#7-handling-political-polarization-specifically)
8. [Technical Integration](#8-technical-integration-points-for-the-stack)
9. [Build Order & Priorities](#9-what-to-build-first)

---

## 1. What the Research Says

Before designing anything, it's worth understanding the honest picture from the science.

### What Works: Prebunking / Psychological Inoculation

The most validated approach in media literacy research is **prebunking** — exposing users to weakened doses of manipulation tactics *before* they encounter them in the wild. Research on the "Bad News" game found that having people roleplay as a fake news creator, walking a mile in the shoes of a disinformation producer, made them significantly less susceptible to future misinformation techniques.

A 2025 meta-analysis re-analyzing 33 inoculation experiments (combined N = 37,000+) found that both gamified and video-based interventions consistently improve discrimination between reliable and unreliable news, **without making people uniformly skeptical of everything** — meaning users become better discerners, not just contrarians.

### What Doesn't Work

Passive "reading and learning" formats don't stick. Critical thinking skills can only be meaningfully developed when people engage with media not only as consumers but also as producers — they need to **do something active** with the content, not just read about bias theory.

### The Nuance: Discernment vs. Distrust

Some reanalyses of gamified inoculation tools found that they sometimes elicited more "this is fake" responses to *all* news items (more conservative responding) rather than improving the actual ability to distinguish true from false content. This means the feature should reward **nuanced judgment**, not just skepticism. The goal is a better calibrated reader, not a more cynical one.

### Key Design Principle from the Research

> Actively open-minded thinking (AOT) — characterized by actively avoiding myside bias and overconfidence in one's conclusions — is consistently associated with lower misinformation susceptibility. Interventions that train AOT directly reduce conspiracy belief and improve truth discernment.

Everything in this feature design flows from that principle.

---

## 2. Feature Architecture: "Bias Radar" Mode

**Name:** Bias Radar

The feature activates on any headline from the RSS feed and offers several interactive modes the user picks from.

### The Golden Rule

> **Every interaction produces a judgment or prediction from the user FIRST, then the analysis. Never lead with the answer.**

This is non-negotiable. The moment you show the analysis before the user has committed to a position, you've turned it into passive consumption again. The pedagogical value is entirely in the user forming and then testing their own assessment.

### The Modes at a Glance

| Mode | Name | Core Mechanic | Targets |
|------|------|---------------|---------|
| A | Who's Telling This Story? | Multi-source comparison | Framing bias, source awareness |
| B | Spot the Technique | Classification quiz | Manipulation tactics (prebunking) |
| C | The Devil's Advocate | Steelmanning | Confirmation bias, myside bias |
| D | The Timeline Check | Narrative drift forensics | Context collapse, evolving stories |
| E | The Missing Story | Weekly agenda audit | Agenda setting, omission bias |

---

## 3. The Five Interaction Modes

### Mode A — "Who's Telling This Story?" (Source & Framing Analysis)

User picks a headline from the feed. Before seeing any analysis:

**Step 1 — Gut check:** "Rate your initial reaction to this headline: Outraged / Skeptical / Interested / Bored."
This primes metacognitive awareness — makes the user conscious of their emotional state before reading.

**Step 2 — The reveal:** The LLM analyzes the article for framing — what's foregrounded, what's absent, what language choices are doing implicit work. If the RSS feed aggregates across outlets, pull 2–3 versions of the same story and present them side by side (AllSides-style: Left / Center / Right).

**Step 3 — The challenge:** "What fact would change your mind about this story? What would you need to see to believe the opposite framing?"

This is the **perspective comparison engine** and is the most immediately buildable feature since the app already has multi-source RSS data. AllSides rates bias on a 5-point scale across 2,400+ outlets — their methodology (blind bias surveys + multipartisan editorial panels) is a good model for how to frame source labels in the UI.

---

### Mode B — "Spot the Technique" (Prebunking / Inoculation)

Inspired directly by the psychological inoculation research, applied to real current headlines:

**Step 1:** The LLM presents a real headline (or slightly modified excerpt) and asks the user to identify which manipulation technique is being used — from the fixed taxonomy defined in Section 4.

**Step 2:** User picks from the taxonomy list.

**Step 3:** Reveal + explanation + a second related real example from the feed.

**Step 4:** Over time, the user builds a "Techniques Spotted" collection — lightweight gamification without score pressure.

**Difficulty calibration:** Start with obvious examples (outrage bait, headline/body mismatch) and graduate to subtle ones (framing by omission, vague attribution). The LLM can generate examples at calibrated difficulty levels based on user history.

---

### Mode C — "The Devil's Advocate" (Steelmanning)

The most intellectually demanding and most engaging for politically aware users. Directly trains actively open-minded thinking (AOT).

**Step 1:** User reads a story they have an opinion on.

**Step 2:** They state their view in a sentence.

**Step 3:** The LLM generates the **strongest possible counter-argument** — not a strawman, a genuine steelman of the opposing position.

**Step 4:** User rates how convincing it was and writes a one-sentence rebuttal.

**Step 5:** The LLM responds with one follow-up challenge.

This mode explicitly fights **confirmation bias** and **myside bias**. It should never feel like the LLM is taking a political side — it's always framed as a thinking exercise, and the steelman response is clearly labeled as such.

---

### Mode D — "The Timeline Check" (Disinformation Forensics)

For stories involving ongoing situations — elections, wars, policy debates, public health crises:

**Step 1:** User selects a claim from a headline.

**Step 2:** The LLM reconstructs a mini-timeline: how has this story evolved? What was the framing at T-1 week, T-1 month?

**Step 3:** Highlights where earlier framing conflicts with current framing from the *same outlet*.

This teaches **narrative drift awareness** — one of the most underrated disinformation vectors. Stories don't always start as disinformation; they drift through selective updates, omitted corrections, and framing shifts over time.

> **Data requirement:** This mode requires storing article history per topic — it has the most complex data model of the five modes and is best built last.

---

### Mode E — "The Missing Story" (Agenda Setting Awareness)

Less about individual articles, more about the feed as a whole:

**Trigger:** Once a week (fits the existing Telegram digest pipeline via n8n).

**What it does:** The LLM analyzes the week's headlines and surfaces: what significant stories were *not* in the top coverage? What got crowded out?

**Output:** A "What's being overlooked" card in the weekly digest, with 2–3 under-covered stories and a brief explanation of *why* they may have received less attention (structural, not conspiratorial).

This teaches **agenda-setting literacy** — the understanding that what media chooses to cover is itself a political and editorial act, entirely separate from whether the individual stories are accurate.

---

## 4. Core Taxonomy: Manipulation Techniques to Teach

This is the knowledge base the LLM uses to analyze articles and that users learn progressively. Each technique should have a short name, a one-line definition, and a real-world example pattern.

### Emotional Manipulation

| Technique | Definition | Signal Phrase Pattern |
|-----------|------------|----------------------|
| **Fear-mongering** | Exaggerates threat or danger to provoke anxiety | "Could this destroy...?" / "The threat no one is talking about" |
| **Outrage bait** | Content designed to provoke sharing via anger, not understanding | Extreme characterizations of the opposing side |
| **False urgency** | Creates artificial time pressure | "Breaking", "You need to know now", "Before it's too late" |

### Identity Appeals

| Technique | Definition | Signal Phrase Pattern |
|-----------|------------|----------------------|
| **Us vs. them framing** | Divides the world into in-group / out-group | "Real [people] know that...", "They want you to believe..." |
| **Tribal signaling** | Coded language that signals group membership | Dog-whistles, culturally specific value-loaded terms |
| **Authenticity appeal** | Appeals to "real" or "true" identity | "What they don't want ordinary people to know" |

### Authority Manipulation

| Technique | Definition | Signal Phrase Pattern |
|-----------|------------|----------------------|
| **False experts** | Credentials inflated or irrelevant to the claim | "Dr. X says..." (where X has no expertise in the relevant field) |
| **Vague attribution** | Claims without traceable sources | "Sources say", "Experts warn", "Many believe" |
| **Expert out of context** | Real expert, real quote, wrong context | Accurate quotes used to imply conclusions the expert didn't draw |

### Logic Failures

| Technique | Definition | Signal Phrase Pattern |
|-----------|------------|----------------------|
| **False dichotomy** | Only two options presented when more exist | "Either we do X or everything falls apart" |
| **Slippery slope** | Chain of consequences without mechanism | "If X happens, then Y, then Z will inevitably follow" |
| **Correlation as causation** | Two correlated things presented as causally linked | "Since X began, Y has risen dramatically" |
| **Cherry-picked statistics** | Selectively cited data that supports one conclusion | "Studies show..." (one study, unrepresentative sample) |

### Narrative Techniques

| Technique | Definition | Signal Phrase Pattern |
|-----------|------------|----------------------|
| **Anecdote as trend** | One story presented as systemic evidence | Personal story opening → systemic conclusion |
| **Asymmetric coverage** | Same type of event framed differently based on who it affects | Compare how "our side" vs "their side" doing the same thing is covered |
| **Framing by omission** | True facts, but missing context changes the meaning | Technically accurate but misleading without context |

### Source Manipulation

| Technique | Definition | Signal Phrase Pattern |
|-----------|------------|----------------------|
| **Headline/body mismatch** | Headline implies something the article doesn't support | Headline is a question the article answers "maybe" |
| **Source laundering** | Secondary/tertiary sourcing obscures origin | "A reported that B said that C claims..." |
| **Decontextualized quotes** | Accurate quote, wrong context | Screenshot culture, pull quotes stripped of surrounding meaning |

---

## 5. The Prompt Engineering Layer

Core prompts the feature uses. These should be treated as living documents — iterate on them as you observe how the LLM performs on real articles.

### Prompt A: Framing Analysis

```
You are a media literacy analyst. Your job is to analyze craft and technique, not to take political positions or assess whether claims are true.

Analyze the following article for:

1. FRAMING: What angle or perspective structures this story? What assumptions are baked in to the way the story is told?
2. LANGUAGE: Identify 2-3 specific word choices that carry implicit political or emotional weight. Quote them directly.
3. OMISSIONS: What relevant context, counterpoint, or stakeholder is notably absent from this piece?
4. TECHNIQUE: If any manipulation technique from this list is present, name it: [insert taxonomy]. If none is clearly present, say "None detected."
5. VERDICT: On a scale from "Straightforward reporting" to "High manipulation load", where does this fall and why? One sentence.

Rules:
- Be specific and quote the text when making claims about language.
- Do not editorialize about the underlying topic — only the craft of the article.
- Do not claim the article is "wrong" — only note what it does and doesn't do.

ARTICLE:
[article text]
```

### Prompt B: Technique Spotting (Quiz Generation)

```
Given this headline and article excerpt, identify which ONE primary manipulation technique is most clearly present from this list:
[insert taxonomy]

Output in this exact format:
TECHNIQUE: [name from taxonomy, or "None"]
EVIDENCE: [direct quote from the article showing the technique in action]
EXPLANATION: [1-2 sentences on how this technique works psychologically — why it's effective]
DIFFICULTY: [Easy / Medium / Hard — based on how subtle the technique is]

If no technique is clearly present, output TECHNIQUE: None and briefly explain what makes this straightforward reporting.

HEADLINE: [headline]
EXCERPT: [article excerpt]
```

### Prompt C: Steelmanning

```
The user has read the following article and holds this position: "[user's stated position]"

Your task: Generate the strongest, most charitable counter-argument to their view. This is a steelman, not a strawman.

The counter-argument must:
- Acknowledge what is genuinely valid or understandable in their position
- Present the best available evidence and logic for the opposing view
- Avoid caricature, exaggeration, or bad faith framing
- Be 3-4 sentences maximum

Do NOT state which side you find more convincing. Do NOT imply the user is wrong to hold their view.
End with exactly ONE open question the user should sit with — a question that doesn't have an easy answer.

ARTICLE CONTEXT: [article text or summary]
USER POSITION: [user's stated position]
```

### Prompt D: Timeline Check

```
You are analyzing how media coverage of a topic has evolved over time.

Given these articles about the same story from different dates, identify:

1. FRAMING SHIFTS: How has the angle, tone, or emphasis changed between the earliest and most recent coverage?
2. CONTRADICTIONS: Are there any claims in earlier coverage that are contradicted or quietly dropped in later coverage?
3. CONTEXT EVOLUTION: What important context existed at time T1 that is absent from T2's coverage (or vice versa)?
4. VERDICT: Is this normal journalistic updating as facts emerge, or does the shift suggest something more concerning (agenda change, political pressure, narrative management)?

Be specific — cite the articles by date when making claims.

ARTICLES (ordered by date):
[article 1: date + text]
[article 2: date + text]
[article N: date + text]
```

### Prompt E: Missing Story (Weekly)

```
You have access to this week's top headlines from a news digest feed:

[headlines list]

Identify 2-3 significant ongoing stories or topics that received notably little coverage this week, relative to their likely real-world significance.

For each under-covered story:
- STORY: What is it? Brief factual description.
- WHY UNDERREPORTED: What structural reason might explain the low coverage? (editorial priorities, complexity, lack of dramatic visuals, political sensitivity, story fatigue, competing news cycles — pick the most plausible, not the most conspiratorial)
- QUESTION TO ASK: What should a well-informed reader be asking about this topic right now?

Rules:
- Be specific. Reference real events and real omissions.
- Avoid conspiracy framing — favor structural, institutional explanations over malicious intent.
- Keep each entry to 3-4 sentences.
```

### Prompt F: User Bias Awareness (Self-Reflection Mode)

```
The user has been consuming news from the following sources this week:
[source list with frequency]

Based on the AllSides / Ad Fontes Media bias ratings (Left / Lean Left / Center / Lean Right / Right), analyze:

1. DIET BALANCE: What is the approximate political distribution of their news sources?
2. BLIND SPOTS: What perspectives or types of stories are they likely under-exposed to based on this diet?
3. SUGGESTION: Name 1-2 specific sources in an underrepresented position that would meaningfully add to their media diet — not as a political recommendation, but as an informational balance exercise.

Frame this as informational, not judgmental. The goal is awareness, not prescription.
```

---

## 6. Engagement Design: What Makes This Sticky

### The "I Would Have Fallen For That" Moment

The most powerful engagement trigger is when a user realizes a technique was used in an article they already trusted. Design the feature to surface this: *"You bookmarked this article last week. Want to run it through Bias Radar?"* That personalization creates genuine stakes.

### Track Judgment Quality, Not Volume

Instead of "you analyzed 5 articles today", track something meaningful:
- "You've caught 3 framing omissions this week"
- "You've steelmanned 2 positions you disagreed with"
- "You've spotted outrage bait 4 times this month"

Quality over quantity. Volume-based streaks train compulsive behavior. Quality-based tracking trains a skill.

### The "Explain It to Someone" Mechanic

After each analysis, ask the user: *"How would you explain this technique to a friend in one sentence?"* Research on learning consistently shows that explaining something to others deepens retention more than any other technique. This also generates a corpus of user-written explanations that could become a community layer later.

### Difficulty Calibration Over Time

Start users with obvious examples (outrage bait, headline/body mismatch) and graduate to subtle ones (framing by omission, vague attribution, secondary source laundering). Track which techniques a user has encountered and weight the queue toward ones they haven't seen.

### Real Stories, Never Invented Examples

This is the most important UX decision. Using real headlines from the existing RSS feed means the examples are timely, locally relevant (Romanian/Hungarian political context is especially rich for this), and feel consequential. Invented examples feel like homework.

### The Weekly "Media Diet Report"

A simple card in the Telegram digest showing:
- Sources read this week
- Rough Left/Center/Right distribution
- One suggested source to balance the diet
- One technique spotted most frequently this week across the feed

No judgment, just data. This kind of reflection prompt is consistently more effective than prescriptive advice.

---

## 7. Handling Political Polarization Specifically

### Don't Position the App as an Arbiter of Truth

AllSides explicitly does not rate accuracy or credibility — only bias — specifically to avoid being seen as a "Ministry of Truth." Bias Radar should follow the same principle: illuminate the craft and technique, don't issue verdicts on whether the underlying facts are true. The LLM's analysis is always framed as "how this article works rhetorically", not "whether this article is correct."

### Show the Same Story From Both Sides Before Analysis

This structural move — presenting Left/Center/Right versions of the same headline — lets users discover the framing divergence themselves, which is more effective than being told about it. The discovery moment is the learning moment.

### Make Filter Bubbles Visible Without Shaming

A lightweight "How diverse is your news diet?" tracker — showing what percentage of bookmarked sources lean Left/Center/Right — should be framed as curiosity-prompting, not prescriptive. People change behavior when they're surprised by data about themselves, not when they're lectured.

### Address the Asymmetry Problem Explicitly

People are much better at spotting manipulation in sources they already distrust. The steelmanning mode (Mode C) directly targets this by forcing engagement with the best version of the opposing view. You can even make this explicit in the UI: *"This is harder to do with sources you already trust — try running your favorite source through Bias Radar."*

### Avoid False Balance

Balance doesn't mean treating all claims as equally valid. A story can be covered from multiple perspectives while still having facts that are verifiable. The feature should distinguish between:
- **Framing disagreements** — legitimate differences in emphasis or angle (balance is appropriate)
- **Factual disputes** — where accuracy matters and "both sides" framing is itself misleading
- **Manufactured controversy** — where apparent "debate" is itself a manipulation technique

---

## 8. Technical Integration Points for the Stack

### RSS / Feed Layer

The existing feed aggregation is perfect for Mode A (same-story comparison). The key requirement is **topic clustering** — grouping articles about the same event from different sources. This is already in scope for The Daily Brief's clustering work. The bias analysis layer slots directly on top of that.

**Source bias labels:** AllSides Media Bias Ratings are available under Creative Commons BY-NC 4.0 for non-commercial research use. Ad Fontes Media has a similar chart with the added dimension of factual reliability (x-axis: reliability, y-axis: bias) which is more nuanced and worth considering.

### n8n Integration

| Mode | n8n Role |
|------|----------|
| Mode E (Missing Story) | Scheduled weekly workflow — the LLM analyzes the week's headlines and pushes a "What's being overlooked" card to Telegram |
| Mode A (Source Comparison) | Triggered per article — when the RSS fetcher detects 3+ articles on the same topic, queue a comparison card |
| Mode F (Weekly Diet Report) | Scheduled weekly — reads user's saved articles, runs bias label lookup, generates the diet report card |

### Frontend

The interactive modes (A–D) work best as an **on-demand feature triggered from the article view**, not as a standalone section. Think: an "Scan this article" button that opens a slide-in panel or modal. Don't make it the default view — make it feel like a power tool that users opt into.

The quiz mechanic (Mode B) can work as a standalone daily touchpoint — "Today's Technique: one headline, guess the manipulation." This gives the feature a habitual entry point that doesn't require reading a full article.

### Model Selection

| Mode | Recommended Model | Reason |
|------|-------------------|--------|
| A — Framing Analysis | Frontier LLM | Nuanced rhetorical analysis requires strong reasoning |
| B — Technique Spotting | Local LLM (structured prompt) | Structured output, well-defined taxonomy, latency matters |
| C — Steelmanning | Frontier LLM | Quality of argument matters enormously here |
| D — Timeline Check | Frontier LLM | Multi-document reasoning |
| E — Missing Story | Frontier LLM | Broad knowledge + reasoning |
| F — Diet Report | Local LLM or scripted | Mostly lookup + formatting, not heavy reasoning |

This fits the existing hybrid planning (frontier) + execution (local) workflow.

---

## 9. What to Build First

Recommended build order by **impact-to-effort ratio:**

### Phase 1 — Core Loop (High Impact, Low Effort)

**1. Framing comparison card** (Mode A, same story from 2–3 sources)
- Uses data already in the pipeline
- No quiz mechanics needed
- Immediately distinctive vs. any existing news app
- Requires: topic clustering + source bias labels

**2. Technique spotting on articles** (Mode B)
- Needs the taxonomy prompt and a simple UI
- Start with 5 techniques, expand progressively
- Requires: article text extraction + structured LLM prompt

### Phase 2 — Depth Layer (High Impact, Medium Effort)

**3. Steelman on demand** (Mode C)
- Single prompt, enormous perceived value for politically engaged users
- Requires: user input field + LLM API call

**4. Weekly missing story digest** (Mode E)
- Maps directly onto the existing n8n/Telegram pipeline
- Requires: weekly n8n workflow + LLM prompt

### Phase 3 — Habit Layer (Medium Impact, Medium Effort)

**5. Daily technique quiz** (Mode B, standalone touchpoint)
- Habitual entry point, doesn't require reading a full article
- Requires: queue management + quiz UI

**6. Weekly media diet report** (Mode F)
- Requires: source tracking + bias label lookup

### Phase 4 — Advanced (High Value, High Complexity)

**7. Timeline check** (Mode D)
- Requires: article history storage per topic, data model work
- Most complex — build after clustering is mature

---

## Appendix A: Reference Projects & Inspiration

| Project | What They Do Well | Lesson for The Daily Brief |
|---------|-------------------|---------------------------|
| **Bad News** (DROG / Cambridge) | Prebunking via roleplay — user becomes the disinformation creator | The most effective format is active, not passive |
| **AllSides** | Side-by-side Left/Center/Right coverage of same story | Structural comparison > editorial labeling |
| **Ad Fontes Media Bias Chart** | Rates both bias AND reliability — 2D framework | Bias and accuracy are orthogonal dimensions worth separating |
| **News Literacy Project (Checkology)** | Classroom-grade news literacy with real examples | Real stories > invented examples, always |
| **Ground News** | Source comparison + bias indicators on articles | Inline, article-level integration beats standalone features |

---

## Appendix B: Key Cognitive Biases to Cover (User-Facing Education)

These are the biases users should become aware of in themselves, not just in articles they read:

| Bias | Definition | In-App Trigger |
|------|------------|----------------|
| **Confirmation bias** | Seeking information that confirms existing beliefs | Steelmanning mode |
| **Myside bias** | Better at finding flaws in opposing arguments than your own | Steelmanning mode |
| **Availability heuristic** | Overweighting information that comes to mind easily | Missing story mode |
| **Framing effect** | Decisions influenced by how information is presented | Framing comparison |
| **Authority bias** | Overweighting claims from apparent authority figures | Vague attribution technique |
| **In-group bias** | Favoring information from perceived in-group sources | Diet report |
| **Affect heuristic** | Emotional state influencing credibility judgment | Gut check step in Mode A |

---

*Document created: 2026-03-28*
*Project: The Daily Brief — news-digest*
*Status: Draft for review*
