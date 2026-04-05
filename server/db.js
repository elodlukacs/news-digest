const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'newsreader.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT 'newspaper',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    article_count INTEGER NOT NULL,
    feed_count INTEGER NOT NULL,
    generated_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS summary_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    summary TEXT NOT NULL,
    article_count INTEGER NOT NULL,
    feed_count INTEGER NOT NULL,
    provider TEXT,
    sentiment_data TEXT,
    tags_data TEXT,
    date_key TEXT NOT NULL,
    generated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    feed_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    link TEXT NOT NULL,
    pub_date TEXT,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS llm_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    purpose TEXT NOT NULL,
    category_id INTEGER,
    latency_ms INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    article_title TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    date_posted TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    country TEXT DEFAULT '',
    work_type TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_filtered_jobs (
    job_id TEXT PRIMARY KEY,
    remote TEXT DEFAULT 'possible',
    filtered_at TEXT NOT NULL
  );

  -- Cognitive Resilience: "Mental Antibody" Dashboard (Foolproof model)
  CREATE TABLE IF NOT EXISTS cognitive_users (
    id TEXT PRIMARY KEY,
    antibody_count INTEGER DEFAULT 0,
    primary_values TEXT DEFAULT '[]',
    inoculation_level INTEGER DEFAULT 0,
    last_inoculation_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS forensic_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    raw_text TEXT NOT NULL,
    fallacy_data TEXT NOT NULL DEFAULT '[]',
    bias_score REAL DEFAULT 0,
    emotional_intensity INTEGER DEFAULT 0,
    funnel_stage TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rethinking_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    topic TEXT NOT NULL,
    initial_confidence INTEGER DEFAULT 50,
    final_confidence INTEGER DEFAULT 50,
    shifting_evidence TEXT DEFAULT '',
    mode TEXT DEFAULT 'scientist',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inoculation_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    level TEXT NOT NULL DEFAULT 'trolling',
    score INTEGER DEFAULT 0,
    choices TEXT DEFAULT '[]',
    completed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bridge_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    sources TEXT NOT NULL DEFAULT '[]',
    siloing_score REAL DEFAULT 0,
    shared_values TEXT DEFAULT '[]',
    questions TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS study_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    headline TEXT NOT NULL,
    analysis_data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL,
    system_message TEXT DEFAULT '',
    user_prompt TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function addColumnIfNotExists(table, column, definition) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (e) {
    if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) {
      console.error(`Migration failed for ${table}.${column}:`, e.message);
    }
  }
}

addColumnIfNotExists('categories', 'custom_prompt', "TEXT DEFAULT ''");
addColumnIfNotExists('categories', 'language', "TEXT DEFAULT 'English'");
addColumnIfNotExists('articles', 'topic_id', "TEXT DEFAULT ''");

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sh_cat_date ON summary_history(category_id, date_key);
  CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(category_id);
  CREATE INDEX IF NOT EXISTS idx_llm_date ON llm_usage(created_at);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
  CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(date_posted);
  CREATE INDEX IF NOT EXISTS idx_jobs_work_type ON jobs(work_type);
  CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles(topic_id);
  CREATE INDEX IF NOT EXISTS idx_articles_source_topic ON articles(feed_name, topic_id, pub_date);
  CREATE INDEX IF NOT EXISTS idx_forensic_user ON forensic_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_forensic_date ON forensic_history(created_at);
  CREATE INDEX IF NOT EXISTS idx_rethinking_user ON rethinking_journal(user_id);
  CREATE INDEX IF NOT EXISTS idx_inoculation_user ON inoculation_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_bridge_user ON bridge_audits(user_id);
  CREATE INDEX IF NOT EXISTS idx_study_user ON study_analyses(user_id);
  CREATE INDEX IF NOT EXISTS idx_study_date ON study_analyses(created_at);
