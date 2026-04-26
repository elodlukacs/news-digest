const {
  fetchWithTimeout,
  abortableDelay,
  generateJobId,
  normalizeJob,
  formatUnixDate,
  extractCountry,
  determineWorkType,
  parseDate,
} = require('./common');
const {
  JOB_PROFILE,
  isInRegion,
  matchesRole,
  linkedInExperienceFilter,
} = require('./profile');
const { fetchCompaniesATS } = require('./sources-ats');

// ─── RemoteOK ───────────────────────────────────────────────

async function fetchRemoteOK(signal) {
  const resp = await fetchWithTimeout('https://remoteok.com/api', signal);
  if (!resp.ok) throw new Error(`RemoteOK returned ${resp.status}`);

  const data = await resp.json();
  const rawJobs = Array.isArray(data) ? data.filter(j => j.position) : [];

  return rawJobs
    .filter(raw => matchesRole(raw.position) && isInRegion(raw.location))
    .map(raw => normalizeJob({
      id: generateJobId('remoteok', raw.position, raw.company),
      title: raw.position,
      company: raw.company || 'Unknown',
      url: raw.url || (raw.id ? `https://remoteok.com/remote-jobs/${raw.id}` : ''),
      source: 'remoteok',
      datePosted: raw.epoch ? formatUnixDate(raw.epoch) : (raw.date || new Date().toISOString().split('T')[0]),
      country: extractCountry(raw.location),
      workType: determineWorkType(raw.location, true, raw.tags),
      description: raw.description,
    }));
}

// ─── WeWorkRemotely ─────────────────────────────────────────

function parseWWRTitle(fullTitle) {
  const parts = fullTitle.split(':');
  if (parts.length >= 2) return { company: parts[0].trim(), title: parts.slice(1).join(':').trim() };
  const atMatch = fullTitle.match(/(.+)\s+at\s+(.+)/);
  if (atMatch) return { title: atMatch[1].trim(), company: atMatch[2].trim() };
  return { title: fullTitle, company: 'Unknown' };
}

async function fetchWeWorkRemotely(signal) {
  const resp = await fetchWithTimeout('https://weworkremotely.com/remote-jobs.rss', signal);
  if (!resp.ok) throw new Error(`WeWorkRemotely returned ${resp.status}`);

  const xml = await resp.text();
  // Simple XML parsing — extract items
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'));
      return m ? m[1].trim() : '';
    };
    items.push({
      title: getTag('title'),
      link: getTag('link'),
      pubDate: getTag('pubDate'),
      description: getTag('description'),
      region: getTag('region'),
      country: getTag('country'),
      type: getTag('type'),
      category: getTag('category'),
    });
  }

  const jobs = [];
  for (const item of items) {
    const { title, company } = parseWWRTitle(item.title || '');
    if (!title || !company) continue;
    if (!matchesRole(title)) continue;
    const location = item.country || item.region || '';
    if (!isInRegion(location)) continue;
    jobs.push(normalizeJob({
      id: generateJobId('weworkremotely', title, company),
      title,
      company,
      url: item.link || '',
      source: 'weworkremotely',
      datePosted: parseDate(item.pubDate),
      country: location,
      workType: determineWorkType([item.type, item.category, item.title].filter(Boolean).join(' '), true),
      description: item.description,
    }));
  }
  return jobs;
}

// ─── Himalayas ──────────────────────────────────────────────

