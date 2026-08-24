/**
 * Terminal 404 + error handlers.
 *
 * Every client hook does `await res.json()`. Without these, an unmatched path
 * or a throwing handler falls through to Express's default handler, which
 * answers with an HTML stack-trace page — so the client throws
 * "Invalid response from server" instead of showing the real error.
 *
 * Express 5 forwards async rejections automatically, so route handlers need no
 * asyncHandler wrapper for this to catch them.
 */
const IS_PROD = process.env.NODE_ENV === 'production';

function notFound(req, res) {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}`, code: 'not_found' });
}

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;

  // 5xx means we did something wrong — always log the full error.
  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  else console.warn(`[error] ${req.method} ${req.originalUrl} → ${status}: ${err.message}`);

  if (res.headersSent) return;

  // Only messages explicitly marked safe (validation errors, our own 4xx)
  // reach the client. Upstream provider bodies leak model routing and quota
  // metadata, so they stay in the log.
  const expose = err.expose === true || status < 500;
  res.status(status).json({
    error: expose ? err.message : 'Internal server error',
    code: err.code || (status >= 500 ? 'internal_error' : 'request_failed'),
    ...(IS_PROD ? {} : { detail: expose ? undefined : err.message }),
  });
}

module.exports = { notFound, errorHandler };
