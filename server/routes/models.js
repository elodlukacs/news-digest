const express = require('express');
const router = express.Router();

const env = (name) => process.env[name];

const ALLOWED_IDS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

const GOOGLE_MODELS = [
  {
    id: 'gemma-4-31b-it',
    name: 'Gemma 4 31B',
    owned_by: 'Google',
    context_window: 262144,
    max_completion_tokens: 32768,
    provider: 'Google AI Studio',
  },
];

async function fetchGroqModels() {
  const apiKey = env('GROQ_API_KEY');
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      console.warn(`[Models] Groq API returned ${response.status}`);
      return [];
    }
    const data = await response.json();
    return (data.data || [])
      .filter(m => m.active && m.id && ALLOWED_IDS.includes(m.id))
      .map(m => ({
        id: m.id,
        name: m.id.replace(/^openai\//, '').replace(/^meta-llama\//, 'Llama '),
        owned_by: m.owned_by || 'Groq',
        context_window: m.context_window,
        max_completion_tokens: m.max_completion_tokens,
        provider: 'Groq',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('[Models] Failed to fetch Groq models:', err.message);
    return [];
  }
}

router.get('/', async (req, res) => {
  const groqModels = await fetchGroqModels();
  const googleModels = env('GOOGLE_API_KEY') ? GOOGLE_MODELS : [];
  res.json([...groqModels, ...googleModels]);
});

module.exports = router;
