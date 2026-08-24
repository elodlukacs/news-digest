import { API_BASE, API_TOKEN } from '../config';

/**
 * One-time patch of `window.fetch` for API requests.
 *
 * Installed from main.tsx so it covers every call site, including the ~30
 * components that call `fetch` directly rather than going through a hook.
 * It does two things:
 *
 * 1. Attaches the bearer token when VITE_API_TOKEN is configured, so the
 *    backend can require auth without every call site changing.
 *
 * 2. Turns an HTML response to an API request into a real error. Both
 *    production hosts route unmatched paths to index.html, so a misconfigured
 *    API base returned "200 OK" with an HTML body — `res.ok` was true and
 *    `res.json()` threw a parse error, surfacing everywhere as the misleading
 *    "Invalid response from server".
 */
function isApiRequest(url: string): boolean {
  if (API_BASE.startsWith('http')) return url.startsWith(API_BASE);
  // Relative base such as "/api": match both relative and absolute same-origin URLs.
  if (url.startsWith(API_BASE)) return true;
  try {
    return new URL(url, window.location.origin).pathname.startsWith(API_BASE);
  } catch {
    return false;
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function installApiFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!isApiRequest(url)) return originalFetch(input, init);

    let nextInit = init;
    if (API_TOKEN) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${API_TOKEN}`);
      nextInit = { ...init, headers };
    }

    const response = await originalFetch(input, nextInit);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error(
        `API request to ${url} returned HTML instead of JSON — VITE_API_URL is probably wrong, ` +
        'or the frontend host is rewriting /api to index.html.'
      );
    }

    return response;
  };
}
