const TECHNIQUE_DETECTION_PROMPT = `You are a media literacy analyst. Analyze the article below and identify the single most prominent manipulation technique present.

Choose from this exact list:
- fear-mongering
- outrage-bait
- false-urgency
- us-vs-them
- tribal-signaling
- vague-attribution
- false-dichotomy
- anecdote-as-trend
- framing-by-omission
- headline-body-mismatch
- source-laundering
- none

Respond ONLY with a valid JSON object. No preamble, no markdown fences, no commentary.

{
  "technique": "<one of the technique names above>",
  "displayName": "<human-readable label, e.g. 'Framing by Omission'>",
  "evidence": "<direct quote from the article, max 40 words, showing the technique>",
  "explanation": "<1-2 sentences: what this technique is and why it works psychologically>",
  "difficulty": "<easy|medium|hard>",
  "confidence": "<high|medium|low>"
}

If no technique is clearly present, set technique to "none" and explain in the explanation field why this appears to be straightforward reporting.

HEADLINE: {{HEADLINE}}

ARTICLE:
{{CONTENT}}`;

const FRAMING_ANALYSIS_PROMPT = `You are a media literacy analyst. Your job is to analyze craft and technique, not to take political positions or assess whether claims are true.

Analyze the following article for:

1. FRAMING: What angle or perspective structures this story? What assumptions are baked in to the way the story is told?
2. LANGUAGE: Identify 2-3 specific word choices that carry implicit political or emotional weight. Quote them directly.
3. OMISSIONS: What relevant context, counterpoint, or stakeholder is notably absent from this piece?
4. TECHNIQUE: If any manipulation technique from this list is present, name it: [fear-mongering, outrage-bait, false-urgency, us-vs-them, tribal-signaling, vague-attribution, false-dichotomy, anecdote-as-trend, framing-by-omission, headline-body-mismatch, source-laundering]. If none is clearly present, say "None detected."
5. VERDICT: On a scale from "Straightforward reporting" to "High manipulation load", where does this fall and why? One sentence.

Rules:
- Be specific and quote the text when making claims about language.
- Do not editorialize about the underlying topic — only the craft of the article.
- Do not claim the article is "wrong" — only note what it does and doesn't do.

ARTICLE:
{{ARTICLE}}`;

function fillPrompt(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

const TIMELINE_CHECK_PROMPT = `You are analyzing how coverage of a specific story has evolved over time from the same news outlet.

STORY TOPIC: {{STORY_TOPIC}}

PREVIOUS ARTICLES (chronological, oldest first):
{{PREVIOUS_ARTICLES}}

CURRENT ARTICLE:
{{CURRENT_ARTICLE}}

Identify how the story's framing has shifted. Respond ONLY with a valid JSON object.

{
  "framingShift": "<How has the angle, tone, or central narrative changed from earliest to most recent coverage? 2-3 sentences.>",
  "claimEvolution": "<Have specific claims been revised, dropped, or quietly updated? Quote both the original and revised version if found. If none: 'No significant claim changes detected.'>",
  "inconsistency": "<Does the current framing conflict with how the outlet covered similar events previously? Be specific. If none: 'No inconsistency detected.'>",
  "significance": "<In 1-2 sentences: why does this shift matter for how readers should interpret the current story?>"
}

Rules:
- Quote the articles directly when referencing specific language.
- Distinguish between legitimate updates-as-facts-emerge vs. unexplained framing shifts.
- If the coverage is consistent and the story simply developed naturally, say so clearly.
- Do NOT speculate about editorial intent — describe what changed, not why.`;

module.exports = {
  TECHNIQUE_DETECTION_PROMPT,
  FRAMING_ANALYSIS_PROMPT,
  TIMELINE_CHECK_PROMPT,
  fillPrompt,
};