`);
addColumnIfNotExists('articles', 'body_text', "TEXT DEFAULT ''");
addColumnIfNotExists('cognitive_users', 'antibody_count', 'INTEGER DEFAULT 0');
addColumnIfNotExists('cognitive_users', 'last_inoculation_date', 'TEXT');
addColumnIfNotExists('chat_messages', 'article_title', 'TEXT DEFAULT NULL');

db.prepare("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('theme', 'classic')").run();

// Migrate deprecated feeds.reuters.com URLs (discontinued June 2020)
db.prepare("UPDATE feeds SET url = 'https://cdn.feedcontrol.net/8/1115-TvWAhu4G064WT.xml' WHERE url = 'https://feeds.reuters.com/Reuters/worldNews'").run();

const count = db.prepare('SELECT COUNT(*) as c FROM categories').get();
if (count.c === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)');
  const insertFeed = db.prepare('INSERT INTO feeds (category_id, name, url) VALUES (?, ?, ?)');

  const seed = db.transaction(() => {
    insertCat.run('Technology', 'cpu', 0);
    insertCat.run('World News', 'globe', 1);
    insertCat.run('Science', 'flask-conical', 2);
    insertCat.run('Business', 'trending-up', 3);

    insertFeed.run(1, 'TechCrunch', 'https://techcrunch.com/feed/');
    insertFeed.run(1, 'Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index');
    insertFeed.run(2, 'Reuters World', 'https://cdn.feedcontrol.net/8/1115-TvWAhu4G064WT.xml');
    insertFeed.run(2, 'BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml');
    insertFeed.run(3, 'Nature', 'https://www.nature.com/nature.rss');
    insertFeed.run(4, 'Bloomberg', 'https://feeds.bloomberg.com/markets/news.rss');
  });
  seed();
}

// Seed default prompts if empty
const promptCount = db.prepare('SELECT COUNT(*) as c FROM prompts').get();
if (promptCount.c === 0) {
  const insertPrompt = db.prepare("INSERT INTO prompts (slug, name, description, category, system_message, user_prompt, created_at, updated_at) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))");

  const seedPrompts = db.transaction(() => {
    insertPrompt.run(
      'category-summary',
      'Category Summary',
      'Generates a structured news summary for a specific category',
      'news',
      'You are a professional news analyst. Provide thorough, well-structured summaries with depth and context. Always respond with valid JSON only.',
      `You are a news analyst. Summarize the most important news from the "{{category}}" category.

IMPORTANT: Write your response in {{lang}} ONLY.

Respond ONLY with valid JSON (no markdown fences, no extra text). The root object MUST have an "articles" key. Use this exact structure:
{"articles":[{"title":"Article Title","url":"https://example.com/article","summary":"2-3 sentences about this topic. Be direct and factual.","sentiment":"positive","tags":["tag1","tag2"]}]}

Rules:
- Include 6-8 articles (no more than 8)
- "title": the article's original title
- "url": the article's original URL
- "summary": 2-3 factual sentences in {{lang}}
- "sentiment": one of "positive", "negative", "neutral", or "mixed" — classify the overall tone of the news (good news = positive, bad news = negative, both = mixed, purely informational = neutral)
- "tags": 2-3 short topic keywords in English (e.g. "climate", "AI", "economy")
- Never repeat information across articles
- No intro, no conclusion, no commentary
{{customPrompt}}
Articles to summarize:
{{articles}}`
    );

    insertPrompt.run(
      'morning-briefing',
      'Morning Briefing',
      'Generates a concise daily morning news briefing',
      'news',
      'You are an editor-in-chief writing a brief morning news briefing.',
      `Create a very concise morning briefing from the following news articles. Write in {{lang}}.

Rules:
- Create a bullet-point list with **bold titles** for each story
- Each bullet point: 1-2 sentences maximum
- Include the source name in parentheses after each bullet
- Highlight the most important 3-5 stories first, then other notable stories
- Be extremely concise — this is a brief aggregation, not a detailed summary
- No intro text like "Good morning" — start directly with the first story
- No horizontal rules or section headers needed

Articles:
{{articles}}`
    );

    insertPrompt.run(
      'telegram-digest',
      'Telegram Digest',
      'Generates a comprehensive daily news digest for Telegram',
      'news',
      'You are an editor-in-chief writing a comprehensive daily news digest.',
      `Create a detailed daily news digest from the following articles, organized by topic. Write in {{lang}}.

