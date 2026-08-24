export const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Sent as a bearer token on every API request when set. Pair with API_TOKEN on
// the server — required whenever the backend is reachable from outside
// localhost, since otherwise anyone who can reach it can rewrite prompts and
// spend the LLM keys.
export const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  // Not fatal — a reverse proxy that forwards /api to the backend is a valid
  // setup — but a silent default here was the cause of API calls resolving to
  // index.html. installApiFetch() detects and reports that case at runtime.
  console.warn(
    '[config] VITE_API_URL is not set; falling back to "/api". This only works if the ' +
    'frontend host proxies /api to the backend (see client/nginx.conf).'
  );
}
