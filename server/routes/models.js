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
      .filter(m => m.active && m.id && !EXCLUDED_IDS.includes(m.id))
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

async function fetchGoogleModels() {
  const apiKey = env('GOOGLE_API_KEY');
  if (!apiKey) return [];

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/models', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      console.warn(`[Models] Google AI Studio API returned ${response.status}`);
      return [];
    }
    const data = await response.json();
    return (data.data || [])
      .filter(m => m.id && (m.id.startsWith('gemini-') || m.id.startsWith('models/gemini-')))
      .map(m => {
        const id = m.id.replace(/^models\//, '');
        return {
          id,
          name: id.replace(/^gemini-/, 'Gemini ').replace(/-/g, ' '),
          owned_by: 'Google',
          context_window: m.context_window || 1000000,
          max_completion_tokens: m.max_completion_tokens || 8192,
          provider: 'Google AI Studio',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('[Models] Failed to fetch Google AI Studio models:', err.message);
    return [];
  }
}

router.get('/', async (req, res) => {
  const [groqModels, googleModels] = await Promise.all([
    fetchGroqModels(),
    fetchGoogleModels(),
  ]);
  res.json([...groqModels, ...googleModels]);
});

module.exports = router;