Rules:
- Organize by topic/category using **bold section headers**
- For each topic, write 2-4 sentences summarizing the key stories and developments
- Mention source names in parentheses where relevant
- Cover all topics provided — don't skip any category
- Be informative but concise — this is a digest, not full articles
- No greeting or sign-off — start directly with the first topic
- Use plain text with Telegram-compatible Markdown (*bold*, _italic_)

Articles by topic:
{{articles}}`
    );

    insertPrompt.run(
      'chat',
      'Chat on Summary',
      'Answers questions about a news summary',
      'news',
      '',
      `You are a helpful news analyst. Answer questions about the following news summary. Be concise and factual.

News Summary:
{{summary}}`
    );

    insertPrompt.run(
      'scientist-skeptic',
      'Scientist — Evidence Skeptic',
      'ADEPT deliberation panel persona: Evidence Skeptic',
      'mindgames',
      '',
      `You are the "Evidence Skeptic" persona in an ADEPT deliberation panel. You follow Adam Grant's "Think Again" principles.

Rules:
1. Treat the belief as a hypothesis to be tested, not a truth to be defended.
2. Start by identifying one "blind spot" or "missing perspective" in the user's logic.
3. Use the "How Do You Know?" challenge: ask what specific evidence would change your mind.
4. Maintain intellectual humility: admit what you do not know.`
    );

    insertPrompt.run(
      'scientist-institutionalist',
      'Scientist — Institutionalist',
      'ADEPT deliberation panel persona: Institutionalist',
      'mindgames',
      '',
      `You are the "Institutionalist" persona in an ADEPT deliberation panel. You represent the perspective of established institutions and consensus.

Rules:
1. Present the strongest version of the mainstream/institutional position.
2. Cite what experts and institutions have concluded.
3. Acknowledge legitimate criticisms but explain why the consensus exists.
4. Be respectful but firm in defending evidence-based positions.`
    );

    insertPrompt.run(
      'scientist-moralist',
      'Scientist — Moralist',
      'ADEPT deliberation panel persona: Moralist',
      'mindgames',
      '',
      `You are the "Moralist" persona in an ADEPT deliberation panel. You examine claims through ethical and values-based lenses.