async function fetchHimalayas(signal) {
  const allJobs = [];
  let offset = 0;

  for (let page = 0; page < 5; page++) {
    if (signal?.aborted) break;
    const resp = await fetchWithTimeout(`https://himalayas.app/jobs/api?limit=20&offset=${offset}`, signal);
    if (!resp.ok) throw new Error(`Himalayas returned ${resp.status}`);

    const data = await resp.json();
    if (!data.jobs || data.jobs.length === 0) break;

    for (const raw of data.jobs) {
      if (!matchesRole(raw.title)) continue;
      const country = (raw.locationRestrictions && raw.locationRestrictions[0]) || '';
      if (!isInRegion(country)) continue;
      const emp = (raw.employmentType || '').toLowerCase();
      let workType = 'remote';
      if (emp.includes('hybrid')) workType = 'hybrid';
      else if (emp.includes('onsite') || emp.includes('on-site')) workType = 'onsite';

      allJobs.push(normalizeJob({
        id: generateJobId('himalayas', raw.title, raw.companyName),
        title: raw.title,
        company: raw.companyName || 'Unknown',
        url: raw.applicationLink || '',
        source: 'himalayas',
        datePosted: raw.pubDate ? formatUnixDate(raw.pubDate) : new Date().toISOString().split('T')[0],
        country,
        workType,
      }));
    }

    offset += data.jobs.length;
    if (offset >= data.totalCount) break;
    await abortableDelay(1000, signal);
  }
  return allJobs;
}

// ─── Remotive ───────────────────────────────────────────────

async function fetchRemotive(signal) {
  const resp = await fetchWithTimeout('https://remotive.com/api/remote-jobs?category=software-dev&limit=50', signal);
  if (!resp.ok) throw new Error(`Remotive returned ${resp.status}`);

  const data = await resp.json();
  return (data.jobs || [])
    .filter(raw => matchesRole(raw.title) && isInRegion(raw.candidate_required_location || ''))
    .map(raw => normalizeJob({
      id: generateJobId('remotive', raw.title, raw.company_name),
      title: raw.title,
      company: raw.company_name || 'Unknown',
      url: raw.url || '',
      source: 'remotive',
      datePosted: parseDate(raw.publication_date),
      country: extractCountry(raw.candidate_required_location || ''),
      workType: determineWorkType(raw.candidate_required_location || '', true, raw.tags),
    }));
}

// ─── Arbeitnow ──────────────────────────────────────────────

async function fetchArbeitnow(signal) {
  const allJobs = [];
  let page = 1;

  for (let i = 0; i < 20; i++) {
    if (signal?.aborted) break;
    const resp = await fetchWithTimeout(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, signal);
    if (!resp.ok) throw new Error(`Arbeitnow returned ${resp.status}`);

    const data = await resp.json();
    if (!data.data || data.data.length === 0) break;

    for (const raw of data.data) {
      if (!matchesRole(raw.title)) continue;
      const country = extractCountry(raw.location) || 'Germany';
      if (!isInRegion(country)) continue;
      if (JOB_PROFILE.requireRemote && !raw.remote) continue;
      allJobs.push(normalizeJob({
        id: generateJobId('arbeitnow', raw.title, raw.company_name),
        title: raw.title,
        company: raw.company_name || 'Unknown',
        url: raw.url || '',
        source: 'arbeitnow',
        datePosted: raw.created_at ? formatUnixDate(raw.created_at) : new Date().toISOString().split('T')[0],
        country,
        workType: raw.remote ? 'remote' : 'onsite',
        description: raw.description,
      }));
    }

    page++;
    if (page > (data.meta?.last_page || 1)) break;
    await abortableDelay(1500, signal);
  }
  return allJobs;
}

// ─── LinkedIn ───────────────────────────────────────────────

