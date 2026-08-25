const express = require('express');
const router = express.Router();

const env = (name) => process.env[name];

// llama-3.3-70b-versatile and llama-3.1-8b-instant were deprecated by Groq on
// 2026-06-17 and now 404. Groq's recommended replacements are gpt-oss-120b and
// qwen3.6-27b (the latter is the only Groq model with a thinking mode).
const ALLOWED_IDS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
];

// DeepSeek publishes no usable /models listing for routing purposes, and the
// catalogue is small and stable, so it is declared here. Kept in sync with the
// `deepseek` entry in lib/llm.js.
const DEEPSEEK_MODELS = [
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    owned_by: 'DeepSeek',
    context_window: 1000000,
    max_completion_tokens: 8192,
    provider: 'DeepSeek',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    owned_by: 'DeepSeek',
    context_window: 1000000,
    max_completion_tokens: 8192,
    provider: 'DeepSeek',
  },
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

async function fetchOpenRouterModels() {
  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) return [];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models?sort=popular', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      console.warn(`[Models] OpenRouter API returned ${response.status}`);
      return [];
    }
    const data = await response.json();
    const freeIds = new Set();
    for (const m of data.data || []) {
      if (parseFloat(m.pricing?.prompt || 1) === 0) freeIds.add(m.id);
    }
    const SUMMARIZATION_MODELS = [
      'qwen/qwen3.5-flash-02-23',
      'qwen/qwen3.5-27b',
      'qwen/qwen3.5-35b-a3b',
      'qwen/qwen3.6-plus',
      'qwen/qwen3-max-thinking',
      'deepseek/deepseek-v3.2',
      'minimax/minimax-m2.7',
      'moonshotai/kimi-k2.5',
      'google/gemini-3.1-pro-preview',
    ];
    const paid = (data.data || [])
      .filter(m => SUMMARIZATION_MODELS.includes(m.id))
      .slice(0, 10)
      .map(m => ({
        id: m.id,
        name: (m.name || m.id).replace(/^[^\s]+:\s*/, ''),
        owned_by: m.owned_by || m.id.split('/')[0],
        context_window: m.context_length,
        max_completion_tokens: m.top_provider?.max_tokens || 8192,
        provider: 'OpenRouter',
      }));
    return paid;
  } catch (err) {
    console.error('[Models] Failed to fetch OpenRouter models:', err.message);
    return [];
  }
}

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
        name: m.id.replace(/^openai\//, '').replace(/^meta-llama\//, 'Llama ').replace(/^qwen\//, ''),
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
  // Both network calls are independent; they used to run in series.
  const [groqModels, openrouterModels] = await Promise.all([
    fetchGroqModels(),
    fetchOpenRouterModels(),
  ]);
  const deepseekModels = env('DEEPSEEK_API_KEY') ? DEEPSEEK_MODELS : [];
  const googleModels = env('GOOGLE_API_KEY') ? GOOGLE_MODELS : [];
  res.json([...deepseekModels, ...groqModels, ...googleModels, ...openrouterModels]);
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
