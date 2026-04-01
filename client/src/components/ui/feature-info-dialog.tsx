import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { DialogTrigger } from '@radix-ui/react-dialog';

interface InfoSection {
  heading: string;
  content?: string;
  items?: string[];
}

interface FeatureInfoDialogProps {
  title: string;
  researcher?: string;
  summary: string;
  sections: InfoSection[];
  buttonLabel?: string;
}

export function FeatureInfoDialog({ title, researcher, summary, sections, buttonLabel = 'The science' }: FeatureInfoDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-masthead/10 text-masthead hover:bg-masthead/20 transition-colors duration-200 cursor-pointer shrink-0 min-h-[32px]"
          aria-label={`Learn more about ${title}`}
        >
          <Info size={13} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">{buttonLabel}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="top-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-full rounded-none overflow-y-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-xl sm:w-full sm:h-auto sm:max-h-[80vh] sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
          {researcher && (
            <p className="text-[10px] uppercase tracking-widest text-ink-muted font-semibold mt-0.5">{researcher}</p>
          )}
          <DialogDescription className="text-[13px] text-ink-muted leading-relaxed pt-1">
            {summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {sections.map((section) => (
            <div key={section.heading}>
              <h4 className="text-[11px] uppercase tracking-widest font-bold text-ink-muted mb-1.5">{section.heading}</h4>
              {section.content && (
                <p className="text-[13px] text-ink leading-relaxed">{section.content}</p>
              )}
              {section.items && (
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[13px] text-ink leading-relaxed">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-masthead shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