async function fetchLinkedIn(signal) {
  const jobs = [];
  const seenIds = new Set();
  const keyword = JOB_PROFILE.roleKeywords[0] || 'Frontend';
  const expFilter = linkedInExperienceFilter();

  for (const searchTerm of JOB_PROFILE.regionSearchTerms) {
    if (signal?.aborted) break;
    if (jobs.length >= 60) break;

    for (let page = 0; page < 10; page++) {
      if (signal?.aborted || jobs.length >= 60) break;

      const paramsObj = {
        keywords: keyword,
        location: searchTerm,
        f_TPR: 'r86400',
        start: String(page * 10),
      };
      if (JOB_PROFILE.requireRemote) paramsObj.f_WT = '2';
      if (expFilter) paramsObj.f_E = expFilter;
      const params = new URLSearchParams(paramsObj);

      try {
        const resp = await fetchWithTimeout(
          `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`, signal
        );
        if (!resp.ok) { if (resp.status === 429) break; throw new Error(`LinkedIn returned ${resp.status}`); }

        const html = await resp.text();
        const cardRegex = /<div[^>]*class="[^"]*base-search-card[^"]*"[^>]*data-entity-urn="urn:li:jobPosting:(\d+)"[^>]*>([\s\S]*?)<\/div>\s*<\/li>/g;

        let match;
        let pageCount = 0;
        while ((match = cardRegex.exec(html)) !== null) {
          const cardHtml = match[2];
          const jobId = match[1];
          if (!cardHtml) continue;

          const titleMatch = cardHtml.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
          let title = titleMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
          if (!title) {
            const srMatch = cardHtml.match(/<span[^>]*class="sr-only"[^>]*>([\s\S]*?)<\/span>/);
            title = srMatch?.[1]?.trim() || '';
          }

          const companyMatch = cardHtml.match(/<a[^>]*class="hidden-nested-link"[^>]*>([^<]+)<\/a>/);
          const company = companyMatch?.[1]?.trim() || 'Unknown';

          const locMatch = cardHtml.match(/<span[^>]*class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/);
          const jobLocation = locMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';

          const dateMatch = cardHtml.match(/<time[^>]*class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"[^>]*>/);
          const datePosted = dateMatch?.[1]?.split('T')[0] || new Date().toISOString().split('T')[0];

          const urlMatch = cardHtml.match(/href="(https:\/\/[^"]+linkedin\.com\/jobs\/view\/[^"]+)"/);
          let jobUrl = urlMatch?.[1] || `https://www.linkedin.com/jobs/view/${jobId}`;
          if (jobUrl.includes('?')) jobUrl = jobUrl.split('?')[0];

          if (!title || title.length < 3) continue;
          const jobKey = `${title}-${company}`;
          if (seenIds.has(jobKey)) continue;
          seenIds.add(jobKey);
          if (!isInRegion(jobLocation)) continue;

          jobs.push(normalizeJob({
            id: generateJobId('linkedin', title, company),
            title, company, url: jobUrl, source: 'linkedin',
            datePosted, country: jobLocation,
            workType: determineWorkType(jobLocation, jobLocation.toLowerCase().includes('remote')),
          }));
          pageCount++;
        }

        if (pageCount === 0) break;
        if (page < 9) await abortableDelay(800, signal);
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        break;
      }
    }
  }
  return jobs;
}

// ─── Hacker News ────────────────────────────────────────────

const HN_API = 'https://hacker-news.firebaseio.com/v0';

function buildHnPattern() {
  const tokens = [...JOB_PROFILE.roleKeywords, ...JOB_PROFILE.stack]
    .map(k => k.toLowerCase().replace(/[.+*?^$()[\]{}|\\]/g, '\\$&'))
    .filter(Boolean);
  if (tokens.length === 0) return /frontend|react|web developer/i;
  return new RegExp(`(?:${tokens.join('|')})`, 'i');
}
const HN_PATTERN = buildHnPattern();

function extractCompanyFromTitle(title) {
  const patterns = [
    /at\s+([A-Z][A-Za-z\s&]+?)(?:\s+[-|]|\s+(?:Remote|Hiring|Job|Position|Software|Engineer|Developer|Team|$))/i,
    /^-?\s*([A-Z][A-Za-z\s&]+?)\s+is\s+(?:hiring|looking)/i,
    /^([A-Z][A-Za-z\s&]+?)\s*[-|]\s*/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) {
      const company = match[1].trim();
      if (company.length > 2 && company.length < 40) return company;
    }
  }
  return '';
}

