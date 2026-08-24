// Shared JSON repair for LLM responses.
//
// There were four independent implementations of this (here, refreshSummary,
// ai-filter, bias-radar/decode) and this shared one was the weakest — it had no
// truncation recovery, which is the failure that actually matters when a model
// hits its token ceiling mid-array. The strongest logic now lives here so all
// callers get it.
//
// Usage:
//   parseJSON(raw)              — throws SyntaxError if all attempts fail
//   parseJSON(raw, fallback)    — returns fallback instead of throwing

function stripFences(raw) {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }
  return cleaned;
}

/**
 * Recover the complete objects from a response that was cut off mid-array:
 * truncate at the last closed object, drop the dangling comma, and re-balance
 * brackets. Salvaging most of a digest beats discarding all of it.
 */
function recoverTruncated(text) {
  const lastComplete = text.lastIndexOf('}');
  if (lastComplete <= 0) return null;

  let truncated = text.slice(0, lastComplete + 1).replace(/,\s*$/, '');
  const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/\]/g) || []).length;
  const openBraces = (truncated.match(/\{/g) || []).length - (truncated.match(/\}/g) || []).length;
  truncated += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));

  try {
    return JSON.parse(truncated);
  } catch {
    return null;
  }
}

function parseJSON(raw, fallback) {
  const cleaned = stripFences(raw);

  try {
    return JSON.parse(cleaned);
  } catch { /* try repairs */ }

  // Trailing commas before a closing bracket.
  const withFixedCommas = cleaned.replace(/,\s*([\]}])/g, '$1');
  try {
    return JSON.parse(withFixedCommas);
  } catch { /* try truncation recovery */ }

  // Leading prose before the JSON body.
  const firstBrace = cleaned.search(/[[{]/);
  if (firstBrace > 0) {
    try {
      return JSON.parse(cleaned.slice(firstBrace));
    } catch { /* try truncation recovery */ }
  }

  const recovered = recoverTruncated(withFixedCommas);
  if (recovered !== null) return recovered;

  if (fallback !== undefined) return fallback;
  throw new SyntaxError('Failed to parse LLM response as JSON');
}

module.exports = { parseJSON, stripFences, recoverTruncated };
