const env = (name) => process.env[name];

// A stalled provider connection used to hang the request forever: the fallback
// loop only advances on a throw or a non-OK response, so with no timeout it
// never reached the next provider and the client never got an answer.
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 90_000;
const RETRY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS_PER_PROVIDER = 2;
// Whole-call budget across the fallback chain. Without it, a requested model
// plus the full chain could run 5 providers × 2 attempts × 90 s ≈ 15 min while
// the client (and the refresh lock) waited.
const TOTAL_BUDGET_MS = Number(process.env.LLM_TOTAL_BUDGET_MS) || 180_000;
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

// DeepSeek is the only provider (2026-10, owner's decision): one bill, one set
// of logs on platform.deepseek.com, and deepseek-flash (V4.1 Flash) has the
// best prose, tone control and non-English output of what was available, with
// near-free prompt-cache hits on our long fixed system prompts. Groq, Google
// AI Studio and OpenRouter used to follow as fallbacks; they were removed, so a
// DeepSeek outage now fails the call instead of silently switching vendor.
//
// `models` is the catalogue, used to route an explicit model ID. Adding a
// provider again means adding an entry with its models here.
const AI_PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    key: () => env('DEEPSEEK_API_KEY'),
    model: 'deepseek-flash',
    // The two v4-flash names are retired aliases that DeepSeek routes to V4.1
    // Flash; kept so a stored/explicit ID still resolves to this provider.
    models: ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp'],
  },
];

const PROVIDER_BY_MODEL = new Map();
for (const provider of AI_PROVIDERS) {
  for (const model of provider.models || []) PROVIDER_BY_MODEL.set(model, provider);
}

const byProviderId = (id) => AI_PROVIDERS.find(p => p.id === id);

/**
 * Resolve a caller-supplied `providerId` — one of our provider ids, or a model
 * ID — to the provider that serves it. An ID nobody serves any more (e.g. a
 * Groq model still stored in a browser's localStorage) gets the default
 * provider and model rather than an error.
 */
function resolveProvider(providerId) {
  const preset = byProviderId(providerId);
  if (preset) return { provider: preset, model: preset.model };

  const owner = PROVIDER_BY_MODEL.get(providerId);
  if (owner) return { provider: owner, model: providerId };

  console.warn(`[LLM] Unknown model "${providerId}" — using ${AI_PROVIDERS[0].model}`);
  return { provider: AI_PROVIDERS[0], model: AI_PROVIDERS[0].model };
}

// DeepSeek V4 has thinking ON by default and bills the reasoning against
// `max_tokens`. At our 8192 budget the model spent the whole allowance thinking
// and returned either empty content or a JSON array cut off mid-stream
// (`{"articles":[` and nothing more), at ~75s per call. Nothing in this app
// needs a reasoning trace, so it is disabled outright.
function providerParams(provider) {
  if (provider.id === 'deepseek') return { thinking: { type: 'disabled' } };
  return {};
}

const providerQuotas = {};

/**
 * `providerId` (a model ID from the menu) is tried first, then the rest of the
 * chain — which, with DeepSeek as the only provider, is empty. `exclusive`
 * is kept for callers that pass it; it no longer changes anything.
 */
async function callLLM(messages, { purpose = 'unknown', categoryId = null, temperature = 0.3, max_tokens = 8192, providerId = null, exclusive = false, response_format = null, db } = {}) {
  const startedAt = Date.now();
  let providers = AI_PROVIDERS.filter(p => p.key());
  if (providers.length === 0) throw new LLMError('No AI API key configured. Set DEEPSEEK_API_KEY in server/.env', { statusCode: 503 });

  // The requested model is a preference, not a pin: try it first, then fall
  // through the rest of the chain (if more providers are ever added back).
  if (providerId) {
    const { provider, model } = resolveProvider(providerId);
    if (provider?.key()) {
      // Same endpoint + model counts as the same provider, or a 429 would be
      // retried on it again.
      const rest = exclusive ? [] : providers.filter((p) => !(p.url === provider.url && p.model === model));
      providers = [{ ...provider, model, preferred: true }, ...rest];
    } else if (exclusive) {
      throw new LLMError(`API key not configured for ${provider?.name || providerId}`, { statusCode: 503 });
    } else {
      console.warn(`[LLM] No API key for ${provider?.name || providerId} (requested ${providerId}) — using the default chain`);
    }
  }

  let lastError = null;
  let lastStatus = null;
  for (const provider of providers) {
    const resolvedModel = provider.model;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 5000) break;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remaining));
      try {
        const start = Date.now();
        console.log(`[LLM] Trying ${provider.name} (${resolvedModel}) for ${purpose}${attempt > 1 ? ` — retry ${attempt - 1}` : ''}...`);

        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key()}` };

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
            ...providerParams(provider),
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
          // lastStatus describes lastError; a stale 429 from an earlier provider
          // made a timeout or empty reply surface as "rate limited".
          lastStatus = null;
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
        lastStatus = null;
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
  if (Date.now() - startedAt >= TOTAL_BUDGET_MS - 5000) {
    console.warn(`[LLM] ${purpose}: gave up after the ${Math.round(TOTAL_BUDGET_MS / 1000)}s budget`);
  }
  throw new LLMError(lastError || 'All AI providers failed', {
    statusCode: lastStatus === 429 ? 429 : 502,
  });
}

module.exports = { AI_PROVIDERS, providerQuotas, callLLM, LLMError };
