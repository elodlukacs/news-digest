import { ForensicPanel } from '../analysis';
import type { ParsedSection } from '../../../components/SummaryView';

interface BiasRadarDecodeProps {
  headline: string;
  content: string;
  language?: string;
  sections?: ParsedSection[];
  categoryName?: string;
}

export default function BiasRadarDecode({ headline = '', content = '', sections = [], categoryName = '' }: BiasRadarDecodeProps) {
  return <ForensicPanel headline={headline} content={content} sections={sections} categoryName={categoryName} />;
}
