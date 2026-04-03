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

const EXCLUDED_OR_IDS = [
  'openrouter/free',
  'google/lyria-3-pro-preview',
  'google/lyria-3-clip-preview',
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

async function fetchOpenRouterModels() {
  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) return [];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      console.warn(`[Models] OpenRouter API returned ${response.status}`);
      return [];
    }
    const data = await response.json();
    const freeModels = (data.data || [])
      .filter(m => {
        if (!m.id || EXCLUDED_OR_IDS.includes(m.id)) return false;
        const pricing = m.pricing || {};
        return pricing.prompt === '0' && pricing.completion === '0';
      })
      .filter(m => {
        const arch = m.architecture || {};
        const modalities = arch.modality || '';
        return modalities.includes('text');
      })
      .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      .slice(0, 10)
      .map(m => ({
        id: m.id,
        name: (m.name || m.id).replace(/ \(free\)$/i, '').trim(),
        owned_by: m.id.split('/')[0].charAt(0).toUpperCase() + m.id.split('/')[0].slice(1),
        context_window: m.context_length,
        max_completion_tokens: (m.top_provider || {}).max_completion_tokens || m.context_length,
        provider: 'OpenRouter',
      }));
    return freeModels;
  } catch (err) {
    console.error('[Models] Failed to fetch OpenRouter models:', err.message);
    return [];
  }
}

router.get('/', async (req, res) => {
  const [groqModels, openRouterModels] = await Promise.all([
    fetchGroqModels(),
    fetchOpenRouterModels(),
  ]);
  res.json([...groqModels, ...openRouterModels]);
});

module.exports = router;
