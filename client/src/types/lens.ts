export type BiasRating = 'left' | 'lean-left' | 'center' | 'lean-right' | 'right' | 'unknown';

export interface DecodeRequest {
  headline: string;
  content: string;
}

export interface DecodeResponse {
  technique: TechniqueName;
  displayName: string;
  evidence: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  confidence: 'high' | 'medium' | 'low';
}

export interface RelatedResponse {
  articles: SourceArticle[];
}

export interface SourceArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  biasRating: BiasRating;
  publishedAt: string;
  excerpt: string;
}

export type TechniqueName =
  | 'fear-mongering'
  | 'outrage-bait'
  | 'false-urgency'
  | 'us-vs-them'
  | 'tribal-signaling'
  | 'vague-attribution'
  | 'false-dichotomy'
  | 'anecdote-as-trend'
  | 'framing-by-omission'
  | 'headline-body-mismatch'
  | 'source-laundering'
  | 'none';

export interface TechniqueResult {
  technique: TechniqueName;
  displayName: string;
  evidence: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  confidence: 'high' | 'medium' | 'low';
}

export type GutCheckReaction = 'outraged' | 'skeptical' | 'interested' | 'bored';

export interface TimelineEntry {
  articleId: number;
  source: string;
  publishedAt: string;
  title: string;
  excerpt: string;
}

export interface TimelineResult {
  framingShift: string;
  claimEvolution: string;
  inconsistency: string;
  significance: string;
  entries: TimelineEntry[];
}