import { FeatureInfoDialog } from '../../../../components/ui/feature-info-dialog';

interface FeaturePanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  infoTitle: string;
  researcher?: string;
  summary: string;
  sections: { heading: string; content?: string; items?: string[] }[];
  right?: React.ReactNode;
}

export function FeaturePanelHeader({ icon, title, subtitle, infoTitle, researcher, summary, sections, right }: FeaturePanelHeaderProps) {
  return (
    <div className="space-y-2 px-5 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0">{icon}</div>
          <h3 className="font-serif text-lg md:text-xl font-bold text-ink leading-tight">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {right}
          <FeatureInfoDialog
            title={infoTitle}
            researcher={researcher}
            summary={summary}
            sections={sections}
          />
        </div>
      </div>
      {subtitle && (
        <p className="text-sm text-ink-muted leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
