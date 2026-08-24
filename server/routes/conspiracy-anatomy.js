const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt, renderPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

// POST /api/conspiracy-anatomy/analyze
router.post('/analyze', async (req, res) => {
  const { claim, provider } = req.body || {};
  if (!claim || claim.trim().length < 10) {
    return res.status(400).json({ error: 'Claim must be at least 10 characters' });
  }

  try {
    const prompt = getPrompt('conspiracy-anatomy');
    const rendered = renderPrompt(prompt.user_prompt, { claim: claim.trim() });

    const result = await callLLM(
      [
        { role: 'system', content: prompt.system_message || '' },
        { role: 'user', content: rendered },
      ],
      { purpose: 'conspiracy_anatomy', temperature: 0.6, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    const parsed = parseJSON(result.content, {});

    res.json({
      claim: claim.trim(),
      dimensions: (parsed.dimensions || []).map((d) => ({
        name: d.name || '',
        analysis: d.analysis || '',
        score: Math.min(10, Math.max(1, d.score || 5)),
      })),
      overallVulnerability: Math.min(10, Math.max(1, parsed.overallVulnerability || 5)),
      antibody: parsed.antibody || '',
      relatedConspiracies: parsed.relatedConspiracies || [],
      provider: result.provider,
    });
  } catch (err) {
    console.error('Conspiracy anatomy error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

module.exports = router;
