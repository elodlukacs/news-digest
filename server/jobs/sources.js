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

// ─── RemoteOK ───────────────────────────────────────────────

async function fetchRemoteOK(signal) {
  const resp = await fetchWithTimeout('https://remoteok.com/api', signal);
  if (!resp.ok) throw new Error(`RemoteOK returned ${resp.status}`);

  const data = await resp.json();
  const rawJobs = Array.isArray(data) ? data.filter(j => j.position) : [];

  return rawJobs.map(raw => normalizeJob({
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
    jobs.push(normalizeJob({
      id: generateJobId('weworkremotely', title, company),
      title,
      company,
      url: item.link || '',
      source: 'weworkremotely',
      datePosted: parseDate(item.pubDate),
      country: item.country || item.region || '',
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
        country: (raw.locationRestrictions && raw.locationRestrictions[0]) || '',
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
  return (data.jobs || []).map(raw => normalizeJob({
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
      allJobs.push(normalizeJob({
        id: generateJobId('arbeitnow', raw.title, raw.company_name),
        title: raw.title,
        company: raw.company_name || 'Unknown',
        url: raw.url || '',
        source: 'arbeitnow',
        datePosted: raw.created_at ? formatUnixDate(raw.created_at) : new Date().toISOString().split('T')[0],
        country: extractCountry(raw.location) || 'Germany',
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

const EMEA_COUNTRIES = [
  'United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Ireland',
  'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Switzerland',
  'Austria', 'Portugal', 'Greece', 'Czech', 'Czechia', 'Romania', 'Hungary',
  'Israel', 'UAE', 'United Arab Emirates', 'Saudi Arabia', 'Egypt', 'South Africa',
  'Nigeria', 'Kenya', 'Morocco', 'Algeria', 'Tunisia', 'Turkey',
  'Europe', 'EMEA', 'Middle East', 'Africa',
];

const EMEA_SEARCH_TERMS = [
  'Remote', 'Europe', 'Germany', 'UK', 'United Kingdom', 'France',
  'Spain', 'Italy', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Sweden',
];

function isEMEAJob(location) {
  if (!location || location.trim() === '') return true;
  const lower = location.toLowerCase();
  if (lower.includes('united states') || lower.includes('usa') || lower.includes('canada') ||
      lower.includes('mexico') || lower.includes('brazil') || lower.includes('argentina') ||
      lower.includes('colombia') || lower.includes('chile') || lower.includes('america')) {
    return false;
  }
  return EMEA_COUNTRIES.some(c => lower.includes(c.toLowerCase()));
}

async function fetchLinkedIn(signal) {
  const jobs = [];
  const seenIds = new Set();

  for (const searchTerm of EMEA_SEARCH_TERMS) {
    if (signal?.aborted) break;
    if (jobs.length >= 60) break;

    for (let page = 0; page < 10; page++) {
      if (signal?.aborted || jobs.length >= 60) break;

      const params = new URLSearchParams({
        keywords: 'Frontend',
        location: searchTerm,
        f_TPR: 'r86400',
        f_WT: '2',
        start: String(page * 10),
      });

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
          if (!isEMEAJob(jobLocation)) continue;

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

// ─── Indeed ─────────────────────────────────────────────────

async function fetchIndeed(signal) {
  const jobs = [];
  const params = new URLSearchParams({
    q: 'senior frontend developer',
    l: 'Remote',
    fromage: '7',
    remotejob: 'remotedt',
  });

  try {
    const resp = await fetchWithTimeout(`https://www.indeed.com/jobs?${params}`, signal, 15000);
    if (!resp.ok) throw new Error(`Indeed returned ${resp.status}`);

    const html = await resp.text();
    const scriptMatches = html.match(/<script[^>]*id="mosaic-data"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);

    if (scriptMatches) {
      try {
        const jsonData = JSON.parse(scriptMatches[1]);
        const jobCards = jsonData?.metaAttributes?.mosaicServerJobResults?.components?.jobCardsModuleInterests?.jobCards || jsonData?.jobCards || [];
        for (const card of jobCards.slice(0, 25)) {
          const title = card.jobTitle || card.title || '';
          const company = card.company || card.companyName || 'Unknown';
          const jobKey = card.jobkey || card.jobKey || '';
          if (!title || !jobKey) continue;
          const location = card.formattedLocation || card.location || '';
          jobs.push(normalizeJob({
            id: generateJobId('indeed', title, company),
            title, company,
            url: `https://www.indeed.com/viewjob?jk=${jobKey}`,
            source: 'indeed',
            datePosted: card.date || new Date().toISOString().split('T')[0],
            country: extractCountry(location),
            workType: determineWorkType(location, true),
          }));
        }
      } catch {}
    }

    if (jobs.length === 0) {
      const jobMatches = html.match(/<li[^>]*class="[^"]*jobsearch-ResultsList-li[^"]*"[^>]*data-jk="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g);
      if (jobMatches) {
        for (const m of jobMatches.slice(0, 25)) {
          const jkMatch = m.match(/data-jk="([^"]+)"/);
          const titleMatch = m.match(/<h2[^>]*class="[^"]*jobTitle[^"]*"[^>]*>(.*?)<\/h2>/);
          const companyMatch = m.match(/<span[^>]*class="[^"]*companyName[^"]*"[^>]*>(.*?)<\/span>/);
          const jk = jkMatch?.[1] || '';
          const title = titleMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
          const company = companyMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || 'Unknown';
          if (!title || !jk) continue;
          jobs.push(normalizeJob({
            id: generateJobId('indeed', title, company),
            title, company,
            url: `https://www.indeed.com/viewjob?jk=${jk}`,
            source: 'indeed',
            datePosted: new Date().toISOString().split('T')[0],
            country: '',
            workType: determineWorkType('', true),
          }));
        }
      }
    }
    return jobs;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.error('Indeed fetch error:', error.message);
    return [];
  }
}

// ─── Hacker News ────────────────────────────────────────────

const HN_API = 'https://hacker-news.firebaseio.com/v0';
const HN_PATTERN = /(?:frontend|front-end|react|vue|angular|javascript|typescript|web developer|ui developer)/i;

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

      const lines = item.text.split('\n').filter(l => l.trim().length > 20 && !l.trim().startsWith('#'));
      for (const line of lines) {
        const trimmed = line.trim().replace(/<[^>]*>/g, '');
        if (trimmed.length < 5) continue;

        let url = '';
        let title = trimmed;
        const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) { url = urlMatch[1]; title = trimmed.replace(url, '').trim(); }

        const company = extractCompanyFromTitle(title);
        jobs.push(normalizeJob({
          id: generateJobId('hackernews', title, company || 'Unknown'),
          title, company: company || 'Unknown',
          url: url || item.url || '',
          source: 'hackernews',
          datePosted: new Date(item.time * 1000).toISOString().split('T')[0],
          country: extractCountryFromText(trimmed),
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

// ─── Fetch All ──────────────────────────────────────────────

const ALL_SOURCES = [
  { name: 'remoteok', fn: fetchRemoteOK },
  { name: 'weworkremotely', fn: fetchWeWorkRemotely },
  { name: 'himalayas', fn: fetchHimalayas },
  { name: 'remotive', fn: fetchRemotive },
  { name: 'arbeitnow', fn: fetchArbeitnow },
  { name: 'linkedin', fn: fetchLinkedIn },
  { name: 'indeed', fn: fetchIndeed },
  { name: 'hackernews', fn: fetchHackerNews },
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
