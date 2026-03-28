const express = require('express');
const { TECHNIQUE_DETECTION_PROMPT, fillPrompt } = require('../../lib/bias-radar/prompts');
const { callLLM } = require('../../lib/llm');
const db = require('../../db');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { headline, content } = req.body;

    if (!headline || !content) {
      return res.status(400).json({ error: 'Missing headline or content' });
    }

    const cappedContent = content.slice(0, 4000);
    const prompt = fillPrompt(TECHNIQUE_DETECTION_PROMPT, {
      HEADLINE: headline,
      CONTENT: cappedContent,
    });

    const messages = [{ role: 'user', content: prompt }];

    const result = await callLLM(messages, {
      purpose: 'bias-radar-decode',
      temperature: 0.2,
      db,
    });

    let raw = result.content;

    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      return res.json(parsed);
    } catch (parseErr) {
      console.error('[BiasRadar] JSON parse error:', parseErr.message, 'Raw:', raw);
      return res.status(500).json({ error: 'Failed to parse LLM response' });
    }
  } catch (err) {
    console.error('[BiasRadar] Decode error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
