// Single source of truth for the job search criteria.
// All sources and the AI filter read from the same profile so the role,
// seniority, stack and region are tweakable from one place (env or this file).
//
// Defaults: Senior Frontend Developer, Remote, EMEA.

function parseList(envVal, fallback) {
  if (!envVal || typeof envVal !== 'string') return fallback;
  const parts = envVal.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : fallback;
}

function parseBool(envVal, fallback) {
  if (envVal === undefined || envVal === null || envVal === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(envVal));
}

function parseAtsCompanies(envVal, fallback) {
  if (!envVal || typeof envVal !== 'string') return fallback;
  const out = [];
  for (const raw of envVal.split(',')) {
    const entry = raw.trim();
    if (!entry) continue;
    const [provider, slug, name] = entry.split(':').map(s => s?.trim());
    if (!provider || !slug) continue;
    out.push({ provider: provider.toLowerCase(), slug, name: name || slug });
  }
  return out.length > 0 ? out : fallback;
}

// EMEA-friendly companies with public ATS job boards (no auth required).
// Keep the list small and well-known to avoid 404 noise.
const DEFAULT_ATS_COMPANIES = [
  // Greenhouse — boards-api.greenhouse.io/v1/boards/{slug}/jobs
  { provider: 'greenhouse', slug: 'gitlab',     name: 'GitLab' },
  { provider: 'greenhouse', slug: 'mozilla',    name: 'Mozilla' },
  { provider: 'greenhouse', slug: 'duckduckgo', name: 'DuckDuckGo' },
  { provider: 'greenhouse', slug: 'remotecom',  name: 'Remote' },
  { provider: 'greenhouse', slug: 'doctolib',   name: 'Doctolib' },
  { provider: 'greenhouse', slug: 'pitch',      name: 'Pitch' },
  { provider: 'greenhouse', slug: 'wise',       name: 'Wise' },
  { provider: 'greenhouse', slug: 'klaviyo',    name: 'Klaviyo' },
  // Lever — api.lever.co/v0/postings/{slug}?mode=json
  { provider: 'lever',      slug: 'plaid',          name: 'Plaid' },
  { provider: 'lever',      slug: 'kraken',         name: 'Kraken' },
  { provider: 'lever',      slug: 'getyourguide',   name: 'GetYourGuide' },
  { provider: 'lever',      slug: 'gohenry',        name: 'GoHenry' },
  // Ashby — api.ashbyhq.com/posting-api/job-board/{slug}
  { provider: 'ashby',      slug: 'vercel',     name: 'Vercel' },
  { provider: 'ashby',      slug: 'supabase',   name: 'Supabase' },
  { provider: 'ashby',      slug: 'linear',     name: 'Linear' },
  { provider: 'ashby',      slug: 'posthog',    name: 'PostHog' },
  { provider: 'ashby',      slug: 'n8n',        name: 'n8n' },
  { provider: 'ashby',      slug: 'mistral',    name: 'Mistral AI' },
  // Workable — apply.workable.com/api/v3/accounts/{slug}/jobs
  { provider: 'workable',   slug: 'personio',   name: 'Personio' },
  { provider: 'workable',   slug: 'intercom',   name: 'Intercom' },
];

const DEFAULT_PROFILE = {
  role: 'Senior Frontend Developer',
  seniorityLevels: ['senior', 'staff', 'lead', 'principal', 'sr.'],
  // Used as keyword query strings on sources that take a `keywords=` parameter.
  // Order matters — first entry is the primary fallback.
  roleKeywords: ['Frontend', 'Front End', 'React', 'UI Engineer', 'Web Engineer', 'Web Developer'],
  stack: ['React', 'TypeScript', 'JavaScript', 'Next.js', 'Vue', 'Angular', 'Svelte', 'CSS', 'HTML'],
  excludeKeywords: [
    'devops', 'sre', 'data engineer', 'data scientist', 'machine learning',
    'ml engineer', 'android developer', 'ios developer', 'mobile native',
    'wordpress only', 'salesforce', 'sap', 'qa engineer',
  ],
  region: 'EMEA',
  regionCountries: [
    'United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Ireland',
    'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium',
    'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Switzerland',
    'Austria', 'Portugal', 'Greece', 'Czech', 'Czechia', 'Romania', 'Hungary',
    'Bulgaria', 'Slovakia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania',
    'Croatia', 'Serbia', 'Ukraine', 'Cyprus', 'Malta', 'Luxembourg',
    'Israel', 'UAE', 'United Arab Emirates', 'Saudi Arabia', 'Egypt',
    'South Africa', 'Nigeria', 'Kenya', 'Morocco', 'Algeria', 'Tunisia', 'Turkey',
    'Europe', 'EMEA', 'Middle East', 'Africa',
    // Generic "fully remote" markers — keep when not paired with an excluded region
    'Worldwide', 'Anywhere', 'Remote', 'EU', 'EEA',
  ],
  regionExclusions: [
    'united states', 'usa', 'us only', 'us-only', 'us based', 'us-based',
    'canada', 'mexico', 'brazil', 'argentina', 'colombia', 'chile', 'america',
    'apac', 'singapore', 'india', 'indonesia', 'philippines', 'vietnam',
    'china', 'japan', 'korea', 'australia', 'new zealand',
  ],
  regionSearchTerms: [
    'Remote', 'Europe', 'Germany', 'UK', 'United Kingdom', 'France',
    'Spain', 'Italy', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Sweden',
  ],
  adzunaCountries: ['gb', 'de', 'fr', 'nl', 'se', 'at', 'pl', 'es', 'it', 'ch'],
  requireRemote: true,
  atsCompanies: DEFAULT_ATS_COMPANIES,
};

