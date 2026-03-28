const express = require('express');
const db = require('../db');
const { fetchAllSources } = require('../jobs/sources');
const { filterJobsWithAI } = require('../jobs/ai-filter');
const { callLLM: rawCallLLM } = require('../lib/llm');
const callLLM = (messages, opts) => rawCallLLM(messages, { ...opts, db });

const router = express.Router();

let lastJobFetch = 0;

function upsertJobs(jobs) {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, title, company, url, source, date_posted, status, country, work_type, description, created_at)
    VALUES (@id, @title, @company, @url, @source, @datePosted,
      COALESCE((SELECT status FROM jobs WHERE id = @id AND status != 'new'), @status),
      @country, @workType, @description, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, company = excluded.company, url = excluded.url,
      date_posted = excluded.date_posted,
      status = COALESCE((SELECT status FROM jobs WHERE id = excluded.id AND status != 'new'), excluded.status),
      country = excluded.country, work_type = excluded.work_type, description = excluded.description
  `);
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const job of jobs) {
      stmt.run({ ...job, createdAt: now });
    }
  })();
}

router.get('/', (req, res) => {
  const { status, source, workType, search, country, aiOnly, page = '1', limit = '50' } = req.query;
  const conditions = [];
  const params = {};

  if (status) { conditions.push('j.status = @status'); params.status = status; }
  if (source) { conditions.push('j.source = @source'); params.source = source; }
  if (workType) { conditions.push('j.work_type = @workType'); params.workType = workType; }
  if (search) { conditions.push('(LOWER(j.title) LIKE @search OR LOWER(j.company) LIKE @search)'); params.search = `%${search.toLowerCase()}%`; }
  if (country) { conditions.push('LOWER(j.country) LIKE @country'); params.country = `%${country.toLowerCase()}%`; }

  const join = aiOnly === 'true' ? 'INNER JOIN ai_filtered_jobs af ON j.id = af.job_id' : '';
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM jobs j ${join} ${where}`).get(params);
  const jobs = db.prepare(`
    SELECT j.*, ${aiOnly === 'true' ? 'af.remote as ai_remote' : 'NULL as ai_remote'}
    FROM jobs j ${join} ${where}
    ORDER BY j.date_posted DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: parseInt(limit), offset });

  const counts = { total: 0, new: 0, applied: 0, ignored: 0 };
  const countRows = db.prepare('SELECT status, COUNT(*) as count FROM jobs GROUP BY status').all();
  for (const r of countRows) { counts.total += r.count; counts[r.status] = r.count; }
  const aiCount = db.prepare('SELECT COUNT(*) as count FROM ai_filtered_jobs').get();

  const sources = db.prepare("SELECT DISTINCT source FROM jobs WHERE source != '' ORDER BY source").all().map(r => r.source);
  const countries = db.prepare("SELECT DISTINCT country FROM jobs WHERE country != '' ORDER BY country").all().map(r => r.country);

  res.json({
    jobs: jobs.map(r => ({
      id: r.id, title: r.title, company: r.company, url: r.url, source: r.source,
      datePosted: r.date_posted, status: r.status, country: r.country,
      workType: r.work_type, description: r.description || undefined,
      aiRemote: r.ai_remote || undefined,
    })),
    total: countRow.total,
    counts: { ...counts, aiFiltered: aiCount.count },
    sources, countries,
    page: parseInt(page), limit: parseInt(limit),
  });
});

router.post('/fetch', async (req, res) => {
  const now = Date.now();
  if (now - lastJobFetch < 30 * 60 * 1000) {
    const cached = db.prepare('SELECT COUNT(*) as count FROM jobs').get();
    if (cached.count > 0) {
      return res.json({ fetched: cached.count, sources: [], cached: true });
    }
  }

  try {
    console.log('[Jobs] Fetching from all sources...');
    const { jobs, sources } = await fetchAllSources();
    if (jobs.length > 0) upsertJobs(jobs);
    lastJobFetch = Date.now();
    console.log(`[Jobs] Fetched ${jobs.length} jobs from ${sources.filter(s => !s.error).length} sources`);
    res.json({ fetched: jobs.length, sources });
  } catch (error) {
    console.error('[Jobs] Fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['new', 'applied', 'ignored'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

router.post('/ai-filter', async (req, res) => {
  try {
    const { provider } = req.body;
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
