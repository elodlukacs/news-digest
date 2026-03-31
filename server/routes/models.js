const express = require('express');
const router = express.Router();

const env = (name) => process.env[name];

const EXCLUDED_IDS = [
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'meta-llama/llama-prompt-guard-2-22m',
  'meta-llama/llama-prompt-guard-2-86m',
  'allam-2-7b',
];

router.get('/', async (req, res) => {
  const apiKey = env('GROQ_API_KEY');
  if (!apiKey) {
    return res.json([]);
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Models] Groq API returned ${response.status}`);
      return res.json([]);
    }

    const data = await response.json();
    const models = (data.data || [])
      .filter(m => m.active && m.id && !EXCLUDED_IDS.includes(m.id))
      .map(m => ({
        id: m.id,
        name: m.id.replace(/^openai\//, '').replace(/^meta-llama\//, 'Llama '),
        owned_by: m.owned_by,
        context_window: m.context_window,
        max_completion_tokens: m.max_completion_tokens,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(models);
  } catch (err) {
    console.error('[Models] Failed to fetch Groq models:', err.message);
    res.json([]);
  }
});

module.exports = router;