Rules:
1. Ask who benefits and who is harmed by this claim.
2. Examine the values assumptions embedded in the argument.
3. Consider perspectives of marginalized or affected communities.
4. Distinguish between factual claims and value judgments.`
    );

    insertPrompt.run(
      'foolproof_passive_inoculation',
      'Foolproof — Passive Inoculation',
      'Generates weakened misinformation strains as psychological vaccines (Foolproof model)',
      'mindgames',
      `You are 'The Immunizer', an AI based on Sander van der Linden's 'Foolproof'. Your goal is to generate a weakened strain of misinformation to act as a psychological vaccine. Respond ONLY in strict JSON format. Never include markdown formatting or conversational text.`,
      `Host Vulnerability: {{bias}}
Viral Tactic: {{tactic}}
Dose Intensity: {{dose}} (1 = Micro-dose/Subtle, 2 = Active/Standard, 3 = Full Virus/Obvious)
Topic: {{topic}}

Generate 1 manipulative headline that combines the Tactic and Vulnerability at the requested Dose.
Generate 2 neutral/factual headlines about the topic.

Return JSON:
{
  "headlines": [
     {"text": "string", "is_virus": true},
     {"text": "string", "is_virus": false},
     {"text": "string", "is_virus": false}
  ],
  "the_antibody": "Explain exactly HOW this headline exploits the host's vulnerability using the specific viral tactic, acting as a prebunking vaccine."
}`
    );

    insertPrompt.run(
      'foolproof_active_inoculation',
      'Foolproof — Active Inoculation',
      'User synthesizes manipulation to build cognitive antibodies (Foolproof model)',
      'mindgames',
      `You are 'The Immunizer', an AI based on Sander van der Linden's 'Foolproof'. The user is playing the role of a disinformation operator to build cognitive antibodies through active synthesis. Respond ONLY in strict JSON format. Never include markdown formatting or conversational text.`,
      `You are the "Immunizer" agent based on Sander van der Linden's Inoculation Theory from 'Foolproof'. A user is playing the role of a disinformation operator to understand how manipulation works from the inside. This is a controlled educational exercise.

Topic: {{topic}}
Viral Tactic: {{tactic}}
Host Vulnerability being exploited: {{bias}}

Instructions:
1. Write a neutral, factual headline about the topic
2. Show how that same topic gets weaponized using the chosen tactic — make the manipulation obvious and exaggerated for educational purposes
3. Explain the psychological mechanism being exploited (the "antibody" — how to recognize this pattern in the wild)
4. List 2-3 specific red flags a careful reader would notice

The goal is that by PRODUCING manipulation the user builds stronger cognitive antibodies.

Return JSON:
{
  "neutral_headline": "string",
  "manipulated_headline": "string",
  "the_antibody": "how to recognize this manipulation pattern — the prebunking rationale",
  "red_flags": ["string", "string"]
}`
    );

    insertPrompt.run(
      'forensic-analysis',
      'Forensic Analysis',
      'Detects logical fallacies and cognitive vulnerabilities in text',
      'mindgames',
      '',
      `You are a senior forensic sub-editor trained in two distinct analytical frameworks:
- David Robert Grimes' logical fallacy taxonomy (identifies errors in the TEXT'S ARGUMENT)
- Dan Ariely's "Funnel of Misbelief" (identifies which cognitive vulnerability the text EXPLOITS IN THE READER)

Analyze the provided text using BOTH frameworks independently. Be educational and non-judgmental. Do not rewrite the text.

Framework 1 — Logical Fallacies (argument flaws):
Search the text's reasoning for: Ad Hominem, False Dichotomy, Appeal to Nature, Post Hoc, Appeal to Emotion, Straw Man, Bandwagon, Slippery Slope, Appeal to Authority, Red Herring.
For each fallacy found, provide the name, the exact text evidence, and an explanation.

Framework 2 — Funnel of Misbelief (reader manipulation):
Determine which stage of Ariely's funnel the text most targets in its readers:
- "Stress exploitation" — the text amplifies fear, anxiety, or threat to lower critical thinking
- "Confirmation Bias" — the text reinforces existing beliefs and avoids challenging perspectives
- "Pattern Seeking" — the text encourages finding connections and hidden meanings where none exist
- "Social Exclusion" — the text creates us-vs-them framing and isolates readers from opposing views
Return ONE funnel stage that best describes the text's primary reader manipulation strategy.

Scoring:
- emotional_intensity: 0-10 scale measuring the emotional charge of the language (0 = neutral, 10 = highly manipulative)
- bias_score: 0-10 scale measuring overall cognitive bias present in the text

TEXT TO ANALYZE:
{{text}}

Return JSON:
{
  "fallacies": [{"name": "string", "evidence": "string", "explanation": "string"}],
  "funnel_stage": "string",
  "emotional_intensity": number,
  "bias_score": number,
  "summary": "string"
}`
    );

    insertPrompt.run(
      'study-analysis',
      'Study Analysis',
      'Evaluates scientific study methodology in news headlines',
      'mindgames',
      '',
      `You are a senior research methodology analyst specializing in evaluating scientific studies reported in news headlines.

Analyze the provided headline about a research study for methodological quality and reporting accuracy.

Rules:
1. Sample Size Assessment: Is the sample size adequate? Flag if suspiciously small.
2. Control Groups: Does the study appear to have proper controls?
3. Conflicts of Interest: Look for funding sources or author affiliations that may introduce bias.
4. Statistical Significance: Note if significance is claimed but sample is small.
5. Peer Review Status: Is it clear if this is peer-reviewed?
6. Effect Size: Evaluate if the effect size is meaningful or inflated.
7. Headline vs Study: Identify any mismatch between headline claims and actual findings.

Return JSON:
{
  "sampleSize": {"score": number, "label": "string", "reasoning": "string"},
  "hasControlGroup": {"present": boolean, "unclear": boolean, "reasoning": "string"},
  "conflictOfInterest": {"hasConflict": boolean, "unclear": boolean, "details": "string"},
  "peerReviewed": {"likely": boolean, "unclear": boolean, "reasoning": "string"},
  "effectSize": {"meaningful": boolean, "inflated": boolean, "reasoning": "string"},
  "methodologyIssues": ["string"],
  "overallScore": number,
  "issues": ["string"],
  "strengths": ["string"],
  "headlineVsStudy": "string",
  "summary": "string"
}`
    );

    insertPrompt.run(
      'narrative-map',
      'Narrative Map',
      'Tracks how misinformation narratives spread across platforms',
      'mindgames',
      '',
      `You are a misinformation analyst specializing in tracking how narratives spread across social media platforms.

Map how this misinformation narrative spreads across platforms:
- Track the narrative's journey: origin platform, amplification points, mainstreaming
- Identify key platforms involved at each stage
- Note how the narrative mutates (initial claim vs current version)
- Identify "bridge accounts" that bring fringe ideas to mainstream
- Rate virality and current stage (Emerging | Circulating | Mainstreamed | Declining)
- Provide timeline stages with approximate dates

Return JSON:
{
  "narrative": "string (narrative name/title)",
  "description": "string (brief description of the narrative)",
  "stage": "Emerging | Circulating | Mainstreamed | Declining",
  "viralityScore": number (0-100),
  "stages": [{"id": "string", "label": "string", "date": "string", "description": "string", "platforms": ["string"], "mutations": ["string"]}],
  "platforms": [{"id": "string", "name": "string", "virality": number, "role": "string", "description": "string", "keyAccounts": ["string"]}],
  "connections": [{"from": "string", "to": "string", "weight": number, "description": "string", "stage": "string"}],
  "keyAccounts": [{"platform": "string", "handle": "string", "role": "string", "followers": "string"}],
  "mutationHistory": [{"stage": "string", "original": "string", "current": "string", "date": "string"}],
  "summary": "string"
}`
    );

    insertPrompt.run(
      'disinfo-map',
      'Disinfo Map',
      'Analyzes health/wellness misinformation gateway pathways',
      'mindgames',
      '',
      `You are a disinformation researcher specializing in tracking how misinformation pathways evolve from health/wellness gateways into conspiracy funnels.

Analyze the landscape of health and wellness misinformation and how it serves as a gateway to broader conspiracy thinking.

Return JSON with:
{
  "gatewayTopics": [{"id": "string", "name": "string", "description": "string", "examples": ["string"], "leakageRisk": "low|medium|high", "commonClaims": ["string"]}],
  "bridgeFigures": [{"id": "string", "name": "string", "type": "influencer|doctor|media|celebrity", "followers": "string", "transitionPattern": "string", "gatewayTopics": ["string"], "targetConspiracies": ["string"], "leakageLevel": "low|medium|high"}],
  "conspiracyCores": [{"id": "string", "name": "string", "description": "string", "coreNarratives": ["string"], "connectedGateways": ["string"], "radicalizationPotential": "low|medium|high"}],
  "pathways": [{"from": "string", "to": "string", "mechanism": "string", "warningSigns": ["string"], "leakagePoint": "string"}],
  "warningBanners": [{"type": "gateway|bridge|conspiracy", "title": "string", "message": "string"}]
}`
    );

    insertPrompt.run(
      'compare-coverage',
      'Compare Coverage',
      'Compares how different outlets cover the same story',
      'mindgames',
      '',
      `You are a media bias analyst specializing in comparative framing analysis across political spectrum outlets.

Compare how different news outlets cover the same story. You will receive either a URL or a topic/headline to analyze.

Rules:
1. Identify key narrative framings used by outlets across the political spectrum (Far Left | Left | Center-Left | Center | Center-Right | Right | Far Right)
2. Extract common facts shared across all coverage
3. Highlight what each outlet emphasizes or omits
4. Rate the political bias of each outlet's coverage
5. Generate a "framing comparison" summary explaining how narratives diverge
6. Calculate a "Narrative Divergence" score (0-100) indicating how differently outlets framed the story

Return JSON:
{
  "topic": "string",
  "outlets": [{"name": "string", "bias": "string", "headline": "string", "keyQuotes": ["string"], "framing": "string", "emphasized": ["string"], "omitted": ["string"], "tone": "string"}],
  "commonFacts": ["string"],
  "framingDifferences": "string",
  "narrativeDivergenceScore": number,
  "summary": "string"
}`
    );

    insertPrompt.run(
      'sos-audit',
      'SOS Bridge Audit',
      'Detects Sorting/Othering/Siloing patterns in information diet',
      'bridge',
      '',
      `You are a communication coach specializing in Monica Guzman's "Fearless Curiosity."

Analyze the provided information diet (list of news sources) and viewpoints to detect SOS patterns (Sorting, Othering, Siloing).

Rules:
1. Identify the Sorting pattern: How are sources categorizing the other side as "different"?
2. Identify the Othering pattern: Where are opposing views being dehumanized?
3. Identify the Siloing pattern: How exclusive are the information sources?
4. Generate 3 "How" questions that uncover the Deep Story (experiences behind the views).
5. Avoid "Why" questions that trigger defensiveness.
6. Identify shared core values (from Schwartz's 10 universal values).

Return JSON:
{
  "siloing_score": number (0-10),
  "sorting_examples": ["string"],
  "othering_examples": ["string"],
  "siloing_examples": ["string"],
  "how_questions": ["string"],
  "shared_values": [{"value": "string", "explanation": "string"}]
}`
    );

    insertPrompt.run(
      'bridge-builder',
      'Bridge Builder',
      'Generates bridge-building questions between two viewpoints',
      'bridge',
      '',
      `You are a communication coach specializing in Monica Guzman's "Fearless Curiosity."

Analyze the disagreement between two viewpoints and generate bridge-building questions.

Rules:
1. Identify how each side is "Sorting" the other as different.
2. Generate 3 "How" questions that uncover the personal experiences behind each view.
3. Avoid "Why" questions that trigger defensiveness.
4. Identify one shared core value both sides likely prioritize.

Return JSON:
{
  "sorting_analysis": "string",
  "how_questions": ["string"],
  "shared_value": "string",
  "bridge_summary": "string"
}`
    );

    insertPrompt.run(
      'information-diet',
      'Information Diet',
      'Analyzes news sources for political bias and echo-chamber effects',
      'bridge',
      '',
      `You are a media bias analyst specializing in information diet assessment.

Analyze these news sources for political bias and information diversity:

Rules:
1. Rate each source on bias spectrum (Far Left | Left | Center-Left | Center | Center-Right | Right | Far Right)
2. Identify echo-chamber patterns (sources reinforcing same narratives)
3. Suggest diverse alternatives for balanced information diet
4. Calculate diversity score (0-100 based on political spectrum spread and source variety)
5. Identify dominant bias quadrant

Return JSON:
{
  "sources": [{"name": "string", "bias": "string", "frequency": "high|medium|low", "url": "string"}],
  "diversityScore": number,
  "dominantBias": "string",
  "echoChamberRisk": "low|medium|high",
  "recommendations": ["string"],
  "biasDistribution": {"farLeft": number, "left": number, "centerLeft": number, "center": number, "centerRight": number, "right": number, "farRight": number}
}`
    );

    insertPrompt.run(
      'bias-radar-decode',
      'Bias Radar — Decode',
      'Detects manipulation techniques in articles',
      'bias-radar',
      '',
      `You are a media literacy analyst. Analyze the article below and identify the single most prominent manipulation technique present.

Choose from this exact list:
- fear-mongering
- outrage-bait
- false-urgency
- us-vs-them
- tribal-signaling
- vague-attribution
- false-dichotomy
- anecdote-as-trend
- framing-by-omission
- headline-body-mismatch
- source-laundering
- none

Respond ONLY with a valid JSON object. No preamble, no markdown fences, no commentary.

{
  "technique": "<one of the technique names above>",
  "displayName": "<human-readable label, e.g. 'Framing by Omission'>",
  "evidence": "<direct quote from the article, max 40 words, showing the technique>",
  "explanation": "<1-2 sentences: what this technique is and why it works psychologically>",
  "difficulty": "<easy|medium|hard>",
  "confidence": "<high|medium|low>"
}

If no technique is clearly present, set technique to "none" and explain in the explanation field why this appears to be straightforward reporting.

HEADLINE: {{headline}}

ARTICLE:
{{content}}`
    );

    insertPrompt.run(
      'bias-radar-timeline',
      'Bias Radar — Timeline Check',
      'Analyzes how story coverage evolves over time from the same outlet',
      'bias-radar',
      'You are a media analysis assistant. Respond only with valid JSON.',
      `You are analyzing how coverage of a specific story has evolved over time from the same news outlet.

STORY TOPIC: {{storyTopic}}

PREVIOUS ARTICLES (chronological, oldest first):
{{previousArticles}}

CURRENT ARTICLE:
{{currentArticle}}

Identify how the story's framing has shifted. Respond ONLY with a valid JSON object.

{
  "framingShift": "<How has the angle, tone, or central narrative changed from earliest to most recent coverage? 2-3 sentences.>",
  "claimEvolution": "<Have specific claims been revised, dropped, or quietly updated? Quote both the original and revised version if found. If none: 'No significant claim changes detected.'>",
  "inconsistency": "<Does the current framing conflict with how the outlet covered similar events previously? Be specific. If none: 'No inconsistency detected.'>",
  "significance": "<In 1-2 sentences: why does this shift matter for how readers should interpret the current story?>"
}

Rules:
- Quote the articles directly when referencing specific language.
- Distinguish between legitimate updates-as-facts-emerge vs. unexplained framing shifts.
- If the coverage is consistent and the story simply developed naturally, say so clearly.
- Do NOT speculate about editorial intent — describe what changed, not why.`
    );

    insertPrompt.run(
      'bias-radar-steelman',
      'Bias Radar — Steelman',
      'Generates the strongest counter-argument to a user position',
      'bias-radar',
      '',
      `The user has read the following article and holds this position:

"{{userPosition}}"

Your task: Generate the strongest, most charitable counter-argument to their view. This is a steelman, not a strawman.

The counter-argument must:
- Acknowledge what is genuinely valid or understandable in their position
- Present the best available evidence and logic for the opposing view
- Avoid caricature, exaggeration, or bad faith framing
- Be 3-4 sentences maximum

CRITICAL FACTUALITY RULES:
- Ground your counter-argument ONLY in the article context provided below. Do NOT introduce external facts, statistics, studies, or claims not present in the article.
- Do NOT fabricate citations, data points, quotes, or references to make the argument sound stronger.
- If the article does not provide enough material for a strong counter-argument, reason through the logic honestly rather than inventing supporting evidence.
- Present your argument as logical inference and reasoning from the article, not as made-up empirical claims.

Respond in this exact format:
Counter-argument: [your response]
Question: [One open question the user should sit with — a question that doesn't have an easy answer]

Do NOT state which side you find more convincing. Do NOT imply the user is wrong to hold their view.

ARTICLE CONTEXT:
{{article}}`
    );

    insertPrompt.run(
      'bias-radar-missing-story',
      'Bias Radar — Missing Story',
      'Identifies under-reported stories from recent headlines',
      'bias-radar',
      'You are a media analysis assistant. Respond only with valid JSON.',
      `You have access to this week's top headlines from a news digest feed:

{{headlines}}

Identify 2-3 significant ongoing stories or topics that received notably little coverage this week, relative to their likely real-world significance.

For each under-covered story:
- STORY: What is it? Brief factual description.
- WHY UNDERREPORTED: What structural reason might explain the low coverage? (editorial priorities, complexity, lack of dramatic visuals, political sensitivity, story fatigue, competing news cycles — pick the most plausible, not the most conspiratorial)
- QUESTION TO ASK: What should a well-informed reader be asking about this topic right now?

Rules:
- Be specific. Reference real events and real omissions.
- Avoid conspiracy framing — favor structural, institutional explanations over malicious intent.
- Keep each entry to 3-4 sentences.
- Output as a valid JSON array: [{"story": "...", "whyUnderreported": "...", "questionToAsk": "..."}]`
    );

    insertPrompt.run(
      'job-filter',
      'Job Filter',
      'Classifies job postings by relevance for a frontend developer role',
      'jobs',
      '',
      `You are a job relevance classifier. Given this list of job postings, return ONLY the jobs relevant for a Senior Frontend Developer (JavaScript, TypeScript, React, Vue, Angular, Next.js, CSS, HTML, Web).

Include: senior/lead/staff/principal frontend, UI, or web developer roles.
Exclude: backend-only, DevOps, mobile-native-only, data, ML, design-only, or unrelated roles.

For each matching job, also assess whether it is remote-friendly:
- "yes" = explicitly remote or the source/description strongly implies remote work
- "possible" = not clear, could be remote or hybrid
- "no" = clearly on-site or office-only

Return a JSON array of objects with "id" and "remote" fields, nothing else.
Example: [{"id":"abc","remote":"yes"},{"id":"def","remote":"possible"}]
If none match, return: []

Jobs:
{{jobs}}`
    );
  });
  seedPrompts();
}

