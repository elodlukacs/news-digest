// Direct ATS job board fetchers (Greenhouse / Lever / Ashby / Workable).
// These are unauthenticated public endpoints exposed by each ATS so any
// company-hosted board (boards.greenhouse.io/{slug}, jobs.lever.co/{slug},
// jobs.ashbyhq.com/{slug}, apply.workable.com/{slug}) can be fetched in JSON.
//
// We deliberately keep a curated company list in profile.js — the value of
// these sources is the *company*, not the ATS provider, so all postings are
// stored under the single source slug 'companies-ats'.

const {
  fetchWithTimeout,
  generateJobId,
  normalizeJob,
  determineWorkType,
  extractCountry,
  parseDate,
  formatUnixDate,
  abortableDelay,
} = require('./common');
const { JOB_PROFILE, isInRegion, matchesRole } = require('./profile');

const SOURCE = 'companies-ats';
const PER_REQUEST_TIMEOUT_MS = 15000;
const POLITE_DELAY_MS = 250;

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

// ─── Greenhouse ─────────────────────────────────────────────
async function fetchGreenhouse(slug, displayName, signal) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
  const resp = await fetchWithTimeout(url, signal, PER_REQUEST_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`Greenhouse ${slug}: ${resp.status}`);
  const data = await resp.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs.map(raw => {
    const title = raw.title || '';
    const location = raw.location?.name || '';
    const description = stripHtml(raw.content || '');
    const isRemote = /remote/i.test(`${title} ${location} ${description}`);
    return normalizeJob({
      id: generateJobId(SOURCE, title, displayName),
      title,
      company: displayName,
      url: raw.absolute_url || '',
      source: SOURCE,
      datePosted: parseDate(raw.updated_at || raw.first_published),
      country: location,
      workType: determineWorkType(location, isRemote),
      description,
    });
  });
}

// ─── Lever ──────────────────────────────────────────────────
async function fetchLever(slug, displayName, signal) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const resp = await fetchWithTimeout(url, signal, PER_REQUEST_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`Lever ${slug}: ${resp.status}`);
  const postings = await resp.json();
  if (!Array.isArray(postings)) return [];

  return postings.map(raw => {
    const title = raw.text || '';
    const location = raw.categories?.location || '';
    const commitment = raw.categories?.commitment || '';
    const team = raw.categories?.team || '';
    const description = stripHtml(raw.descriptionPlain || raw.description || '');
    const isRemote = /remote/i.test(`${title} ${location} ${commitment} ${description}`);
    return normalizeJob({
      id: generateJobId(SOURCE, title, displayName),
      title,
      company: displayName,
      url: raw.hostedUrl || raw.applyUrl || '',
      source: SOURCE,
      datePosted: raw.createdAt ? formatUnixDate(Math.floor(raw.createdAt / 1000)) : new Date().toISOString().split('T')[0],
      country: extractCountry(location) || location,
      workType: determineWorkType([location, commitment, team].join(' '), isRemote),
      description,
    });
  });
}

// ─── Ashby ──────────────────────────────────────────────────
async function fetchAshby(slug, displayName, signal) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`;
  const resp = await fetchWithTimeout(url, signal, PER_REQUEST_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`Ashby ${slug}: ${resp.status}`);
  const data = await resp.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs.map(raw => {
    const title = raw.title || '';
    const location = raw.locationName || raw.location || '';
    const description = stripHtml(raw.descriptionHtml || raw.descriptionPlain || '');
    const isRemote = raw.isRemote === true || /remote/i.test(`${title} ${location} ${description}`);
    let workType = determineWorkType(location, isRemote);
    const employmentType = (raw.employmentType || '').toLowerCase();
    if (employmentType.includes('hybrid')) workType = 'hybrid';
    return normalizeJob({
      id: generateJobId(SOURCE, title, displayName),
      title,
      company: displayName,
      url: raw.jobUrl || raw.applyUrl || '',
      source: SOURCE,
      datePosted: parseDate(raw.publishedAt || raw.updatedAt),
      country: extractCountry(location) || location,
      workType,
      description,
    });
  });
}

// ─── Workable ───────────────────────────────────────────────
async function fetchWorkable(slug, displayName, signal) {
  const url = `https://apply.workable.com/api/v3/accounts/${encodeURIComponent(slug)}/jobs?limit=100`;
  const resp = await fetchWithTimeout(url, signal, PER_REQUEST_TIMEOUT_MS, {
    headers: { 'Accept': 'application/json' },
  });
  if (!resp.ok) throw new Error(`Workable ${slug}: ${resp.status}`);
  const data = await resp.json();
  const jobs = Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs.map(raw => {
    const title = raw.title || '';
    const location = raw.location
      ? [raw.location.city, raw.location.region, raw.location.country].filter(Boolean).join(', ')
      : (raw.locations?.[0] || '');
    const isRemote = raw.remote === true || raw.workplace === 'remote' || /remote/i.test(`${title} ${location}`);
    const description = stripHtml(raw.description || raw.full_description || '');
    return normalizeJob({
      id: generateJobId(SOURCE, title, displayName),
      title,
      company: displayName,
      url: raw.url || raw.application_url || (raw.shortcode ? `https://apply.workable.com/${slug}/j/${raw.shortcode}/` : ''),
      source: SOURCE,
      datePosted: parseDate(raw.published_on || raw.created_at),
      country: extractCountry(location) || location,
      workType: determineWorkType(location, isRemote),
      description,
    });
  });
}

const PROVIDERS = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  workable: fetchWorkable,
};

// Light concurrency control so we don't open 25 sockets at once.
async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchCompaniesATS(signal) {
  const companies = JOB_PROFILE.atsCompanies || [];
  if (companies.length === 0) return [];

  const settled = await runWithConcurrency(companies, 4, async (entry) => {
    if (signal?.aborted) return [];
    const fn = PROVIDERS[entry.provider];
    if (!fn) {
      console.warn(`[Jobs] Unknown ATS provider "${entry.provider}" for ${entry.slug}`);
      return [];
    }
    try {
      const jobs = await fn(entry.slug, entry.name || entry.slug, signal);
      await abortableDelay(POLITE_DELAY_MS, signal).catch(() => {});
      return jobs;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.warn(`[Jobs] ATS ${entry.provider}/${entry.slug} failed: ${err.message}`);
      return [];
    }
  });

  const all = settled.flat();
  return all.filter(j => {
    if (!j.title) return false;
    if (!matchesRole(j.title)) return false;
    if (!isInRegion(j.country)) return false;
    if (JOB_PROFILE.requireRemote && j.workType && j.workType !== 'remote' && j.workType !== 'hybrid') return false;
    return true;
  });
}

module.exports = { fetchCompaniesATS };
