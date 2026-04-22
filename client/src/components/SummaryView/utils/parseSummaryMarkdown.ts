import type { Summary } from '../../../types';

export interface ParsedSection {
  title: string;
  url: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
  originalContent?: string;
  source?: string;
  pubDate?: string;
  imageUrl?: string;
}

export function parseSummaryMarkdown(
  markdown: string,
  sentimentData: Summary['sentiment_data'],
): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const parts = markdown.split(/\n---\n/);

  const sentimentByTitle = new Map<string, 'positive' | 'negative' | 'neutral' | 'mixed'>();
  const originalContentByTitle = new Map<string, string>();
  const sourceByTitle = new Map<string, string>();
  const pubDateByTitle = new Map<string, string>();
  const imageByTitle = new Map<string, string>();

  if (sentimentData) {
    for (const entry of sentimentData) {
      if (entry.title && entry.sentiment) {
        sentimentByTitle.set(entry.title.toLowerCase(), entry.sentiment);
      }
      if (entry.title && entry.original_content) {
        originalContentByTitle.set(entry.title.toLowerCase(), entry.original_content);
      }
      if (entry.title && entry.source) {
        sourceByTitle.set(entry.title.toLowerCase(), entry.source);
      }
      if (entry.title && entry.pub_date) {
        pubDateByTitle.set(entry.title.toLowerCase(), entry.pub_date);
      }
      if (entry.title && entry.image) {
        imageByTitle.set(entry.title.toLowerCase(), entry.image);
      }
    }
  }

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const linkMatch = trimmed.match(/^##\s+\[([^\]]+)\]\(([^)]+)\)/);
    const title = linkMatch
      ? linkMatch[1]
      : trimmed.split('\n')[0].replace(/^#+\s*/, '').replace(/\*\*/g, '');
    const url = linkMatch ? linkMatch[2] : '';

    let content = trimmed
      .replace(/^##\s+\[[^\]]+\]\([^)]+\)/, '')
      .replace(/^#+\s*/, '')
      .trim();

    content = content
      .replace(/出自\s*[^。]+。/g, '')
      .replace(/Source:\s*[^\n]+/gi, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    sections.push({
      title,
      url,
      content,
      sentiment: sentimentByTitle.get(title.toLowerCase()) || null,
      originalContent: originalContentByTitle.get(title.toLowerCase()) || '',
      source: sourceByTitle.get(title.toLowerCase()),
      pubDate: pubDateByTitle.get(title.toLowerCase()),
      imageUrl: imageByTitle.get(title.toLowerCase()),
    });
  }

  return sections;
}
