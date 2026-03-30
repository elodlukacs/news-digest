import { FeatureInfoDialog } from '../../../../components/ui/feature-info-dialog';

interface FeaturePanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  infoTitle: string;
  researcher?: string;
  summary: string;
  sections: { heading: string; content?: string; items?: string[] }[];
  right?: React.ReactNode;
}

export function FeaturePanelHeader({ icon, title, infoTitle, researcher, summary, sections, right }: FeaturePanelHeaderProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-serif text-base font-bold uppercase tracking-wide text-ink">{title}</h3>
      </div>
      <div className="flex items-center justify-between">
        <FeatureInfoDialog
          title={infoTitle}
          researcher={researcher}
          summary={summary}
          sections={sections}
        />
        {right}
      </div>
    </div>
  );
}
