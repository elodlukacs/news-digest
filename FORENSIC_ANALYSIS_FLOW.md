# Forensic Analysis — "Take Apart A Specific Article"

## What It Does

This feature takes an article (or any text) and runs it through two independent analytical frameworks simultaneously, returning a single structured JSON response. The goal is educational and non-judgmental — it makes invisible manipulation visible, never labels content as "fake" or the reader as gullible.

---

## How Text Gets In

The feature accepts text from three entry points:

1. **From the article feed (Bias Radar):** User clicks "Decode" on a specific article in the summary view. The article's full content text is passed directly — no headline, no metadata, just the raw content.

2. **From the article picker:** User opens the Forensic Panel, picks an article from a dropdown of articles in the current category, and hits "Analyze." The selected article's full content text is sent.

3. **From custom paste:** User clicks "Paste custom text to analyze," types or pastes anything into a text box (minimum 20 characters, max 5000 characters), and hits "Analyze."

In all three cases, the exact same thing is sent to the backend: **raw text only**.

---

## What Gets Sent to the Backend

**Endpoint:** `POST /api/forensics`

**Request body:**
```json
{
  "text": "The full article or custom text, trimmed to max 5000 characters"
}
```

That's it. No metadata, no category, no headline, no user preferences. Just the text.

---

## How the Prompt Works

The prompt slug is `forensic-analysis`. It lives in the database `prompts` table.

- **system_message field:** Empty (not used)
- **user_prompt field:** Contains the entire prompt (see below)

The backend takes the user_prompt template and replaces `{{text}}` with the actual article text. The resulting string becomes the LLM's user message. There is no system message injected.

### Current Prompt Structure (user_prompt)

The prompt tells the LLM it is a "senior forensic sub-editor" trained in two frameworks:

**Framework 1 — Logical Fallacies (David Robert Grimes):**
Looks at the *text's reasoning* for these specific fallacies:
- Ad Hominem, False Dichotomy, Appeal to Nature, Post Hoc, Appeal to Emotion, Straw Man, Bandwagon, Slippery Slope, Appeal to Authority, Red Herring

For each fallacy found, it asks for: name, exact text evidence, and an explanation.

**Framework 2 — Funnel of Misbelief (Dan Ariely):**
Looks at which *reader cognitive vulnerability* the text exploits. Returns ONE stage:
- "Stress exploitation" — amplifies fear/anxiety to lower critical thinking
- "Confirmation Bias" — reinforces existing beliefs
- "Pattern Seeking" — encourages finding hidden meanings where none exist
- "Social Exclusion" — creates us-vs-them framing

Also scores:
- `emotional_intensity`: 0-10 (emotional charge of the language)
- `bias_score`: 0-10 (overall cognitive bias in the text)

---

## What the LLM Should Return

The prompt asks for this JSON structure:

```json
{
  "fallacies": [
    {
      "name": "Name of the fallacy",
      "evidence": "Exact quote from the text that demonstrates it",
      "explanation": "Why this is that fallacy"
    }
  ],
  "funnel_stage": "One of: Stress exploitation, Confirmation Bias, Pattern Seeking, Social Exclusion",
  "emotional_intensity": 7,
  "bias_score": 6,
  "summary": "A short executive summary of the analysis"
}
```

---

## What the Frontend Actually Expects

The frontend TypeScript types are stricter than what the prompt asks for. Here is the exact shape the React component uses:

```typescript
interface ForensicFallacy {
  name: string;            // e.g. "Appeal to Emotion"
  evidence: string;        // Exact quote from the text
  rationality_gap: string; // Why this is a reasoning error
}

interface MisbeliefFunnel {
  primary_stage: string;            // The funnel stage name
  psychological_hook: string;       // How it hooks the reader psychologically
  entry_point_explanation: string;  // Why this entry point works
}

interface ForensicResult {
  fallacies: ForensicFallacy[];
  misbelief_funnel: MisbeliefFunnel;
  emotional_intensity: number;  // 0-10
  bias_score: number;           // 0-10
  executive_summary: string;
}
```

### The Mismatch Problem

The prompt asks the LLM to return `fallacies[].explanation` but the frontend reads `fallacies[].rationality_gap`.

The prompt asks for `funnel_stage` (a flat string) but the frontend expects `misbelief_funnel` (an object with `primary_stage`, `psychological_hook`, and `entry_point_explanation`).

The prompt asks for `summary` but the frontend reads `executive_summary`.

The backend route handles these mismatches with fallback parsing (e.g., `parsed.misbelief_funnel?.primary_stage || parsed.funnel_stage`) so it works, but it's fragile.

---

## What the Backend Sends Back to the Frontend

After calling the LLM and parsing the JSON, the backend responds with:

```json
{
  "fallacies": [
    { "name": "...", "evidence": "...", "rationality_gap": "..." }
  ],
  "misbelief_funnel": {
    "primary_stage": "...",
    "psychological_hook": "...",
    "entry_point_explanation": "..."
  },
  "emotional_intensity": 7,
  "bias_score": 6,
  "executive_summary": "...",
  "provider": "groq or openrouter"
}
```

---

## How the Frontend Renders the Response

1. **Emotional Charge bar:** A colored progress bar. Green (0-4), amber (5-7), red (8-10). Shows the `emotional_intensity` number.

2. **Reader Manipulation section (Misbelief Funnel):**
   - Shows the `primary_stage` as a badge
   - Shows `psychological_hook` as text with a left border accent
   - Shows `entry_point_explanation` as text with a left border accent

3. **Logical Fallacies section:**
   - Each fallacy gets a card with:
     - `name` (bold, with optional tooltip from a hardcoded definitions dictionary)
     - `evidence` (italic, in quotes)
     - `rationality_gap` (regular text)

4. **Executive Summary:** Plain text paragraph at the bottom.

---

## Key Constraints for Prompt Improvement

- **Temperature is 0.2** — low creativity, high consistency
- **response_format is `json_object`** — the LLM is forced to output valid JSON
- **Max input: 5000 characters** — longer texts are truncated
- **No system message** — everything lives in user_prompt (but a system_message field exists in the DB and is supported by the pipeline, it's just empty)
- **The LLM can return either `summary` or `executive_summary`** — backend handles both
- **The LLM can return `funnel_stage` (string) or `misbelief_funnel` (object)** — backend handles both
- **Fallacies can have `explanation` or `rationality_gap`** — but the frontend only displays `rationality_gap`
- **If the LLM returns `scores.emotional_intensity` or `scores.bias_score` (nested), the backend extracts those too** — it checks both flat and nested structures
