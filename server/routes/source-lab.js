const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt, renderPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

// POST /api/source-lab/analyze
router.post('/analyze', async (req, res) => {
  const { input, context = '', provider } = req.body || {};
  if (!input || input.trim().length < 5) {
    return res.status(400).json({ error: 'URL or claim must be at least 5 characters' });
  }

  try {
    const prompt = getPrompt('source-lab-sift');
    const rendered = renderPrompt(prompt.user_prompt, {
      input: input.trim(),
      context: context.trim() || 'No additional context provided',
    });

    const result = await callLLM(
      [
        { role: 'system', content: prompt.system_message || '' },
        { role: 'user', content: rendered },
      ],
      { purpose: 'source_lab', temperature: 0.5, response_format: { type: 'json_object' }, providerId: provider || null, db }
    );

    const parsed = parseJSON(result.content, {});

    res.json({
      input: input.trim(),
      stop: parsed.stop || { initialReaction: '', gutCheck: '', pauseAdvice: '' },
      investigate: {
        sourceName: parsed.investigate?.sourceName || '',
        credibility: Math.min(10, Math.max(1, parsed.investigate?.credibility || 5)),
        bias: parsed.investigate?.bias || '',
        expertise: parsed.investigate?.expertise || '',
        agenda: parsed.investigate?.agenda || '',
      },
      findCoverage: {
        outletsFound: (parsed.findCoverage?.outletsFound || []).map(o => ({
          name: o.name || '',
          stance: o.stance || 'neutral',
          excerpt: o.excerpt || '',
        })),
      },
      traceClaims: {
        originalSource: parsed.traceClaims?.originalSource || '',
        evidenceQuality: parsed.traceClaims?.evidenceQuality || '',
        chainIntact: parsed.traceClaims?.chainIntact ?? null,
      },
      overallCredibility: Math.min(10, Math.max(1, parsed.overallCredibility || 5)),
      verdict: parsed.verdict || '',
      siftTips: parsed.siftTips || [],
      provider: result.provider,
    });
  } catch (err) {
    console.error('Source lab error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

module.exports = router;
