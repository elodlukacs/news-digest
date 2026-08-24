const express = require('express');
const db = require('../db');
const { fetchAllSources } = require('../jobs/sources');
const { runExclusive } = require('../lib/inFlight');
const { filterJobsWithAI } = require('../jobs/ai-filter');
const { callLLM: rawCallLLM } = require('../lib/llm');
const callLLM = (messages, opts) => rawCallLLM(messages, { ...opts, db });

const router = express.Router();

const MAX_PAGE_SIZE = 200;

// `parseInt` alone let `?limit=999999999` dump every row (each carries a full
// description) and `?page=abc` bind NaN into the query.
function clampInt(value, { fallback, min = 1, max = Number.MAX_SAFE_INTEGER }) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Per-source retention. Aggregator feeds churn fast (postings vanish after a
// week); ATS direct boards keep postings open for 30-60 days, so we use a
// longer window for `companies-ats` to avoid losing genuinely-open roles.
// `prefix` lets the same expression be used in joined queries (with `j.`).
function recentJobFilter(prefix = '') {
  const p = prefix ? `${prefix}.` : '';
  return `(${p}date_posted >= date('now', '-7 days') OR (${p}source = 'companies-ats' AND ${p}date_posted >= date('now', '-30 days')))`;
}

router.get('/', (req, res) => {
  const { saved, source, workType, search, country, aiOnly, page = '1', limit = '50' } = req.query;
  const conditions = [];
  const params = {};

  conditions.push(recentJobFilter('j'));
  if (saved === 'true') { conditions.push('sj.job_id IS NOT NULL'); }
  if (source) { conditions.push('j.source = @source'); params.source = source; }
  if (workType) { conditions.push('j.work_type = @workType'); params.workType = workType; }
  if (search) { conditions.push('(LOWER(j.title) LIKE @search OR LOWER(j.company) LIKE @search)'); params.search = `%${search.toLowerCase()}%`; }
  if (country) { conditions.push('LOWER(j.country) LIKE @country'); params.country = `%${country.toLowerCase()}%`; }

  const aiJoin = aiOnly === 'true' ? 'INNER JOIN ai_filtered_jobs af ON j.id = af.job_id' : '';
  const savedJoin = 'LEFT JOIN saved_jobs sj ON j.id = sj.job_id';
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const pageNum = clampInt(page, { fallback: 1 });
  const pageSize = clampInt(limit, { fallback: 50, max: MAX_PAGE_SIZE });
  const offset = (pageNum - 1) * pageSize;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM jobs j ${savedJoin} ${aiJoin} ${where}`).get(params);
  const jobs = db.prepare(`
    SELECT j.*, ${aiOnly === 'true' ? 'af.remote as ai_remote' : 'NULL as ai_remote'},
           CASE WHEN sj.job_id IS NOT NULL THEN 1 ELSE 0 END as is_saved
    FROM jobs j ${savedJoin} ${aiJoin} ${where}
    ORDER BY j.date_posted DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  const recentFilter = recentJobFilter();
  const counts = { total: 0, new: 0, saved: 0 };
  const countRows = db.prepare(`SELECT status, COUNT(*) as count FROM jobs WHERE ${recentFilter} GROUP BY status`).all();
  for (const r of countRows) { counts.total += r.count; counts[r.status] = r.count; }
  counts.saved = db.prepare(`SELECT COUNT(*) as count FROM saved_jobs WHERE job_id IN (SELECT id FROM jobs WHERE ${recentFilter})`).get().count;
  const aiCount = db.prepare(`SELECT COUNT(*) as count FROM ai_filtered_jobs WHERE job_id IN (SELECT id FROM jobs WHERE ${recentFilter})`).get();

  const sources = db.prepare(`SELECT DISTINCT source FROM jobs WHERE source != '' AND ${recentFilter} ORDER BY source`).all().map(r => r.source);
  const countries = db.prepare(`SELECT DISTINCT country FROM jobs WHERE country != '' AND ${recentFilter} ORDER BY country`).all().map(r => r.country);
  const sourceCountRows = db.prepare(`SELECT source, COUNT(*) as count FROM jobs WHERE ${recentFilter} GROUP BY source`).all();
  const sourceCounts = {};
  for (const r of sourceCountRows) sourceCounts[r.source] = r.count;

  res.json({
    jobs: jobs.map(r => ({
      id: r.id, title: r.title, company: r.company, url: r.url, source: r.source,
      datePosted: r.date_posted, status: r.status, country: r.country,
      workType: r.work_type,
      aiRemote: r.ai_remote || undefined,
      saved: r.is_saved === 1,
    })),
    total: countRow.total,
    counts: { ...counts, aiFiltered: aiCount.count },
    sources, countries, sourceCounts,
    page: pageNum, limit: pageSize,
  });
});

router.post('/fetch', async (req, res) => {
  try {
    console.log('[Jobs] Fetching from all sources...');
    // One fetch at a time — concurrent runs interleave with the wipe below.
    const { jobs, sources } = await runExclusive('jobs:fetch', fetchAllSources);

    // Per-source failures are tolerated, but if every source failed we would be
    // about to replace the table with nothing.
    const okSources = sources.filter(s => !s.error);
    if (sources.length > 0 && okSources.length === 0) {
      console.error('[Jobs] All sources failed — keeping existing jobs');
      return res.status(502).json({
        error: 'All job sources failed — existing jobs kept',
        code: 'all_sources_failed',
        sources,
      });
    }

    const stmt = db.prepare(`
      INSERT INTO jobs (id, title, company, url, source, date_posted, status, country, work_type, description, created_at)
      VALUES (@id, @title, @company, @url, @source, @datePosted, @status, @country, @workType, @description, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, company = excluded.company, url = excluded.url,
        date_posted = excluded.date_posted, country = excluded.country,
        work_type = excluded.work_type, description = excluded.description
    `);
    const now = new Date().toISOString();

    // Wipe and repopulate in ONE transaction. As two transactions, a throw in
    // the insert loop left the table empty, and a concurrent GET /api/jobs
    // between them saw zero rows.
    db.transaction(() => {
      db.prepare('DELETE FROM ai_filtered_jobs').run();
      db.prepare('DELETE FROM jobs WHERE id NOT IN (SELECT job_id FROM saved_jobs)').run();
      for (const job of jobs) stmt.run({ ...job, createdAt: now });
    })();

    console.log(`[Jobs] Fetched ${jobs.length} jobs from ${okSources.length} sources`);
    res.json({ fetched: jobs.length, sources });
  } catch (error) {
    console.error('[Jobs] Fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/save', (req, res) => {
  const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  db.prepare('INSERT OR IGNORE INTO saved_jobs (job_id, saved_at) VALUES (?, ?)').run(req.params.id, new Date().toISOString());
  res.json({ ok: true });
});

router.delete('/:id/save', (req, res) => {
  db.prepare('DELETE FROM saved_jobs WHERE job_id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/ai-filter', async (req, res) => {
  try {
    const { provider } = req.body || {};
    const rows = db.prepare("SELECT * FROM jobs WHERE status = 'new'").all();
    const jobs = rows.map(r => ({
      id: r.id, title: r.title, company: r.company, source: r.source,
      country: r.country, workType: r.work_type,
    }));

    if (jobs.length === 0) return res.json({ filtered: 0, total: 0 });

    console.log(`[Jobs] AI filtering ${jobs.length} jobs...`);
    const results = await filterJobsWithAI(jobs, callLLM, provider || null);

    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare('DELETE FROM ai_filtered_jobs').run();
      const stmt = db.prepare('INSERT OR IGNORE INTO ai_filtered_jobs (job_id, remote, filtered_at) VALUES (?, ?, ?)');
      for (const r of results) stmt.run(r.id, r.remote, now);
    })();

    console.log(`[Jobs] AI filter matched ${results.length}/${jobs.length} jobs`);
    res.json({ filtered: results.length, total: jobs.length });
  } catch (error) {
    console.error('[Jobs] AI filter error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
