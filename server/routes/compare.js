const express = require('express');
const { callLLM } = require('../lib/llm');
const db = require('../db');

const router = express.Router();

const COMPARE_COVERAGE_PROMPT = `You are a media bias analyst specializing in comparative framing analysis across political spectrum outlets.

Compare how different news outlets cover the same story. You will receive either a URL or a topic/headline to analyze.

Rules:
1. Identify key narrative framings used by outlets across the political spectrum (Far Left | Left | Center-Left | Center | Center-Right | Right | Far Right)
2. Extract common facts shared across all coverage
3. Highlight what each outlet emphasizes or omits
4. Rate the political bias of each outlet's coverage
5. Generate a "framing comparison" summary explaining how narratives diverge
6. Calculate a "Narrative Divergence" score (0-100) indicating how differently outlets framed the story

Return JSON:
{
  "topic": "string (the story/topic being covered)",
  "outlets": [
    {
      "name": "string (e.g., MSNBC, CNN, Fox News, Breitbart, The Intercept, Reason)",
      "bias": "Far Left | Left | Center-Left | Center | Center-Right | Right | Far Right",
      "headline": "string (how they framed the headline)",
      "keyQuotes": ["string (1-3 notable quotes)"],
      "framing": "string (the main narrative frame they used)",
      "emphasized": ["string (what they focused on)"],
      "omitted": ["string (what they left out)"],
      "tone": "string (factual, inflammatory, neutral, opinionated, etc.)"
    }
  ],
  "commonFacts": ["string (facts reported consistently across outlets)"],
  "framingDifferences": "string (explanation of how framing varied)",
  "narrativeDivergenceScore": number (0-100),
  "summary": "string (overall analysis)"
}`;

// POST /api/compare/coverage — compare coverage across outlets
router.post('/coverage', async (req, res) => {
  const { url, topic, provider } = req.body;

  if (!url && !topic) {
    return res.status(400).json({ error: 'URL or topic required' });
  }

  const input = url || topic;
  const inputType = url ? 'URL' : 'topic';

  try {
    const result = await callLLM(
      [
        { role: 'system', content: COMPARE_COVERAGE_PROMPT },
        { role: 'user', content: `Analyze coverage of this ${inputType}: ${input}` }
      ],
      { purpose: 'compare_coverage', temperature: 0.3, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const withCommas = cleaned.replace(/,\s*([\]}])/g, '$1');
      try {
        parsed = JSON.parse(withCommas);
      } catch {
        parsed = {
          topic: input,
          outlets: [],
          commonFacts: [],
          framingDifferences: 'Unable to parse analysis',
          narrativeDivergenceScore: 50,
          summary: 'Coverage analysis could not be completed due to parsing error.'
        };
      }
    }

    if (!parsed.outlets || !Array.isArray(parsed.outlets)) {
      parsed.outlets = [];
    }

    res.json({ ...parsed, provider: result.provider });
  } catch (err) {
    console.error('Compare coverage error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

module.exports = router;
