const OUTLET_RATINGS = [
  {
    id: 'ap-news',
    name: 'AP News',
    url: 'https://apnews.com',
    bias: 'Center',
    biasScore: 0,
    credibility: 92,
    factCheckGrade: 'A+',
    reliability: 'Very High',
    ownership: 'Independent nonprofit',
    coverage: 'General news, breaking news, investigative',
    strongAreas: ['Breaking news accuracy', 'Fact-based reporting', 'Wide geographic coverage'],
    weakAreas: ['Can be dry/procedural', 'Limited op-ed presence'],
    notable: 'Often sets the standard other outlets follow'
  },
  {
    id: 'reuters',
    name: 'Reuters',
    url: 'https://reuters.com',
    bias: 'Center',
    biasScore: 1,
    credibility: 91,
    factCheckGrade: 'A+',
    reliability: 'Very High',
    ownership: 'Thomson Reuters Corporation',
    coverage: 'General news, financial, international',
    strongAreas: ['Financial news expertise', 'International coverage', 'Neutral tone'],
    weakAreas: ['Business-centric at times', 'Dense writing style'],
    notable: 'Trusted by other newsrooms for factual baseline'
  },
  {
    id: 'bbc-news',
    name: 'BBC News',
    url: 'https://bbc.com/news',
    bias: 'Center-Left',
    biasScore: -2,
    credibility: 89,
    factCheckGrade: 'A',
    reliability: 'High',
    ownership: 'BBC (UK public service)',
    coverage: 'General news, international, documentary',
    strongAreas: ['International coverage', 'Documentary journalism', 'Depth features'],
    weakAreas: ['UK-centric perspective at times', 'Cultural bias in framing'],
    notable: 'Strong editorial standards, global trust'
  },
  {
    id: 'npr',
    name: 'NPR',
    url: 'https://npr.org',
    bias: 'Center-Left',
    biasScore: -3,
    credibility: 88,
    factCheckGrade: 'A',
    reliability: 'High',
    ownership: 'Independent nonprofit',
    coverage: 'General news, cultural, investigative',
    strongAreas: ['Audio/podcast journalism', 'Cultural coverage', 'Accessible language'],
    weakAreas: ['Urban bias criticism', 'Can lack counter-perspectives'],
    notable: 'Model for nonprofit journalism'
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    url: 'https://theguardian.com',
    bias: 'Left',
    biasScore: -5,
    credibility: 84,
    factCheckGrade: 'B+',
    reliability: 'High',
    ownership: 'Guardian Media Group (Scott Trust)',
    coverage: 'General news, opinion, investigative',
    strongAreas: ['Investigative journalism', 'Climate coverage', 'International coverage'],
    weakAreas: ['Clear editorial perspective', 'Opinion bleeding into news'],
    notable: 'Strong progressive editorial voice'
  },
  {
    id: 'nyt',
    name: 'New York Times',
    url: 'https://nytimes.com',
    bias: 'Center-Left',
    biasScore: -4,
    credibility: 86,
    factCheckGrade: 'A-',
    reliability: 'High',
    ownership: 'New York Times Company (public)',
    coverage: 'General news, business, culture',
    strongAreas: ['Investigative journalism', 'Business coverage', 'Cultural criticism'],
    weakAreas: ['Urban elite perspective', 'Subscription pressure sometimes shows'],
    notable: 'Sets agenda for much of media'
  },
  {
    id: 'wsj',
    name: 'Wall Street Journal',
    url: 'https://wsj.com',
    bias: 'Center-Right',
    biasScore: 4,
    credibility: 85,
    factCheckGrade: 'B+',
    reliability: 'High',
    ownership: 'News Corp (Rupert Murdoch)',
    coverage: 'Business, finance, politics',
    strongAreas: ['Business journalism', 'Market coverage', 'Economics reporting'],
    weakAreas: ['Pro-business framing', 'Murdoch ownership influence'],
    notable: 'Respected despite ownership concerns'
  },
  {
    id: 'wapo',
    name: 'Washington Post',
    url: 'https://washingtonpost.com',
    bias: 'Center-Left',
    biasScore: -3,
    credibility: 85,
    factCheckGrade: 'B+',
    reliability: 'High',
    ownership: 'Nash Holdings (Jeff Bezos)',
    coverage: 'Politics, national security, local DC',
    strongAreas: ['Political journalism', 'National security', 'Watergate legacy'],
    weakAreas: ['DC focus', 'Tech billionaire ownership questions'],
    notable: 'Still carries Watergate credibility'
  },
  {
    id: 'fox-news',
    name: 'Fox News',
    url: 'https://foxnews.com',
    bias: 'Right',
    biasScore: 7,
    credibility: 62,
    factCheckGrade: 'C',
    reliability: 'Mixed',
    ownership: 'Fox Corporation',
    coverage: 'General news, opinion, cable news',
    strongAreas: ['Conservative viewpoint representation', 'Breaking news alerts'],
    weakAreas: ['Opinion/news blur', 'Fact-check record', 'Partisan framing'],
    notable: 'High viewership, controversial editorial'
  },
  {
    id: 'breitbart',
    name: 'Breitbart News',
    url: 'https://breitbart.com',
    bias: 'Far Right',
    biasScore: 9,
    credibility: 42,
    factCheckGrade: 'D-',
    reliability: 'Low',
    ownership: 'Breitbart News Network',
    coverage: 'Political news, opinion',
    strongAreas: ['Contrarian headlines', 'Alternative perspective'],
    weakAreas: ['Fact-check record', 'Source reliability', 'Clickbait patterns'],
    notable: 'Often spreads misleading content'
  },
  {
    id: 'huffpost',
    name: 'HuffPost',
    url: 'https://huffpost.com',
    bias: 'Left',
    biasScore: -6,
    credibility: 76,
    factCheckGrade: 'B-',
    reliability: 'Medium-High',
    ownership: 'BuzzFeed Inc. (formerly Verizon)',
    coverage: 'News, politics, culture, opinion',
    strongAreas: ['Progressive voices', 'Personal essays', 'Undercovered stories'],
    weakAreas: ['Clear editorial slant', 'Quality varies wildly'],
    notable: 'Strong in certain verticals'
  },
  {
    id: 'vox',
    name: 'Vox',
    url: 'https://vox.com',
    bias: 'Left',
    biasScore: -5,
    credibility: 80,
    factCheckGrade: 'B',
    reliability: 'Medium-High',
    ownership: 'Vox Media',
    coverage: 'Policy, politics, explainers',
    strongAreas: ['Explainer journalism', 'Policy depth', 'Video content'],
    weakAreas: ['Explainer bias', 'Young progressive audience capture'],
    notable: 'Pioneered "explainer" format'
  },
  {
    id: 'drudge-report',
    name: 'Drudge Report',
    url: 'https://drudgereport.com',
    bias: 'Right',
    biasScore: 7,
    credibility: 55,
    factCheckGrade: 'D',
    reliability: 'Low',
    ownership: 'Matt Drudge (independent)',
    coverage: 'Link aggregator, headlines',
    strongAreas: ['Traffic patterns', 'Conservative curation'],
    weakAreas: ['No original content', 'Headline sensationalism', 'Link quality varies'],
    notable: 'Influential in conservative media ecosystem'
  },
  {
    id: 'abc-news',
    name: 'ABC News',
    url: 'https://abcnews.go.com',
    bias: 'Center-Left',
    biasScore: -3,
    credibility: 86,
    factCheckGrade: 'A-',
    reliability: 'High',
    ownership: 'Disney Company',
    coverage: 'General news, political, international',
    strongAreas: ['Broadcast journalism', 'Political coverage', 'Good Morning America'],
    weakAreas: ['Disney ownership questions', 'Entertainment merger concerns'],
    notable: 'Strong broadcast legacy'
  },
  {
    id: 'cbs-news',
    name: 'CBS News',
    url: 'https://cbsnews.com',
    bias: 'Center',
    biasScore: -1,
    credibility: 86,
    factCheckGrade: 'A-',
    reliability: 'High',
    ownership: 'Paramount Global',
    coverage: 'General news, political, investigative',
    strongAreas: ['Evening news tradition', 'Investigative unit', '60 Minutes'],
    weakAreas: ['Corporate ownership', 'Network pressure concerns'],
    notable: '60 Minutes sets investigative standard'
  },
  {
    id: 'nbc-news',
    name: 'NBC News',
    url: 'https://nbcnews.com',
    bias: 'Center-Left',
    biasScore: -2,
    credibility: 86,
    factCheckGrade: 'A-',
    reliability: 'High',
    ownership: 'Comcast (NBCUniversal)',
    coverage: 'General news, political, business',
    strongAreas: ['Broadcast journalism', 'Political coverage', 'Digital innovation'],
    weakAreas: ['Corporate pressure', 'Entertainment crossover'],
    notable: 'Strong digital news presence'
  },
  {
    id: 'cnn',
    name: 'CNN',
    url: 'https://cnn.com',
    bias: 'Center-Left',
    biasScore: -3,
    credibility: 76,
    factCheckGrade: 'B',
    reliability: 'Medium-High',
    ownership: 'Warner Bros. Discovery',
    coverage: 'Breaking news, political, international',
    strongAreas: ['Breaking news speed', 'International coverage', 'Fact-checking efforts'],
    weakAreas: ['Panel show culture', 'Opinion bleeding into news', 'Ratings pressure'],
    notable: 'Pioneered 24-hour news'
  },
  {
    id: 'msnbc',
    name: 'MSNBC',
    url: 'https://msnbc.com',
    bias: 'Left',
    biasScore: -6,
    credibility: 70,
    factCheckGrade: 'C+',
    reliability: 'Medium',
    ownership: 'NBCUniversal (Comcast)',
    coverage: 'Political news, opinion, cable',
    strongAreas: ['Progressive voices', 'Political analysis', 'Breaking news'],
    weakAreas: ['Opinion-focused', 'News/opinion blend', 'Partisan framing'],
    notable: 'More opinion than news at times'
  },
  {
    id: 'the-week',
    name: 'The Week',
    url: 'https://theweek.com',
    bias: 'Center',
    biasScore: 0,
    credibility: 83,
    factCheckGrade: 'B+',
    reliability: 'High',
    ownership: 'The Week Publications',
    coverage: 'News, analysis, opinion',
    strongAreas: ['Multi-perspective approach', 'Concise summaries', 'Contrarian takes'],
    weakAreas: ['Opinion-heavy', 'Snark factor'],
    notable: 'Good for getting multiple views'
  },
  {
    id: 'the-atlantic',
    name: 'The Atlantic',
    url: 'https://theatlantic.com',
    bias: 'Center-Left',
    biasScore: -3,
    credibility: 87,
    factCheckGrade: 'A-',
    reliability: 'High',
    ownership: 'Atlantic Media (Grove.Entity)',
    coverage: 'Culture, politics, international, ideas',
    strongAreas: ['Long-form journalism', 'Cultural criticism', 'Intellectual depth'],
    weakAreas: ['Elite echo chamber risk', 'Subscription focus'],
    notable: 'Respected for thought leadership'
  },
  {
    id: 'foreign-affairs',
    name: 'Foreign Affairs',
    url: 'https://foreignaffairs.com',
    bias: 'Center',
    biasScore: 1,
    credibility: 90,
    factCheckGrade: 'A',
    reliability: 'Very High',
    ownership: 'Council on Foreign Relations',
    coverage: 'International relations, geopolitics, policy',
    strongAreas: ['Expert analysis', 'Policy depth', 'Academic rigor'],
    weakAreas: ['Elite perspective', 'Dense reading', 'US-centric'],
    notable: 'Go-to for foreign policy establishment view'
  },
  {
    id: 'national-review',
    name: 'National Review',
    url: 'https://nationalreview.com',
    bias: 'Right',
    biasScore: 6,
    credibility: 78,
    factCheckGrade: 'B',
    reliability: 'Medium-High',
    ownership: 'National Review Institute',
    coverage: 'Conservatism, politics, culture',
    strongAreas: ['Establishment conservative voice', 'Policy analysis', 'Intellectual depth'],
    weakAreas: ['Partisan framing', 'Trump loyalty period'],
    notable: 'Founded by William F. Buckley Jr.'
  },
  {
    id: 'the-daily-wire',
    name: 'The Daily Wire',
    url: 'https://dailywire.com',
    bias: 'Right',
    biasScore: 8,
    credibility: 58,
    factCheckGrade: 'D+',
    reliability: 'Low-Medium',
    ownership: 'Daily Wire LLC (Ben Shapiro)',
    coverage: 'Political news, opinion, entertainment',
    strongAreas: ['Conservative commentary', 'Youth appeal', 'Entertainment ventures'],
    weakAreas: ['Fact-check record', 'One-sided framing', 'Ben Shapiro focus'],
    notable: 'Major conservative digital media player'
  },
  {
    id: 'mother-jones',
    name: 'Mother Jones',
    url: 'https://motherjones.com',
    bias: 'Left',
    biasScore: -7,
    credibility: 81,
    factCheckGrade: 'B',
    reliability: 'Medium-High',
    ownership: 'Foundation for National Progress',
    coverage: 'Investigative, progressive, political',
    strongAreas: ['Investigative journalism', 'Progressive perspective', 'Nonprofit independence'],
    weakAreas: ['Clear editorial agenda', 'Fundraising influence'],
    notable: 'Strong nonprofit investigative model'
  },
  {
    id: 'propublica',
    name: 'ProPublica',
    url: 'https://propublica.org',
    bias: 'Center-Left',
    biasScore: -2,
    credibility: 91,
    factCheckGrade: 'A+',
    reliability: 'Very High',
    ownership: 'Independent nonprofit',
    coverage: 'Investigative journalism',
    strongAreas: ['Investigative depth', 'Impact journalism', 'Nonprofit model'],
    weakAreas: ['Progressive funding base', 'Limited coverage scope'],
    notable: 'Multiple Pulitzer winners'
  },
  {
    id: 'factcheck-org',
    name: 'FactCheck.org',
    url: 'https://factcheck.org',
    bias: 'Center',
    biasScore: 0,
    credibility: 94,
    factCheckGrade: 'A+',
    reliability: 'Very High',
    ownership: 'Annenberg Public Policy Center',
    coverage: 'Fact-checking, political claims',
    strongAreas: ['Nonpartisan', 'Detailed methodology', 'Claims verification'],
    weakAreas: ['Reactive not proactive', 'Limited scope'],
    notable: 'Gold standard for fact-checking'
  },
  {
    id: 'snopes',
    name: 'Snopes',
    url: 'https://snopes.com',
    bias: 'Center',
    biasScore: 0,
    credibility: 92,
    factCheckGrade: 'A+',
    reliability: 'Very High',
    ownership: 'Snopes Media Group',
    coverage: 'Fact-checking, rumors, misinformation',
    strongAreas: ['Misinformation tracking', 'Urban legends', 'Wide scope'],
    weakAreas: ['Quality variance over time', 'Funding questions'],
    notable: 'Oldest fact-checking site'
  },
  {
    id: 'politiFact',
    name: 'PolitiFact',
    url: 'https://polifact.com',
    bias: 'Center-Left',
    biasScore: -1,
    credibility: 90,
    factCheckGrade: 'A',
    reliability: 'Very High',
    ownership: 'Poynter Institute',
    coverage: 'Political fact-checking',
    strongAreas: ['Political claims', 'Truth-O-Meter', 'Pulitzer winner'],
    weakAreas: ['Partisan criticism', 'Reactive focus'],
    notable: 'Pulitzer Prize winner'
  },
  {
    id: 'wash-examiner',
    name: 'Washington Examiner',
    url: 'https://washingtonexaminer.com',
    bias: 'Right',
    biasScore: 6,
    credibility: 72,
    factCheckGrade: 'C+',
    reliability: 'Medium',
    ownership: 'Clarity Media (Philip Berber)',
    coverage: 'Political news, conservative commentary',
    strongAreas: ['Conservative perspective', 'DC coverage', 'Scoops'],
    weakAreas: ['Clear editorial slant', 'Objectivity concerns'],
    notable: 'Part of conservative media ecosystem'
  },
  {
    id: 'the-federalist',
    name: 'The Federalist',
    url: 'https://thefederalist.com',
    bias: 'Far Right',
    biasScore: 8,
    credibility: 48,
    factCheckGrade: 'D-',
    reliability: 'Low',
    ownership: 'Federalist Society (disputed)',
    coverage: 'Political commentary, culture',
    strongAreas: ['Conservative voice', 'Culture war coverage'],
    weakAreas: ['Fact-check record', 'Pseudoscience acceptance', 'Retraction history'],
    notable: 'Has published discredited content'
  },
  {
    id: 'buzzfeed-news',
    name: 'BuzzFeed News',
    url: 'https://buzzfeednews.com',
    bias: 'Center-Left',
    biasScore: -3,
    credibility: 82,
    factCheckGrade: 'B+',
    reliability: 'Medium-High',
    ownership: 'BuzzFeed Inc.',
    coverage: 'News, politics, investigative, culture',
    strongAreas: ['Investigative journalism', 'Documentary', 'Youth audience'],
    weakAreas: ['Entertainment brand confusion', 'Tabloid history'],
    notable: 'Pulitzer finalist for Trump dossier'
  }
];

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^the/, '')
    .trim();
}

