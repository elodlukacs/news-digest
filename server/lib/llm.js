const AI_PROVIDERS = [
  { id: 'llama', name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY, model: 'openai/gpt-oss-20b' },
  { id: 'minimax', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: () => process.env.OPENROUTER_API_KEY, model: 'minimax/minimax-m2.7' },
];

const providerQuotas = {};

async function callLLM(messages, { purpose = 'unknown', categoryId = null, temperature = 0.3, providerId = null, db } = {}) {
  let providers = AI_PROVIDERS.filter(p => p.key());
  if (providers.length === 0) throw new Error('No AI API keys configured. Set GROQ_API_KEY in .env');

  if (providerId) {
    const target = providers.find(p => p.id === providerId);
    if (target) {
      const rest = providers.filter(p => p.id !== providerId);
      providers = [target, ...rest];
    }
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      const start = Date.now();
      console.log(`[LLM] Trying ${provider.name} (${provider.model}) for ${purpose}...`);

      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key()}` },
        body: JSON.stringify({ model: provider.model, messages, temperature, max_tokens: 8192 }),
      });

      const parseHeader = (name) => {
        const v = response.headers.get(name);
        return v !== null && v !== undefined ? parseInt(v, 10) : null;
      };
      const rlHeaders = {};
      response.headers.forEach((value, key) => {
        if (key.toLowerCase().includes('ratelimit') || key.toLowerCase().includes('rate-limit')) {
          rlHeaders[key] = value;
        }
      });
      if (Object.keys(rlHeaders).length > 0) {
        console.log(`[LLM] ${provider.name} rate-limit headers:`, rlHeaders);
      }
      const quota = {
        provider: provider.name,
        model: provider.model,
        limit_tokens: parseHeader('x-ratelimit-limit-tokens'),
        remaining_tokens: parseHeader('x-ratelimit-remaining-tokens'),
        limit_requests: parseHeader('x-ratelimit-limit-requests'),
        remaining_requests: parseHeader('x-ratelimit-remaining-requests'),
        reset_tokens: response.headers.get('x-ratelimit-reset-tokens') || null,
        reset_requests: response.headers.get('x-ratelimit-reset-requests') || null,
        updated_at: new Date().toISOString(),
      };
      if (quota.limit_tokens !== null || quota.limit_requests !== null ||
          quota.remaining_tokens !== null || quota.remaining_requests !== null) {
        providerQuotas[provider.name] = quota;
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`[LLM] ${provider.name} failed (${response.status})`);
        lastError = `${provider.name} API returned ${response.status}: ${errBody}`;
        continue;
      }
      const data = await response.json();
      const latency = Date.now() - start;
      const usage = data.usage || {};

      if (db) {
        db.prepare('INSERT INTO llm_usage (provider, model, prompt_tokens, completion_tokens, total_tokens, purpose, category_id, latency_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
          provider.name, provider.model, usage.prompt_tokens || 0, usage.completion_tokens || 0, usage.total_tokens || 0,
          purpose, categoryId, latency, new Date().toISOString()
        );
      }

      console.log(`[LLM] Success: ${provider.name} (${latency}ms, ${usage.total_tokens || '?'} tokens)`);
      return { content: data.choices?.[0]?.message?.content || '', provider: `${provider.name} · ${provider.model}`, usage };
    } catch (err) {
      console.warn(`[LLM] ${provider.name} error:`, err.message);
      lastError = `${provider.name}: ${err.message}`;
    }
  }
  throw new Error(lastError || 'All AI providers failed');
}

module.exports = { AI_PROVIDERS, providerQuotas, callLLM };
