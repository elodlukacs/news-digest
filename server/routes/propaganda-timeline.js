const express = require('express');
const { callLLM } = require('../lib/llm');
const { getPrompt, renderPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

// GET /api/propaganda-timeline/eras
router.get('/eras', (_req, res) => {
  res.json([
    { id: 'ww1-ww2', label: 'WWI–WWII', years: '1914–1945' },
    { id: 'cold-war', label: 'Cold War', years: '1947–1991' },
    { id: 'post-cold-war', label: 'Post–Cold War', years: '1991–2010' },
    { id: 'social-media', label: 'Social Media Era', years: '2010–present' },
  ]);
});

// POST /api/propaganda-timeline/generate
router.post('/generate', async (req, res) => {
  const { count = 8, provider } = req.body;

  try {
    const prompt = getPrompt('propaganda-timeline');
    const rendered = renderPrompt(prompt.user_prompt, { count: String(count) });

    const result = await callLLM(
      [
        { role: 'system', content: prompt.system_message || '' },
        { role: 'user', content: rendered },
      ],
      { purpose: 'propaganda_timeline', temperature: 0.6, response_format: { type: 'json_object' }, providerId: provider || null, db: require('../db') }
    );

    const parsed = parseJSON(result.content, {});

    res.json({
      campaigns: (parsed.campaigns || []).map((c) => ({
        year: c.year || 0,
        name: c.name || '',
        description: c.description || '',
        tactic: c.tactic || '',
        target: c.target || '',
        outcome: c.outcome || '',
        modernParallel: c.modernParallel || '',
        modernTactic: c.modernTactic || '',
      })),
      provider: result.provider,
    });
  } catch (err) {
    console.error('Propaganda timeline error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate timeline' });
  }
});

module.exports = router;