// Precomputed once: normalize() was previously called for every outlet on
// every one of the four passes, for every article.
const OUTLET_INDEX = OUTLET_RATINGS.map(outlet => ({
  outlet,
  norm: normalize(outlet.name),
  words: outlet.name.toLowerCase().split(/[\s-]+/).filter(w => w.length > 2 && w !== 'news' && w !== 'the'),
  longWords: outlet.name.toLowerCase().split(/[\s-]+/).filter(w => w.length > 3 && w !== 'news' && w !== 'the'),
}));

// Source names repeat constantly across a refresh (one per article, a handful of
// distinct feeds), so the cache hit rate is near total. Bounded so a stream of
// junk names can't grow it without limit.
const MATCH_CACHE_LIMIT = 500;
const matchCache = new Map();

function findOutlet(sourceName) {
  const normSource = normalize(sourceName);
  if (!normSource) return null;

  // 1. Exact normalized match
  for (const entry of OUTLET_INDEX) {
    if (entry.norm === normSource) return entry.outlet;
  }

  // 2. Contains match (either direction)
  for (const entry of OUTLET_INDEX) {
    if (entry.norm.includes(normSource) || normSource.includes(entry.norm)) return entry.outlet;
  }

  const sourceWords = new Set(
    sourceName.toLowerCase().split(/[\s-]+/).filter(w => w.length > 2 && w !== 'news' && w !== 'the')
  );

  // 3. Word-overlap match: at least 2 significant words in common
  for (const entry of OUTLET_INDEX) {
    let overlap = 0;
    for (const w of entry.words) if (sourceWords.has(w)) overlap++;
    if (overlap >= 2) return entry.outlet;
  }

  // 4. Single significant word match (e.g. "Reuters World" matches "Reuters")
  for (const entry of OUTLET_INDEX) {
    if (entry.longWords.some(w => sourceWords.has(w))) return entry.outlet;
  }

  return null;
}

function matchOutlet(sourceName) {
  if (!sourceName || typeof sourceName !== 'string') return null;
  if (matchCache.has(sourceName)) return matchCache.get(sourceName);

  const result = findOutlet(sourceName);
  if (matchCache.size >= MATCH_CACHE_LIMIT) matchCache.clear();
  matchCache.set(sourceName, result);
  return result;
}

module.exports = { matchOutlet };
