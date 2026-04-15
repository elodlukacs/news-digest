const env = (name) => process.env[name];

const AI_PROVIDERS = [
  { id: 'llama', name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: () => env('GROQ_API_KEY'), model: 'openai/gpt-oss-20b' },
  { id: 'llama8b', name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: () => env('GROQ_API_KEY'), model: 'Llama-8b-8192' },
  { id: 'google', name: 'Google AI Studio', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: () => env('GOOGLE_API_KEY'), model: 'gemini-2.0-flash' },
  { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: () => env('OPENROUTER_API_KEY'), model: 'meta-llama/llama-3.3-70b-instruct:free' },
];

const providerQuotas = {};

const FREE_MODEL_CACHE_TTL = 60 * 60 * 1000;
let freeModelCache = { models: [], fetchedAt: 0 };

function isTextOnlyModel(model) {
  const id = model.id || '';
  const reasoningIndicators = ['think', 'reasoning', 'thought', 'think_budget', 'thinking', 'o1-', 'o3-'];
  if (reasoningIndicators.some(r => id.toLowerCase().includes(r))) return false;
  const mod = model.architecture?.modality;
  return !mod || mod === 'text->text' || mod === 'text';
}

async function getOpenRouterFreeModel(apiKey, currentModel) {
  if (Date.now() - freeModelCache.fetchedAt < FREE_MODEL_CACHE_TTL) {
    const cached = freeModelCache.models;
    if (cached.length > 0) {
      if (cached.find(m => m.id === currentModel)) return currentModel;
      return cached[0].id;
    }
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models?sort=pricing-lowest', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) return currentModel;
    const data = await response.json();
    const freeTextModels = (data.data || [])
      .filter(m => {
        if (parseFloat(m.pricing?.prompt || 1) !== 0) return false;
        if ((m.context_length || 0) < 32000) return false;
        return isTextOnlyModel(m);
      })
      .sort((a, b) => (b.context_length || 0) - (a.context_length || 0));
    freeModelCache = { models: freeTextModels, fetchedAt: Date.now() };
    if (freeTextModels.length === 0) return currentModel;
    if (freeTextModels.find(m => m.id === currentModel)) return currentModel;
    return freeTextModels[0].id;
  } catch {
    return currentModel;
  }
}

async function callLLM(messages, { purpose = 'unknown', categoryId = null, temperature = 0.3, max_tokens = 8192, providerId = null, response_format = null, db } = {}) {
  let providers = AI_PROVIDERS.filter(p => p.key());
  if (providers.length === 0) throw new Error('No AI API keys configured. Set GROQ_API_KEY in .env');

  if (providerId) {
    const target = AI_PROVIDERS.find(p => p.id === providerId);
    if (target) {
      if (!target.key()) throw new Error(`API key not configured for ${target.name}. Set the required env var.`);
      providers = [target];
    } else if (providerId.startsWith('gemini-') || providerId.startsWith('gemma-')) {
      const google = AI_PROVIDERS.find(p => p.id === 'google');
      if (!google?.key()) throw new Error('GOOGLE_API_KEY not configured');
      providers = [{ ...google, model: providerId }];
    } else if (providerId.startsWith('openai/')) {
      const groq = AI_PROVIDERS.find(p => p.id === 'llama');
      if (!groq?.key()) throw new Error('No matching provider configured for model: ' + providerId);
      providers = [{ ...groq, model: providerId }];
    } else if (providerId.includes('/')) {
      const openrouter = AI_PROVIDERS.find(p => p.id === 'openrouter');
      if (!openrouter?.key()) throw new Error('OPENROUTER_API_KEY not configured');
      providers = [{ ...openrouter, model: providerId }];
    } else {
      // Treat any other model ID (including plain Groq model names like llama-3.1-8b-instant) as a Groq model
      const groq = AI_PROVIDERS.find(p => p.id === 'llama');
      if (!groq?.key()) throw new Error('No matching provider configured for model: ' + providerId);
      providers = [{ ...groq, model: providerId }];
    }
  }

  let lastError = null;
  for (const provider of providers) {
    let resolvedModel = provider.model;

    if (provider.id === 'openrouter' && !providerId?.includes('/')) {
      const apiKey = provider.key();
      if (apiKey) {
        const checked = await getOpenRouterFreeModel(apiKey, provider.model);
        if (checked !== provider.model) {
          console.log(`[LLM] OpenRouter model no longer free, switching to ${checked}`);
          resolvedModel = checked;
        }
      }
    }

    try {
      const start = Date.now();
      console.log(`[LLM] Trying ${provider.name} (${resolvedModel}) for ${purpose}...`);

      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key()}` };
      if (provider.id === 'openrouter') {
        headers['HTTP-Referer'] = 'https://news-reader.app';
        headers['X-Title'] = `News Reader · ${purpose}`;
      }

      const response = await fetch(provider.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: resolvedModel,
          messages,
          temperature,
          max_tokens,
          ...(response_format && { response_format }),
        }),
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
        model: resolvedModel,
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

      let content = data.choices?.[0]?.message?.content || '';
      if (content.includes('<thought>') && content.includes('</thought>')) {
        content = content.replace(/<thought>[\s\S]*?<\/thought>\s*/g, '');
      }
      if (!content.trim()) {
        console.warn(`[LLM] ${provider.name} (${provider.model}) returned empty content`);
        lastError = `${provider.name} returned empty response`;
        continue;
      }
      console.log(`[LLM] Success: ${provider.name} (${latency}ms, ${usage.total_tokens || '?'} tokens)`);
      return { content, provider: `${provider.name} · ${resolvedModel}`, usage };
    } catch (err) {
      console.warn(`[LLM] ${provider.name} error:`, err.message);
      lastError = `${provider.name}: ${err.message}`;
    }
  }
  throw new Error(lastError || 'All AI providers failed');
}

module.exports = { AI_PROVIDERS, providerQuotas, callLLM };