function extractCountryFromText(text) {
  const countries = [
    'United States', 'US', 'USA', 'UK', 'England', 'Scotland', 'Wales',
    'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Poland', 'Sweden',
    'Canada', 'Australia', 'New Zealand', 'Japan', 'Singapore', 'India',
    'Brazil', 'Argentina', 'Mexico', 'Worldwide', 'EU', 'EMEA', 'APAC',
  ];
  for (const country of countries) {
    if (text.toLowerCase().includes(country.toLowerCase())) return country;
  }
  return '';
}

async function fetchHackerNews(signal) {
  const jobs = [];

  try {
    const topResp = await fetchWithTimeout(`${HN_API}/topstories.json`, signal);
    if (!topResp.ok) throw new Error(`HN API returned ${topResp.status}`);
    const topIds = await topResp.json();

    const oneMonthAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;
    const itemPromises = topIds.slice(0, 30).map(async id => {
      try {
        const resp = await fetchWithTimeout(`${HN_API}/item/${id}.json`, signal, 5000);
        if (!resp.ok) return null;
        return await resp.json();
      } catch { return null; }
    });

    const items = await Promise.all(itemPromises);

    for (const item of items) {
      if (!item || item.type !== 'job') continue;
      if (item.time < oneMonthAgo) continue;
      if (!item.text) continue;
      if (!HN_PATTERN.test(item.text)) continue;

      const lines = item.text.split('\n').filter(l => l.trim().length > 20 && !l.trim().startsWith('#'));
      for (const line of lines) {
        const trimmed = line.trim().replace(/<[^>]*>/g, '');
        if (trimmed.length < 5) continue;
        if (!HN_PATTERN.test(trimmed)) continue;

        let url = '';
        let title = trimmed;
        const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) { url = urlMatch[1]; title = trimmed.replace(url, '').trim(); }

        const country = extractCountryFromText(trimmed);
        if (!isInRegion(country)) continue;

        const company = extractCompanyFromTitle(title);
        jobs.push(normalizeJob({
          id: generateJobId('hackernews', title, company || 'Unknown'),
          title, company: company || 'Unknown',
          url: url || item.url || '',
          source: 'hackernews',
          datePosted: new Date(item.time * 1000).toISOString().split('T')[0],
          country,
          workType: determineWorkType(trimmed, trimmed.toLowerCase().includes('remote')),
        }));
      }
    }

    // Fallback: Ask HN hiring threads
    if (jobs.length === 0) {
      const askResp = await fetchWithTimeout(`${HN_API}/item/45438503.json`, signal);
      if (askResp.ok) {
        const askData = await askResp.json();
        if (askData?.kids) {
          for (const kidId of askData.kids.slice(0, 20)) {
            try {
              const resp = await fetchWithTimeout(`${HN_API}/item/${kidId}.json`, signal, 5000);
              if (!resp.ok) continue;
              const kid = await resp.json();
              if (kid?.text && HN_PATTERN.test(kid.text)) {
                const lines = kid.text.split('\n').filter(l => l.trim().length > 20);
                for (const line of lines) {
                  const clean = line.trim().replace(/<[^>]*>/g, '');
                  if (clean.length < 5) continue;
                  const company = extractCompanyFromTitle(clean);
                  jobs.push(normalizeJob({
                    id: generateJobId('hackernews', clean, company || 'Unknown'),
                    title: clean, company: company || 'Unknown',
                    url: '', source: 'hackernews',
                    datePosted: new Date(kid.time * 1000).toISOString().split('T')[0],
                    country: extractCountryFromText(clean),
                    workType: determineWorkType(clean, clean.toLowerCase().includes('remote')),
                  }));
                }
              }
              await abortableDelay(100, signal);
            } catch {}
          }
        }
      }
    }

    return jobs;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.error('HackerNews fetch error:', error.message);
    return [];
  }
}

// ─── MeetFrank ──────────────────────────────────────────────

const MEETFRANK_MAX_AGE_DAYS = 14;

