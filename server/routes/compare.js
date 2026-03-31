const express = require('express');
const { callLLM } = require('../lib/llm');
const db = require('../db');
const { getPrompt } = require('../lib/promptManager');

const router = express.Router();

// POST /api/compare/coverage — compare coverage across outlets
router.post('/coverage', async (req, res) => {
  const { url, topic, provider } = req.body;

  if (!url && !topic) {
    return res.status(400).json({ error: 'URL or topic required' });
  }

  const input = url || topic;
  const inputType = url ? 'URL' : 'topic';

  try {
    const comparePrompt = getPrompt('compare-coverage');

    const result = await callLLM(
      [
        { role: 'system', content: comparePrompt.user_prompt },
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
