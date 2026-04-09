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

const OPENROUTER_MODELS = [
  {
    id: 'qwen/qwen3.5-flash-02-23',
    name: 'Qwen3.5 Flash 02-23',
    owned_by: 'Qwen',
    context_window: 1048576,
    max_completion_tokens: 8192,
    provider: 'OpenRouter',
  },
  {
    id: 'qwen/qwen3.5-27b',
    name: 'Qwen3.5 27B',
    owned_by: 'Qwen',
    context_window: 262144,
    max_completion_tokens: 8192,
    provider: 'OpenRouter',
  },
  {
    id: 'qwen/qwen3.5-35b-a3b',
    name: 'Qwen3.5 35B A3B',
    owned_by: 'Qwen',
    context_window: 262144,
    max_completion_tokens: 8192,
    provider: 'OpenRouter',
  },
  {
    id: 'qwen/qwen3-max-thinking',
    name: 'Qwen3 Max Thinking',
    owned_by: 'Qwen',
    context_window: 262144,
    max_completion_tokens: 16384,
    provider: 'OpenRouter',
  },
  {
    id: 'minimax/minimax-m2.7',
    name: 'MiniMax M2.7',
    owned_by: 'MiniMax',
    context_window: 204800,
    max_completion_tokens: 8192,
    provider: 'OpenRouter',
  },
  {
    id: 'moonshotai/kimi-k2.5',
    name: 'Kimi K2.5',
    owned_by: 'Moonshot',
    context_window: 262144,
    max_completion_tokens: 8192,
    provider: 'OpenRouter',
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
  const openrouterModels = env('OPENROUTER_API_KEY') ? OPENROUTER_MODELS : [];
  res.json([...groqModels, ...googleModels, ...openrouterModels]);
});

router.get('/free', async (req, res) => {
  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) return res.json([]);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models?sort=popular', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      console.warn(`[Models] OpenRouter API returned ${response.status}`);
      return res.json([]);
    }
    const data = await response.json();
    const free = (data.data || [])
      .filter(m => {
        const p = m.pricing || {};
        return parseFloat(p.prompt || 1) === 0 && (m.context_length || 0) >= 32000;
      })
      .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      .slice(0, 10)
      .map(m => ({
        id: m.id,
        name: ((m.name || m.id.replace(/^[^\/]+\//, '')).replace(/:free$/, '').replace(/^[^\s]+\s/, '').replace('(free)', '').replace('(Free)', '').replace(/\s+/g, ' ').trim() + ' (' + (m.owned_by || m.id.split('/')[0]) + ')'),
        owned_by: m.owned_by || 'Unknown',
        context_window: m.context_length,
        max_completion_tokens: m.top_provider?.max_tokens || 8192,
        provider: 'Free',
      }));
    res.json(free);
  } catch (err) {
    console.error('[Models] Failed to fetch free models:', err.message);
    res.json([]);
  }
});

module.exports = router;
