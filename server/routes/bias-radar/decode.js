const express = require('express');
const { TECHNIQUE_DETECTION_PROMPT, fillPrompt } = require('../../lib/bias-radar/prompts');
const db = require('../../db');

const router = express.Router();

async function callLLMWithJson(messages, opts = {}) {
  const providers = [
    { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
  ];

  const provider = providers.find(p => p.key());
  if (!provider) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const start = Date.now();
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key()}` },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: opts.temperature || 0.3,
      max_tokens: opts.max_tokens || 8192,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`${provider.name} API returned ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const latency = Date.now() - start;

  if (db) {
    db.prepare('INSERT INTO llm_usage (provider, model, prompt_tokens, completion_tokens, total_tokens, purpose, latency_ms, created_at) VALUES (?,?,?,?,?,?,?,?)').run(
      provider.name, provider.model,
      data.usage?.prompt_tokens || 0,
      data.usage?.completion_tokens || 0,
      data.usage?.total_tokens || 0,
      opts.purpose || 'unknown',
      latency,
      new Date().toISOString()
    );
  }

  console.log(`[BiasRadar] LLM success: ${provider.name} (${latency}ms, ${data.usage?.total_tokens || '?'} tokens)`);
  return { content: data.choices?.[0]?.message?.content || '', provider: `${provider.name} · ${provider.model}`, usage: data.usage };
}

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

    const result = await callLLMWithJson(messages, {
      purpose: 'bias-radar-decode',
      temperature: 0.2,
      max_tokens: 600,
    });

    let raw = result.content;

    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      return res.json(parsed);
    } catch (parseErr) {
      console.error('[BiasRadar] JSON parse error:', parseErr.message, 'Raw:', raw);
      return res.status(500).json({ error: 'Failed to parse LLM response', raw: raw.substring(0, 500) });
    }
  } catch (err) {
    console.error('[BiasRadar] Decode error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;