async function fetchMeetFrank(signal) {
  const params = new URLSearchParams({
    pageSize: '100',
    q: (JOB_PROFILE.roleKeywords[0] || 'frontend') + ' developer',
    skills: JOB_PROFILE.stack.slice(0, 4).join(',').toLowerCase(),
    seniority: (JOB_PROFILE.seniorityLevels[0] || 'senior').toLowerCase(),
  });
  const resp = await fetchWithTimeout(
    `https://api.meetfrank.com/ai/jobs?${params}`,
    signal,
    30000,
    { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } },
  );
  if (!resp.ok) throw new Error(`MeetFrank returned ${resp.status}`);

  const data = await resp.json();
  const cutoff = Date.now() - MEETFRANK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  return (data.jobs || [])
    .filter(raw => {
      if (!raw.publishedAt) return false;
      return new Date(raw.publishedAt).getTime() >= cutoff;
    })
    .map(raw => {
      const remoteType = raw.remote?.type || '';
      const isRemote = remoteType === 'FULL_REMOTE';
      return normalizeJob({
        id: generateJobId('meetfrank', raw.title, raw.company),
        title: raw.title,
        company: raw.company || 'Unknown',
        url: raw.applyUrl || '',
        source: 'meetfrank',
        datePosted: parseDate(raw.publishedAt),
        country: extractCountry(raw.location || ''),
        workType: determineWorkType(
          [raw.location, remoteType, raw.speciality].join(' '),
          isRemote,
          raw.skills,
        ),
        description: raw.description,
      });
    });
}

// ─── Real Work From Anywhere ─────────────────────────────────

async function fetchRealWorkFromAnywhere(signal) {
  const resp = await fetchWithTimeout(
    'https://www.realworkfromanywhere.com/remote-frontend-jobs/rss.xml',
    signal,
  );
  if (!resp.ok) throw new Error(`RealWorkFromAnywhere returned ${resp.status}`);

  const xml = await resp.text();
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'));
      return m ? m[1].trim() : '';
    };
    items.push({ title: getTag('title'), link: getTag('link'), pubDate: getTag('pubDate'), description: getTag('description'), company: getTag('author') });
  }

  return items
    .filter(item => item.title && item.link)
    .map(item => {
      const titleParts = item.title.split(' at ');
      const title = titleParts[0]?.trim() || item.title;
      const company = item.company || titleParts[1]?.trim() || 'Unknown';
      return normalizeJob({
        id: generateJobId('realworkfromanywhere', title, company),
        title, company,
        url: item.link,
        source: 'realworkfromanywhere',
        datePosted: parseDate(item.pubDate),
        country: 'Worldwide',
        workType: 'remote',
        description: item.description,
      });
    });
}

// ─── Working Nomads ──────────────────────────────────────────

async function fetchWorkingNomads(signal) {
  const resp = await fetchWithTimeout(
    'https://www.workingnomads.com/api/exposed_jobs/',
    signal,
  );
  if (!resp.ok) throw new Error(`WorkingNomads returned ${resp.status}`);

  const data = await resp.json();
  const jobs = Array.isArray(data) ? data : [];

  return jobs
    .filter(raw => {
      const cat = (raw.category_name || '').toLowerCase();
      const isDev = cat.includes('develop') || cat.includes('engineer') || cat.includes('software') || cat.includes('frontend');
      if (!isDev) return false;
      if (!matchesRole(raw.title)) return false;
      return isInRegion(raw.location || '');
    })
    .map(raw => normalizeJob({
      id: generateJobId('workingnomads', raw.title, raw.company_name),
      title: raw.title,
      company: raw.company_name || 'Unknown',
      url: raw.url || '',
      source: 'workingnomads',
      datePosted: parseDate(raw.pub_date),
      country: extractCountry(raw.location || ''),
      workType: determineWorkType(raw.location || '', true),
      description: '',
    }));
}

// ─── Adzuna ──────────────────────────────────────────────────

