import { ForensicPanel } from '../analysis';
import type { ParsedSection } from '../../../components/SummaryView';

interface BiasRadarDecodeProps {
  headline: string;
  content: string;
  originalContent?: string;
  language?: string;
  sections?: ParsedSection[];
  categoryName?: string;
}

export default function BiasRadarDecode({ headline = '', content = '', originalContent = '', sections = [], categoryName = '' }: BiasRadarDecodeProps) {
  return <ForensicPanel headline={headline} content={content} originalContent={originalContent} sections={sections} categoryName={categoryName} />;
}