const JOB_PROFILE = Object.freeze({
  ...DEFAULT_PROFILE,
  role:              process.env.JOB_ROLE              || DEFAULT_PROFILE.role,
  seniorityLevels:   parseList(process.env.JOB_SENIORITY_LEVELS,    DEFAULT_PROFILE.seniorityLevels),
  roleKeywords:      parseList(process.env.JOB_ROLE_KEYWORDS,       DEFAULT_PROFILE.roleKeywords),
  stack:             parseList(process.env.JOB_STACK_KEYWORDS,      DEFAULT_PROFILE.stack),
  excludeKeywords:   parseList(process.env.JOB_EXCLUDE_KEYWORDS,    DEFAULT_PROFILE.excludeKeywords),
  region:            process.env.JOB_REGION            || DEFAULT_PROFILE.region,
  regionCountries:   parseList(process.env.JOB_REGION_COUNTRIES,    DEFAULT_PROFILE.regionCountries),
  regionExclusions:  parseList(process.env.JOB_REGION_EXCLUSIONS,   DEFAULT_PROFILE.regionExclusions),
  regionSearchTerms: parseList(process.env.JOB_REGION_SEARCH_TERMS, DEFAULT_PROFILE.regionSearchTerms),
  adzunaCountries:   parseList(process.env.JOB_ADZUNA_COUNTRIES,    DEFAULT_PROFILE.adzunaCountries),
  requireRemote:     parseBool(process.env.JOB_REQUIRE_REMOTE,      DEFAULT_PROFILE.requireRemote),
  atsCompanies:      parseAtsCompanies(process.env.JOB_ATS_COMPANIES, DEFAULT_PROFILE.atsCompanies),
});

// ─── Region / role matching helpers ─────────────────────────────

function isInRegion(location, profile = JOB_PROFILE) {
  if (profile.region === 'global') return true;
  if (!location || !location.trim()) return true;
  const lower = location.toLowerCase();
  if (profile.regionExclusions.some(c => lower.includes(c.toLowerCase()))) return false;
  return profile.regionCountries.some(c => lower.includes(c.toLowerCase()));
}

function matchesRole(title, profile = JOB_PROFILE) {
  if (!title) return false;
  const lower = title.toLowerCase();
  const positives = [...profile.roleKeywords, ...profile.stack].map(s => s.toLowerCase());
  if (!positives.some(k => lower.includes(k))) return false;
  // Drop titles that are clearly not frontend even if they mention a stack term.
  // We keep this conservative — only check obvious negatives.
  const HARD_EXCLUDES = ['backend engineer', 'backend developer', 'back-end developer'];
  if (HARD_EXCLUDES.some(k => lower.includes(k))) return false;
  return true;
}

// LinkedIn experience codes: 1=internship, 2=entry, 3=associate, 4=mid-senior,
// 5=director, 6=executive. Senior/staff/principal mostly map to 4+5.
function linkedInExperienceFilter(profile = JOB_PROFILE) {
  const wantsSenior = profile.seniorityLevels.some(s =>
    /senior|staff|lead|principal/.test(s.toLowerCase())
  );
  return wantsSenior ? '4,5,6' : '';
}

module.exports = {
  JOB_PROFILE,
  isInRegion,
  matchesRole,
  linkedInExperienceFilter,
};
