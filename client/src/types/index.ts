export interface Category {
  id: number;
  name: string;
  icon: string;
  sort_order: number;
  feed_count: number;
}

export interface Feed {
  id: number;
  category_id: number;
  name: string;
  url: string;
}

export interface Summary {
  id?: number;
  category: string;
  summary: string;
  article_count: number;
  feed_count: number;
  generated_at: string;
  provider?: string;
  sentiment_data?: SentimentSection[];
  tags_data?: string[];
}

export interface SentimentSection {
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  tags: string[];
}

export interface HistoryEntry {
  id: number;
  date_key: string;
  generated_at: string;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ProviderQuota {
  provider: string;
  model: string;
  limit_tokens: number | null;
  remaining_tokens: number | null;
  limit_requests: number | null;
  remaining_requests: number | null;
  reset_tokens: string | null;
  reset_requests: string | null;
  updated_at: string;
}

export interface LlmStats {
  total_calls: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  avg_latency: number;
  by_provider: Record<string, { calls: number; tokens: number; avg_latency: number }>;
  by_purpose: Record<string, { calls: number; tokens: number; avg_latency: number }>;
  daily: { date: string; tokens: number; calls: number }[];
  quotas: ProviderQuota[];
}

export interface HackerNewsItem {
  id: number;
  title: string;
  url: string;
  score: number;
}

export interface UpcomingRelease {
  id: number;
  title: string;
  date: string;
  type: 'movie' | 'tv';
  rating: number | null;
  overview: string;
  poster: string | null;
}

export interface ReleasesResponse {
  items: UpcomingRelease[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type JobStatus = 'new' | 'applied' | 'ignored';
export type JobSource = 'remoteok' | 'weworkremotely' | 'himalayas' | 'remotive' | 'arbeitnow' | 'linkedin' | 'indeed' | 'hackernews';
export type RemoteAssessment = 'yes' | 'no' | 'possible';

export interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  source: JobSource;
  datePosted: string;
  status: JobStatus;
  country: string;
  workType: string;
  description?: string;
  aiRemote?: RemoteAssessment;
}

export interface JobFilters {
  status: string;
  source: string;
  workType: string;
  search: string;
  country: string;
  aiOnly: boolean;
}

export interface JobCounts {
  total: number;
  new: number;
  applied: number;
  ignored: number;
  aiFiltered: number;
}

export type SourceCounts = Record<string, number>;

export interface ReleaseDetail {
  id: number;
  title: string;
  tagline: string | null;
  overview: string;
  date: string;
  type: 'movie' | 'tv';
  rating: number | null;
  votes: number;
  runtime: number | null;
  genres: string[];
  cast: string[];
  directors: string[];
  poster: string | null;
  backdrop: string | null;
  trailer: string | null;
  seasons: number | null;
  episodes: number | null;
  status: string | null;
}

export type { CryptoPrice, ForecastDay, Weather, Rates, Headline, Briefing } from './widgets';
export type { BiasRating, SourceArticle, TechniqueName, TechniqueResult, GutCheckReaction } from './lens';

export interface HomepageArticle {
  title: string;
  excerpt: string;
  link: string;
  image: string;
  pubDate: string;
  source: string;
}

export interface HomepageBrief {
  categoryId: number;
  categoryName: string;
  articles: HomepageArticle[];
}

/* ─── Cognitive Resilience Types ─── */

export interface ForensicFallacy {
  name: string;
  evidence: string;
  explanation: string;
}

export interface ForensicResult {
  fallacies: ForensicFallacy[];
  funnel_stage: string;
  emotional_intensity: number;
  bias_score: number;
  summary: string;
  provider?: string;
}

export interface ForensicEntry {
  id: number;
  user_id: string;
  raw_text: string;
  fallacy_data: string;
  bias_score: number;
  emotional_intensity: number;
  funnel_stage: string;
  created_at: string;
}

export interface InoculationHeadline {
  tactic: string;
  headline: string;
  flaw_explanation: string;
}

export interface InoculationSession {
  id: number;
  level: string;
  score: number;
  topic: string;
  headlines: InoculationHeadline[];
  provider?: string;
}

export interface DebateResponse {
  persona: string;
  personaId: string;
  response: string;
  provider: string | null;
}

export interface RethinkingEntry {
  id: number;
  topic: string;
  initial_confidence: number;
  final_confidence: number;
  shifting_evidence: string;
  mode: string;
  created_at: string;
}

export interface JournalTrend {
  date: string;
  topic: string;
  preConfidence: number;
  postConfidence: number;
  shift: number;
}

export interface SchwartzValue {
  id: string;
  name: string;
  description: string;
}

export interface BridgeAudit {
  siloing_score: number;
  sorting_examples: string[];
  othering_examples: string[];
  siloing_examples: string[];
  how_questions: string[];
  shared_values: { value: string; explanation: string }[];
  provider?: string;
}

export interface StudyAnalysis {
  sampleSize: { score: number; label: string; reasoning: string };
  hasControlGroup: { present: boolean; unclear: boolean; reasoning: string };
  conflictOfInterest: { hasConflict: boolean; unclear: boolean; details: string };
  peerReviewed: { likely: boolean; unclear: boolean; reasoning: string };
  effectSize: { meaningful: boolean; inflated: boolean; reasoning: string };
  methodologyIssues: string[];
  overallScore: number;
  issues: string[];
  strengths: string[];
  headlineVsStudy: string;
  summary: string;
  provider?: string;
}

export interface StudyAnalysisEntry {
  id: number;
  user_id: string;
  headline: string;
  analysis_data: string;
  created_at: string;
}

export interface DietSource {
  name: string;
  bias: string;
  frequency: 'high' | 'medium' | 'low';
  url?: string;
}

export interface BiasDistribution {
  farLeft: number;
  left: number;
  centerLeft: number;
  center: number;
  centerRight: number;
  right: number;
  farRight: number;
}

export interface InformationDietResult {
  sources: DietSource[];
  diversityScore: number;
  dominantBias: string;
  echoChamberRisk: 'low' | 'medium' | 'high';
  recommendations: string[];
  biasDistribution: BiasDistribution;
  provider?: string;
}

export interface NarrativeMapPlatform {
  id: string;
  name: string;
  virality: number;
  role: 'origin' | 'amplifier' | 'bridge' | 'mainstream' | 'decline';
  description: string;
  keyAccounts: string[];
}

export interface NarrativeConnection {
  from: string;
  to: string;
  weight: number;
  description: string;
  stage: string;
}

export interface NarrativeStage {
  id: string;
  label: string;
  date: string;
  description: string;
  platforms: string[];
  mutations: string[];
}

export interface NarrativeMapData {
  narrative: string;
  description: string;
  stage: 'Emerging' | 'Circulating' | 'Mainstreamed' | 'Declining';
  viralityScore: number;
  stages: NarrativeStage[];
  platforms: NarrativeMapPlatform[];
  connections: NarrativeConnection[];
  keyAccounts: { platform: string; handle: string; role: string; followers: string }[];
  mutationHistory: { stage: string; original: string; current: string; date: string }[];
  summary: string;
  provider?: string;
}

export interface GatewayTopic {
  id: string;
  name: string;
  description: string;
  examples: string[];
  leakageRisk: 'low' | 'medium' | 'high';
  commonClaims: string[];
}

export interface BridgeFigure {
  id: string;
  name: string;
  type: 'influencer' | 'doctor' | 'media' | 'celebrity';
  followers: string;
  transitionPattern: string;
  gatewayTopics: string[];
  targetConspiracies: string[];
  leakageLevel: 'low' | 'medium' | 'high';
}

export interface ConspiracyCore {
  id: string;
  name: string;
  description: string;
  coreNarratives: string[];
  connectedGateways: string[];
  radicalizationPotential: 'low' | 'medium' | 'high';
}

export interface Pathway {
  from: string;
  to: string;
  mechanism: string;
  warningSigns: string[];
  leakagePoint: string;
}

export interface WarningBanner {
  type: 'gateway' | 'bridge' | 'conspiracy';
  title: string;
  message: string;
}

export interface DisinfoMapData {
  gatewayTopics: GatewayTopic[];
  bridgeFigures: BridgeFigure[];
  conspiracyCores: ConspiracyCore[];
  pathways: Pathway[];
  warningBanners: WarningBanner[];
  generatedAt?: string;
  provider?: string;
}

export interface OutletRating {
  id: string;
  name: string;
  url: string;
  bias: string;
  biasScore: number;
  credibility: number;
  factCheckGrade: string;
  reliability: string;
  ownership: string;
  coverage: string;
  strongAreas: string[];
  weakAreas: string[];
  notable: string;
}

export interface BiasSpectrum {
  farLeft: number;
  left: number;
  centerLeft: number;
  center: number;
  centerRight: number;
  right: number;
  farRight: number;
}

export interface OutletRatingsResponse {
  outlets: OutletRating[];
  total: number;
  biasSpectrum: BiasSpectrum;
}

export interface CoverageItem {
  outlet: string;
  headline: string;
  bias: string;
  keyQuote: string;
  emphasis: string[];
  omissions: string[];
}

export interface FramingDimension {
  dimension: string;
  spectrum: string[];
}

export interface SpectrumComparison {
  topic: string;
  outlets: OutletRating[];
  coverage: CoverageItem[];
  commonFacts: string[];
  framingDifferences: FramingDimension[];
  narrativeDivergenceScore: number;
  summary: string;
  provider: string;
}
