/**
 * Guard for hrefs that come from feed or LLM output.
 *
 * React escapes text but does NOT block `javascript:` in an `href`, so a
 * malicious RSS item's `<link>` rendered straight into an anchor executes on
 * click. Every dynamic href must go through this.
 *
 * Returns undefined for anything that isn't a plain http(s) URL, which makes
 * the anchor inert rather than dangerous.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}
