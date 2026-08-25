const env = (name) => process.env[name];

// A stalled provider connection used to hang the request forever: the fallback
// loop only advances on a throw or a non-OK response, so with no timeout it
// never reached the next provider and the client never got an answer.
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 90_000;
const RETRY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const RETRY_BASE_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class LLMError extends Error {
  constructor(message, { statusCode = 502, detail = null } = {}) {
    super(message);
    this.name = 'LLMError';
    this.statusCode = statusCode;
    this.expose = true;
    this.detail = detail;
  }
}

// Order is the fallback order. DeepSeek leads because Groq's catalogue shrank
// to gpt-oss + qwen3.6 (Llama 3.x and Kimi were shut down on 2026-08-16), and
// deepseek-v4-flash is a clear step up on prose quality, tone control and
// non-English output for the same money — with near-free prompt-cache hits,
// which matters here because every call repeats a long fixed system prompt.
// Groq stays as the low-latency fallback: an entry with no key is filtered out,
// so this file is safe to ship before DEEPSEEK_API_KEY is set.
//
// `models` is the provider's catalogue, used to route an explicit model ID back
// to the provider that actually serves it. This used to be a chain of string
// heuristics (`includes('/')` → OpenRouter, everything else → Groq) which
// misrouted any new namespaced ID and sent unknown bare IDs to Groq, where they
// 404. Adding a provider now means adding its models here, nothing more.
const AI_PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    key: () => env('DEEPSEEK_API_KEY'),
    model: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'llama',
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => env('GROQ_API_KEY'),
    model: 'openai/gpt-oss-120b',
    // Groq-hosted IDs that contain a slash. Without this list they'd look like
    // OpenRouter IDs, and OpenRouter serves different (or no) models under the
    // same name.
    models: [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'openai/gpt-oss-safeguard-20b',
      'qwen/qwen3.6-27b',
      'groq/compound',
      'groq/compound-mini',
    ],
  },
  {
    id: 'llama8b',
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => env('GROQ_API_KEY'),
    model: 'qwen/qwen3.6-27b',
  },
  {
    id: 'google',
    name: 'Google AI Studio',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: () => env('GOOGLE_API_KEY'),
    model: 'gemini-2.0-flash',
    prefix: /^(gemini|gemma)-/,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: () => env('OPENROUTER_API_KEY'),
    model: 'meta-llama/llama-3.3-70b-instruct:free',
  },
];

const PROVIDER_BY_MODEL = new Map();
for (const provider of AI_PROVIDERS) {
  for (const model of provider.models || []) PROVIDER_BY_MODEL.set(model, provider);
}

const byProviderId = (id) => AI_PROVIDERS.find(p => p.id === id);

/**
 * Resolve a caller-supplied `providerId` — which may be one of our provider
 * ids, or a bare model ID — to the provider that serves it.
 */
function resolveProvider(providerId) {
  const preset = byProviderId(providerId);
  if (preset) return { provider: preset, model: preset.model };

  const owner = PROVIDER_BY_MODEL.get(providerId);
  if (owner) return { provider: owner, model: providerId };

  const byPrefix = AI_PROVIDERS.find(p => p.prefix && p.prefix.test(providerId));
  if (byPrefix) return { provider: byPrefix, model: providerId };

  if (providerId.includes('/')) return { provider: byProviderId('openrouter'), model: providerId };

  // Bare, unrecognised ID: Groq is the only provider whose model IDs are
  // routinely unnamespaced, so it stays the default.
  return { provider: byProviderId('llama'), model: providerId };
}

// Groq's thinking models default to writing their reasoning into
// `message.content` as a <think> block, which every downstream JSON/text parser
// here would choke on. `reasoning_format: 'hidden'` drops it server-side. It is
// a Groq-specific parameter, so it is only ever sent to Groq.
const THINKING_MODELS = new Set(['qwen/qwen3.6-27b']);

function reasoningParams(provider, model) {
  return provider.name === 'Groq' && THINKING_MODELS.has(model) ? { reasoning_format: 'hidden' } : {};
}

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
    const { provider, model } = resolveProvider(providerId);
    if (!provider?.key()) {
      throw new Error(`API key not configured for ${provider?.name || providerId}. Set the required env var.`);
    }
    providers = [{ ...provider, model }];
  }

  let lastError = null;
  let lastStatus = null;
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

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const start = Date.now();
        console.log(`[LLM] Trying ${provider.name} (${resolvedModel}) for ${purpose}${attempt > 1 ? ` — retry ${attempt - 1}` : ''}...`);

        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key()}` };
        if (provider.id === 'openrouter') {
          headers['HTTP-Referer'] = 'https://news-reader.app';
          headers['X-Title'] = `News Reader · ${purpose}`;
        }

        const response = await fetch(provider.url, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: resolvedModel,
            messages,
            temperature,
            max_tokens,
            ...(response_format && { response_format }),
            ...reasoningParams(provider, resolvedModel),
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
          // Log the provider body, never return it: it carries model routing,
          // org identifiers and quota metadata.
          const errBody = await response.text().catch(() => '');
          console.warn(`[LLM] ${provider.name} failed (${response.status}): ${errBody.slice(0, 500)}`);
          lastStatus = response.status;
          lastError = `${provider.name} returned ${response.status}`;
          if (RETRY_STATUS.has(response.status) && attempt < MAX_ATTEMPTS_PER_PROVIDER) {
            await sleep(RETRY_BASE_DELAY_MS * attempt);
            continue;
          }
          break;
        }
        const data = await response.json();
        const latency = Date.now() - start;
        const usage = data.usage || {};

        if (db) {
          // resolvedModel, not provider.model — they diverge whenever the
          // OpenRouter free-model switch fires, and the stats page was
          // attributing usage to a model that was never called.
          db.prepare('INSERT INTO llm_usage (provider, model, prompt_tokens, completion_tokens, total_tokens, purpose, category_id, latency_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
            provider.name, resolvedModel, usage.prompt_tokens || 0, usage.completion_tokens || 0, usage.total_tokens || 0,
            purpose, categoryId, latency, new Date().toISOString()
          );
        }

        let content = data.choices?.[0]?.message?.content || '';
        if (content.includes('<thought>') && content.includes('</thought>')) {
          content = content.replace(/<thought>[\s\S]*?<\/thought>\s*/g, '');
        }
        if (!content.trim()) {
          console.warn(`[LLM] ${provider.name} (${resolvedModel}) returned empty content`);
          lastError = `${provider.name} returned an empty response`;
          if (attempt < MAX_ATTEMPTS_PER_PROVIDER) {
            await sleep(RETRY_BASE_DELAY_MS * attempt);
            continue;
          }
          break;
        }
        console.log(`[LLM] Success: ${provider.name} (${latency}ms, ${usage.total_tokens || '?'} tokens)`);
        return { content, provider: `${provider.name} · ${resolvedModel}`, usage };
      } catch (err) {
        const timedOut = err.name === 'AbortError';
        lastError = timedOut
          ? `${provider.name} timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s`
          : `${provider.name}: ${err.message}`;
        console.warn(`[LLM] ${lastError}`);
        if (attempt < MAX_ATTEMPTS_PER_PROVIDER) {
          await sleep(RETRY_BASE_DELAY_MS * attempt);
          continue;
        }
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new LLMError(lastError || 'All AI providers failed', {
    statusCode: lastStatus === 429 ? 429 : 502,
  });
}

module.exports = { AI_PROVIDERS, providerQuotas, callLLM, LLMError };
