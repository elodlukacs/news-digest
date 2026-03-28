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

const STEELMAN_PROMPT = `The user has read the following article and holds this position: "{{USER_POSITION}}"

Your task: Generate the strongest, most charitable counter-argument to their view. This is a steelman, not a strawman.

The counter-argument must:
- Acknowledge what is genuinely valid or understandable in their position
- Present the best available evidence and logic for the opposing view
- Avoid caricature, exaggeration, or bad faith framing
- Be 3-4 sentences maximum

Do NOT state which side you find more convincing. Do NOT imply the user is wrong to hold their view.
End with exactly ONE open question the user should sit with — a question that doesn't have an easy answer.

ARTICLE CONTEXT: {{ARTICLE}}`;

const MISSING_STORY_PROMPT = `You have access to this week's top headlines from a news digest feed:

{{HEADLINES}}

Identify 2-3 significant ongoing stories or topics that received notably little coverage this week, relative to their likely real-world significance.

For each under-covered story:
- STORY: What is it? Brief factual description.
- WHY UNDERREPORTED: What structural reason might explain the low coverage? (editorial priorities, complexity, lack of dramatic visuals, political sensitivity, story fatigue, competing news cycles — pick the most plausible, not the most conspiratorial)
- QUESTION TO ASK: What should a well-informed reader be asking about this topic right now?

Rules:
- Be specific. Reference real events and real omissions.
- Avoid conspiracy framing — favor structural, institutional explanations over malicious intent.
- Keep each entry to 3-4 sentences.`;

const MEDIA_DIET_PROMPT = `The user has been consuming news from the following sources this week:
{{SOURCE_LIST}}

Based on the media bias ratings (Left / Lean Left / Center / Lean Right / Right), analyze:

1. DIET BALANCE: What is the approximate political distribution of their news sources?
2. BLIND SPOTS: What perspectives or types of stories are they likely under-exposed to based on this diet?
3. SUGGESTION: Name 1-2 specific sources in an underrepresented position that would meaningfully add to their media diet — not as a political recommendation, but as an informational balance exercise.

Frame this as informational, not judgmental. The goal is awareness, not prescription.`;

const TIMELINE_CHECK_PROMPT = `You are analyzing how media coverage of a topic has evolved over time.

Given these articles about the same story from different dates, identify:

1. FRAMING SHIFTS: How has the angle, tone, or emphasis changed between the earliest and most recent coverage?
2. CONTRADICTIONS: Are there any claims in earlier coverage that are contradicted or quietly dropped in later coverage?
3. CONTEXT EVOLUTION: What important context existed at time T1 that is absent from T2's coverage (or vice versa)?
4. VERDICT: Is this normal journalistic updating as facts emerge, or does the shift suggest something more concerning (agenda change, political pressure, narrative management)?

Be specific — cite the articles by date when making claims.

ARTICLES (ordered by date):
{{ARTICLES}}`;

function fillPrompt(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

module.exports = {
  TECHNIQUE_DETECTION_PROMPT,
  FRAMING_ANALYSIS_PROMPT,
  STEELMAN_PROMPT,
  MISSING_STORY_PROMPT,
  MEDIA_DIET_PROMPT,
  TIMELINE_CHECK_PROMPT,
  fillPrompt,
};