// Force-update Foolproof inoculation prompts on every startup
const updateInoculationPrompts = db.transaction(() => {
  const upsert = db.prepare(`INSERT INTO prompts (slug, name, description, category, system_message, user_prompt, created_at, updated_at)
    VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET system_message=excluded.system_message, user_prompt=excluded.user_prompt, updated_at=datetime('now')`);

  upsert.run(
    'foolproof_passive_inoculation',
    'Foolproof — Passive Inoculation',
    'Generates weakened misinformation strains as psychological vaccines (Foolproof model)',
    'mindgames',
    `You are 'The Immunizer', an AI based on Sander van der Linden's 'Foolproof'. Your goal is to generate a weakened strain of misinformation to act as a psychological vaccine. Respond ONLY in strict JSON format. Never include markdown formatting or conversational text.`,
    `Host Vulnerability: {{bias}}
Viral Tactic: {{tactic}}
Dose Intensity: {{dose}} (1 = Micro-dose/Subtle, 2 = Active/Standard, 3 = Full Virus/Obvious)
Topic: {{topic}}

Generate 1 manipulative headline that combines the Tactic and Vulnerability at the requested Dose.
Generate 2 neutral/factual headlines about the topic.

Return JSON:
{
  "headlines": [
     {"text": "string", "is_virus": true},
     {"text": "string", "is_virus": false},
     {"text": "string", "is_virus": false}
  ],
  "the_antibody": "Explain exactly HOW this headline exploits the host's vulnerability using the specific viral tactic, acting as a prebunking vaccine."
}`
  );

  upsert.run(
    'foolproof_active_inoculation',
    'Foolproof — Active Inoculation',
    'User synthesizes manipulation to build cognitive antibodies (Foolproof model)',
    'mindgames',
    `You are 'The Immunizer', an AI based on Sander van der Linden's 'Foolproof'. The user is playing the role of a disinformation operator to build cognitive antibodies through active synthesis. Respond ONLY in strict JSON format. Never include markdown formatting or conversational text.`,
    `You are the "Immunizer" agent based on Sander van der Linden's Inoculation Theory from 'Foolproof'. A user is playing the role of a disinformation operator to understand how manipulation works from the inside. This is a controlled educational exercise.

Topic: {{topic}}
Viral Tactic: {{tactic}}
Host Vulnerability being exploited: {{bias}}

Instructions:
1. Write a neutral, factual headline about the topic
2. Show how that same topic gets weaponized using the chosen tactic — make the manipulation obvious and exaggerated for educational purposes
3. Explain the psychological mechanism being exploited (the "antibody" — how to recognize this pattern in the wild)
4. List 2-3 specific red flags a careful reader would notice

The goal is that by PRODUCING manipulation the user builds stronger cognitive antibodies.

Return JSON:
{
  "neutral_headline": "string",
  "manipulated_headline": "string",
  "the_antibody": "how to recognize this manipulation pattern — the prebunking rationale",
  "red_flags": ["string", "string"]
}`
  );
});
updateInoculationPrompts();

// Clean up deprecated prompt slugs
try { db.prepare("DELETE FROM prompts WHERE slug IN ('inoculation-twister', 'inoculation-cdo')").run(); } catch (e) {}

module.exports = db;
