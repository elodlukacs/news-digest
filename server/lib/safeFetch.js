/**
 * SSRF-hardened fetch.
 *
 * Any URL that originates from a client request (feed discovery, subscribed
 * feed URLs, article extraction) must go through here. Plain `fetch` will
 * happily talk to 127.0.0.1, the Docker bridge, the LAN behind the host, and
 * cloud metadata endpoints — and this server renders/forwards what it gets
 * back, which turns a blind request into data exfiltration.
 *
 * Guarantees:
 *   - http/https only
 *   - hostname resolved up-front; every resolved address must be public
 *   - redirects followed manually, re-validated at each hop, capped
 *   - hard timeout for the whole chain
 *   - response body capped, streamed, aborted past the cap
 */
const dns = require('dns').promises;
const net = require('net');

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; NewsReader/1.0)';

class UnsafeUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsafeUrlError';
    this.statusCode = 400;
    this.expose = true;
  }
}

function isBlockedIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;                          // 0.0.0.0/8 "this host"
  if (a === 10) return true;                         // RFC1918
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;  // RFC1918
  if (a === 192 && b === 168) return true;           // RFC1918
  if (a === 192 && b === 0) return true;             // IETF protocol assignments / TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true;                         // multicast + reserved
  return false;
}

function isBlockedIPv6(raw) {
  const ip = String(raw).toLowerCase().split('%')[0];
  if (ip === '::' || ip === '::1') return true;      // unspecified + loopback
  if (/^fe[89ab]/.test(ip)) return true;             // link-local
  if (/^f[cd]/.test(ip)) return true;                // unique local
  if (/^ff/.test(ip)) return true;                   // multicast
  if (ip.startsWith('2002:')) return true;           // 6to4
  if (ip.startsWith('2001:0:') || ip.startsWith('2001::')) return true; // Teredo
  const mapped = ip.match(/^::ffff:(.+)$/);
  if (mapped) return net.isIPv4(mapped[1]) ? isBlockedIPv4(mapped[1]) : true;
  return false;
}

function isBlockedAddress(ip) {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip)) return isBlockedIPv6(ip);
  return true;
}

/**
 * Validate a client-supplied URL. Throws UnsafeUrlError (400) when the target
 * is malformed, non-http(s), or resolves to a non-public address.
 * Returns the parsed URL.
 */
async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl));
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError('URL must use http or https');
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '');

  // A literal IP needs no lookup — check it directly.
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError('URL targets a non-public address');
    return parsed;
  }

  let records;
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('Could not resolve host');
  }
  if (!records.length) throw new UnsafeUrlError('Could not resolve host');

  // Every resolved address must be public — one bad record is enough to reject,
  // otherwise a multi-record name defeats the check.
  for (const { address } of records) {
    if (isBlockedAddress(address)) throw new UnsafeUrlError('URL targets a non-public address');
  }
  return parsed;
}

async function readCapped(response, maxBytes) {
  if (!response.body) return '';
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new UnsafeUrlError('Response too large');
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const reader = response.body.getReader();
  let total = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new UnsafeUrlError('Response too large');
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return text + decoder.decode();
}

/**
 * Fetch a client-supplied URL safely. Returns { url, status, headers, text }.
 * `url` is the final URL after redirects.
 */
async function safeFetch(rawUrl, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  headers = {},
  method = 'GET',
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let target = await assertPublicUrl(rawUrl);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(target, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, ...headers },
      });

      const isRedirect = response.status >= 300 && response.status < 400 && response.headers.get('location');
      if (!isRedirect) {
        return {
          url: target.href,
          status: response.status,
          ok: response.ok,
          headers: response.headers,
          text: await readCapped(response, maxBytes),
        };
      }

      if (hop === MAX_REDIRECTS) throw new UnsafeUrlError('Too many redirects');
      // Re-validate the redirect target: the first hop being public says
      // nothing about where it points.
      target = await assertPublicUrl(new URL(response.headers.get('location'), target).href);
    }
    throw new UnsafeUrlError('Too many redirects');
  } catch (err) {
    if (err.name === 'AbortError') throw new UnsafeUrlError('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { safeFetch, assertPublicUrl, UnsafeUrlError, isBlockedAddress };
