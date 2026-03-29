const express = require('express');
const db = require('../../db');
const { callLLM } = require('../../lib/llm');
const { STEELMAN_PROMPT, fillPrompt } = require('../../lib/bias-radar/prompts');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userPosition, articleContext, language } = req.body;
    // language: forwarded for future localized prompts (V2)

    if (!userPosition?.trim() || !articleContext?.trim()) {
      return res.status(400).json({ error: 'userPosition and articleContext required' });
    }

    const prompt = fillPrompt(STEELMAN_PROMPT, {
      USER_POSITION: userPosition.trim(),
      ARTICLE: articleContext.slice(0, 1500),
    });

    const messages = [{ role: 'user', content: prompt }];
    const result = await callLLM(messages, { purpose: 'bias-radar-steelman', temperature: 0.4, db });

    const raw = result.content;

    const counterMatch = raw.match(/Counter-argument:\s*([\s\S]+?)(?=\n\nQuestion:|$)/i);
    const questionMatch = raw.match(/Question:\s*([\s\S]+?)$/i);

    const counterArgument = counterMatch?.[1]?.trim() ?? raw.trim();
    const followUpQuestion = questionMatch?.[1]?.trim() ?? '';

    return res.json({ counterArgument, followUpQuestion });
  } catch (err) {
    console.error('[Steelman] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
