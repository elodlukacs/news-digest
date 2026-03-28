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

function fillPrompt(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

module.exports = {
  TECHNIQUE_DETECTION_PROMPT,
  fillPrompt,
};