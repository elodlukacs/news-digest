require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const requireAuth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errors');
const { startRetention } = require('./lib/retention');
const { backfillUrlKeys } = require('./lib/feedHealth');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: allowlist from ALLOWED_ORIGINS (comma-separated). Unset means
// same-origin/local only — a wildcard would let any page the owner visits read
// API responses and spend the LLM keys.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);            // same-origin / curl / server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!allowedOrigins.length && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);                       // dev default
    }
    const err = new Error(`Origin not allowed: ${origin}`);
    err.statusCode = 403;
    err.code = 'origin_not_allowed';
    err.expose = true;
    return callback(err);
  },
  credentials: false,
}));

app.use(express.json({ limit: '256kb' }));

// Baseline security headers (hand-rolled — no helmet dependency needed for an
// API that serves only JSON).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
});

// Liveness probe: must not touch the DB, so it still answers when the DB is
// the thing that's broken. Placed before auth so probes need no token.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()), auth: requireAuth.enabled });
});

app.use(rateLimit({ windowMs: 60_000, max: 300, name: 'api' }));
app.use(requireAuth);

// Tighter bucket on the routes that spend money. Every one of these makes at
// least one LLM call per request.
const llmLimit = rateLimit({ windowMs: 60_000, max: 20, name: 'llm' });
for (const path of [
  '/api/chat', '/api/forensics', '/api/compare', '/api/spectrum', '/api/briefing',
  '/api/inoculation', '/api/scientist', '/api/bridge', '/api/cognitive',
  '/api/bias-radar', '/api/bias-mirror', '/api/fallacy-dojo', '/api/conspiracy-anatomy',
  '/api/source-lab', '/api/propaganda-timeline', '/api/manipulator',
  '/api/homepage/surprise', '/api/discover-feed',
]) {
  app.use(path, llmLimit);
}

// Routers
app.use('/api/categories', require('./routes/categories'));
app.use('/api/categories', require('./routes/feeds'));
app.use('/api/categories', require('./routes/summaries'));
app.use('/api/feeds', require('./routes/feedDelete'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/discover-feed', require('./routes/discovery'));
app.use('/api/explore-feeds', require('./routes/explore-feeds'));
app.use('/api/briefing', require('./routes/briefing'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/models', require('./routes/models'));
app.use('/api/widgets', require('./routes/widgets'));
app.use('/api/homepage/surprise', require('./routes/surprise'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/bias-radar/decode', require('./routes/bias-radar/decode'));
app.use('/api/bias-radar/related', require('./routes/bias-radar/related'));
app.use('/api/bias-radar/daily-quiz', require('./routes/bias-radar/daily-quiz'));
app.use('/api/bias-radar/steelman', require('./routes/bias-radar/steelman'));
app.use('/api/bias-radar/rabbit-hole', require('./routes/bias-radar/rabbit-hole'));
app.use('/api/bias-radar/missing-story', require('./routes/bias-radar/missing-story'));
app.use('/api/forensics', require('./routes/forensics'));
app.use('/api/inoculation', require('./routes/inoculation'));
app.use('/api/scientist', require('./routes/scientist'));
app.use('/api/bridge', require('./routes/bridge'));
app.use('/api/cognitive', require('./routes/narrative'));
app.use('/api/cognitive/prompts', require('./routes/prompts'));
app.use('/api/prompts', require('./routes/prompts-manager'));
app.use('/api/cognitive', require('./routes/disinfo'));
app.use('/api/compare', require('./routes/compare'));
app.use('/api/spectrum', require('./routes/spectrum'));
app.use('/api/progress', require('./routes/cognitive'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/fallacy-dojo', require('./routes/fallacy-dojo'));
app.use('/api/conspiracy-anatomy', require('./routes/conspiracy-anatomy'));
app.use('/api/bias-mirror', require('./routes/bias-mirror'));
app.use('/api/source-lab', require('./routes/source-lab'));
app.use('/api/propaganda-timeline', require('./routes/propaganda-timeline'));
app.use('/api/manipulator', require('./routes/manipulator'));
app.use('/api/logs', require('./routes/logs'));

// Terminal handlers — must come after every router.
app.use('/api', notFound);
app.use(errorHandler);

// Maintenance on a timer, not inside a GET handler.
startRetention(db);
backfillUrlKeys(db);

const server = app.listen(PORT, () => {
  console.log(`News Reader API running on http://localhost:${PORT}`);
  console.log(`[startup] auth: ${requireAuth.enabled ? 'enabled (API_TOKEN set)' : 'DISABLED — set API_TOKEN if this host is reachable from outside localhost'}`);
  console.log(`[startup] cors: ${allowedOrigins.length ? allowedOrigins.join(', ') : 'localhost only (set ALLOWED_ORIGINS for a deployed frontend)'}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaught exception:', err);
});

// SQLite runs in WAL mode; without an explicit close on shutdown the WAL is
// left unflushed on every container restart.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, closing server...`);
  server.close(() => {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('[shutdown] database closed');
    } catch (err) {
      console.error('[shutdown] error closing database:', err.message);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
