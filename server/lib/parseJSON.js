// Shared JSON repair utility for LLM responses.
// LLMs sometimes wrap output in markdown fences or include trailing commas;
// this function strips both before attempting to parse.
//
// Usage:
//   parseJSON(raw)              — throws SyntaxError if all attempts fail
//   parseJSON(raw, fallback)    — returns fallback instead of throwing
function parseJSON(raw, fallback) {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {}
  const withFixedCommas = cleaned.replace(/,\s*([\]}])/g, '$1');
  try {
    return JSON.parse(withFixedCommas);
  } catch {}
  if (fallback !== undefined) return fallback;
  throw new SyntaxError('Failed to parse LLM response as JSON');
}

module.exports = { parseJSON };
