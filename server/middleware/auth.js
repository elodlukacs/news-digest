/**
 * Shared-secret auth for the whole API.
 *
 * Opt-in: with no API_TOKEN set the middleware is a no-op, so local
 * development is unchanged. Set API_TOKEN in the server .env and
 * VITE_API_TOKEN in the client build whenever the backend is reachable
 * from outside localhost — without it, anyone who can reach the host can
 * delete categories, rewrite system prompts, and spend the LLM keys.
 */
const crypto = require('crypto');

const TOKEN = process.env.API_TOKEN || '';

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function presentedToken(req) {
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return req.get('x-api-key') || '';
}

function requireAuth(req, res, next) {
  if (!TOKEN) return next();
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/api/health') return next();
  if (timingSafeEqual(presentedToken(req), TOKEN)) return next();
  res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
}

requireAuth.enabled = Boolean(TOKEN);

module.exports = requireAuth;
