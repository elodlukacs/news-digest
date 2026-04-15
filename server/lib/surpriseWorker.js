// Background worker for the "Break / Surprise" feature.
//
// Pre-generates article briefs (and, selectively, expanded versions) so
// GET /api/homepage/surprise becomes a pure DB query — no LLM call on
// the request path.
//
// Triggers (all call the single exported generateMissingBriefs):
//   1. After a category refresh (see routes/summaries.js).
//   2. Periodic sweep started at server boot (startPeriodicSweep).
//   3. On-demand via POST /api/homepage/surprise/prewarm.

// Note: db is required lazily inside generateMissingBriefs to avoid
// circular init issues at module load.

const { callLLM } = require('./llm');
const { buildMessages } = require('./promptManager');
const { cleanArticleText } = require('./cleanText');

const MIN_CLEAN_LENGTH = 320;
const LLM_INPUT_TRIM = 1800;
const BRIEF_MIN_LENGTH = 60;
const EXPANDED_MIN_LENGTH = 200;
const RETRY_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// Guard against concurrent sweeps for the same scope.
const runningSweeps = new Set();

async function generateBriefForArticle(database, article) {
  const cleaned = cleanArticleText(article.body_text || article.description || '');
  const stampNow = () => database
    .prepare("UPDATE articles SET brief_generated_at = datetime('now') WHERE id = ?")
    .run(article.id);

  if (cleaned.length < MIN_CLEAN_LENGTH) {
    stampNow(); // record attempt so we skip in the next sweep
    return null;
  }

  const trimmed = cleaned.length > LLM_INPUT_TRIM ? cleaned.slice(0, LLM_INPUT_TRIM) : cleaned;
  try {
    const messages = buildMessages('surprise-brief', {
      title: article.title || '',
      source: article.feed_name || 'Unknown source',
      content: trimmed,
    });
    const result = await callLLM(messages, {
      purpose: 'surprise-brief',
      providerId: 'openrouter',
      max_tokens: 240,
      temperature: 0.3,
    });
    const brief = String(result?.content || '').trim();
    if (brief.length >= BRIEF_MIN_LENGTH) {
      database
        .prepare("UPDATE articles SET surprise_brief = ?, brief_generated_at = datetime('now') WHERE id = ?")
        .run(brief, article.id);
      return brief;
    }
    stampNow();
    return null;
  } catch (err) {
    console.warn(`[surprise] brief failed for article ${article.id}: ${err.message}`);
    stampNow();
    return null;
  }
}

async function generateExpandedForArticle(database, article) {
  const cleaned = cleanArticleText(article.body_text || article.description || '');
  if (cleaned.length < MIN_CLEAN_LENGTH) return null;

  try {
    const messages = buildMessages('surprise-elaborate', {
      title: article.title || '',
      source: article.feed_name || 'Unknown source',
      content: cleaned,
    });
    const result = await callLLM(messages, {
      purpose: 'surprise-elaborate',
      providerId: 'openrouter',
      max_tokens: 2000,
      temperature: 0.5,
    });
    const expanded = String(result?.content || '').trim();
    if (expanded.length >= EXPANDED_MIN_LENGTH) {
      database
        .prepare('UPDATE articles SET surprise_expanded = ? WHERE id = ?')
        .run(expanded, article.id);
      return expanded;
    }
    return null;
  } catch (err) {
    console.warn(`[surprise] expanded failed for article ${article.id}: ${err.message}`);
    return null;
  }
}

// Unified worker: generates missing briefs (and optionally expansions) for
// articles matching the given scope. Safe to call concurrently; sweeps with
// the same scope are deduplicated.
async function generateMissingBriefs({
  categoryId = null,
  limit = 15,
  includeElaborate = false,
  elaborateLimit = 5,
} = {}) {
  // Lazy require to avoid potential init-order issues.
  const database = require('../db');

  const scopeKey = `cat:${categoryId ?? 'all'}`;
  if (runningSweeps.has(scopeKey)) {
    return { skipped: true };
  }
  runningSweeps.add(scopeKey);

  let briefsGenerated = 0;
  let expandedGenerated = 0;

  try {
    const cooldown = new Date(Date.now() - RETRY_COOLDOWN_MS).toISOString();
    const categoryClause = categoryId ? 'AND a.category_id = ?' : '';
    const briefSql = `
      SELECT a.* FROM articles a
      WHERE a.pub_date > datetime('now', '-72 hours')
        AND (a.surprise_brief IS NULL OR LENGTH(a.surprise_brief) < ?)
        AND (a.brief_generated_at IS NULL OR a.brief_generated_at < ?)
        AND LENGTH(COALESCE(a.body_text, a.description, '')) > 400
        ${categoryClause}
      ORDER BY a.pub_date DESC
      LIMIT ?
    `;
    const briefParams = categoryId
      ? [BRIEF_MIN_LENGTH, cooldown, categoryId, limit]
      : [BRIEF_MIN_LENGTH, cooldown, limit];
    const rows = database.prepare(briefSql).all(...briefParams);

    if (rows.length > 0) {
      console.log(`[surprise] sweep: ${rows.length} articles (scope=${scopeKey})`);
    }

    for (const row of rows) {
      const brief = await generateBriefForArticle(database, row);
      if (brief) briefsGenerated += 1;
    }

    if (includeElaborate) {
      const expandSql = `
        SELECT a.* FROM articles a
        WHERE a.pub_date > datetime('now', '-72 hours')
          AND a.surprise_brief IS NOT NULL AND LENGTH(a.surprise_brief) >= ?
          AND (a.surprise_expanded IS NULL OR LENGTH(a.surprise_expanded) < ?)
          ${categoryClause}
        ORDER BY a.pub_date DESC
        LIMIT ?
      `;
      const expandParams = categoryId
        ? [BRIEF_MIN_LENGTH, EXPANDED_MIN_LENGTH, categoryId, elaborateLimit]
        : [BRIEF_MIN_LENGTH, EXPANDED_MIN_LENGTH, elaborateLimit];
      const expandRows = database.prepare(expandSql).all(...expandParams);
      for (const row of expandRows) {
        const expanded = await generateExpandedForArticle(database, row);
        if (expanded) expandedGenerated += 1;
      }
    }

    if (briefsGenerated || expandedGenerated) {
      console.log(`[surprise] sweep done (scope=${scopeKey}): ${briefsGenerated} briefs, ${expandedGenerated} expansions`);
    }
    return { briefsGenerated, expandedGenerated };
  } finally {
    runningSweeps.delete(scopeKey);
  }
}

function startPeriodicSweep({ intervalMs = 20 * 60 * 1000, initialDelayMs = 15 * 1000 } = {}) {
  const run = () => {
    generateMissingBriefs({ limit: 20, includeElaborate: true })
      .catch((err) => console.warn('[surprise] periodic sweep failed:', err.message));
  };
  setTimeout(run, initialDelayMs);
  setInterval(run, intervalMs);
}

module.exports = {
  generateMissingBriefs,
  generateBriefForArticle,
  generateExpandedForArticle,
  startPeriodicSweep,
};