async function fetchAdzuna(signal) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    console.warn('Adzuna: ADZUNA_APP_ID / ADZUNA_APP_KEY not set, skipping');
    return [];
  }

  const allJobs = [];
  const seniorityWord = (JOB_PROFILE.seniorityLevels[0] || 'senior').toLowerCase();
  const roleWord = (JOB_PROFILE.roleKeywords[0] || 'frontend').toLowerCase();
  const stackWord = (JOB_PROFILE.stack[0] || 'react').toLowerCase();
  const what = `${seniorityWord} ${roleWord} ${stackWord}`.trim();
  // Adzuna's `what_exclude` is a single space-separated token list.
  // We only emit unambiguous single-word negatives — multi-word excludes like
  // "data engineer" would split into "engineer" and wrongly cut frontend roles.
  const SAFE_EXCLUDE_TOKENS = new Set([
    'devops', 'sre', 'wordpress', 'php', 'salesforce', 'sap', 'android', 'ios',
    'embedded', 'firmware', 'mainframe',
  ]);
  const whatExclude = JOB_PROFILE.excludeKeywords
    .flatMap(k => k.toLowerCase().split(/\s+/))
    .filter(k => SAFE_EXCLUDE_TOKENS.has(k))
    .filter((k, i, a) => a.indexOf(k) === i)
    .join(' ');

  for (const country of JOB_PROFILE.adzunaCountries) {
    if (signal?.aborted) break;
    try {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: '50',
        what,
        what_exclude: whatExclude,
        sort_by: 'date',
      });

      const resp = await fetchWithTimeout(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
        signal,
      );
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) throw new Error(`Adzuna auth failed (${resp.status})`);
        console.warn(`Adzuna ${country}: ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      for (const raw of (data.results || [])) {
        const location = [raw.location?.area?.slice(-1)[0], raw.location?.area?.[0]].filter(Boolean).join(', ');
        const isRemote = (raw.title + ' ' + (raw.description || '')).toLowerCase().includes('remote');
        allJobs.push(normalizeJob({
          id: generateJobId('adzuna', raw.title, raw.company?.display_name),
          title: raw.title,
          company: raw.company?.display_name || 'Unknown',
          url: raw.redirect_url || '',
          source: 'adzuna',
          datePosted: parseDate(raw.created),
          country: location,
          workType: determineWorkType(location, isRemote),
          description: raw.description || '',
        }));
      }

      await abortableDelay(500, signal);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      console.warn(`Adzuna ${country} error:`, error.message);
    }
  }

  return allJobs;
}

// ─── Fetch All ──────────────────────────────────────────────

const ALL_SOURCES = [
  { name: 'remoteok', fn: fetchRemoteOK },
  { name: 'weworkremotely', fn: fetchWeWorkRemotely },
  { name: 'himalayas', fn: fetchHimalayas },
  { name: 'remotive', fn: fetchRemotive },
  { name: 'arbeitnow', fn: fetchArbeitnow },
  { name: 'linkedin', fn: fetchLinkedIn },
  { name: 'hackernews', fn: fetchHackerNews },
  { name: 'meetfrank', fn: fetchMeetFrank },
  { name: 'realworkfromanywhere', fn: fetchRealWorkFromAnywhere },
  { name: 'workingnomads', fn: fetchWorkingNomads },
  { name: 'adzuna', fn: fetchAdzuna },
  { name: 'companies-ats', fn: fetchCompaniesATS },
];

async function fetchAllSources(signal) {
  const results = await Promise.allSettled(
    ALL_SOURCES.map(async ({ name, fn }) => {
      try {
        const jobs = await fn(signal);
        return { name, jobs, error: null };
      } catch (error) {
        return { name, jobs: [], error: error.message };
      }
    })
  );

  const sourceResults = [];
  const allJobs = [];

  for (const result of results) {
    const val = result.status === 'fulfilled' ? result.value : { name: 'unknown', jobs: [], error: result.reason?.message };
    sourceResults.push({ name: val.name, count: val.jobs.length, error: val.error });
    allJobs.push(...val.jobs);
  }

  return { jobs: allJobs, sources: sourceResults };
}

module.exports = { fetchAllSources, ALL_SOURCES };
