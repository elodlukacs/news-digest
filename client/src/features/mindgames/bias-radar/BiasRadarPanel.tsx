import { useState } from 'react';
import { Search } from 'lucide-react';
import BiasRadarCompare from './BiasRadarCompare';
import BiasRadarDecode from './BiasRadarDecode';
import BiasRadarSteelman from './BiasRadarSteelman';
import BiasRadarRabbitHole from './BiasRadarRabbitHole';
import type { SourceArticle } from '../../../types/lens';
import type { ParsedSection } from '../../../components/SummaryView';
import { Drawer, DrawerContent, DrawerTitle } from '../../../components/ui/drawer';
import { Sheet, SheetContent, SheetTitle } from '../../../components/ui/sheet';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

interface BiasRadarPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headline: string;
  content: string;
  originalContent?: string;
  currentArticle: SourceArticle;
  sourceName: string;
  language?: string;
  initialTab?: Tab;
  sections?: ParsedSection[];
  categoryName?: string;
}

type Tab = 'compare' | 'decode' | 'steelman' | 'rabbit-hole';

const TAB_LABELS: Record<Tab, string> = {
  compare: 'Compare',
  decode: 'Decode',
  steelman: 'Steelman',
  'rabbit-hole': 'Rabbit Hole',
};

export default function BiasRadarPanel({
  open,
  onOpenChange,
  headline,
  content,
  originalContent,
  currentArticle,
  sourceName,
  language = 'English',
  initialTab = 'compare',
  sections = [],
  categoryName = '',
}: BiasRadarPanelProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const body = (
    <BiasRadarBody
      isDesktop={isDesktop}
      headline={headline}
      content={content}
      originalContent={originalContent}
      currentArticle={currentArticle}
      sourceName={sourceName}
      language={language}
      initialTab={initialTab}
      sections={sections}
      categoryName={categoryName}
    />
  );

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="!p-0 sm:!max-w-[560px] w-full flex flex-col bg-paper gap-0"
        >
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent
        className="!max-h-[92dvh] bg-paper"
        style={{ paddingBottom: 'var(--kbd, 0px)' }}
      >
        {body}
      </DrawerContent>
    </Drawer>
  );
}

interface BiasRadarBodyProps {
  isDesktop: boolean;
  headline: string;
  content: string;
  originalContent?: string;
  currentArticle: SourceArticle;
  sourceName: string;
  language: string;
  initialTab: Tab;
  sections: ParsedSection[];
  categoryName: string;
}

function BiasRadarBody({
  isDesktop,
  headline,
  content,
  originalContent,
  currentArticle,
  sourceName,
  language,
  initialTab,
  sections,
  categoryName,
}: BiasRadarBodyProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [compareKey, setCompareKey] = useState(0);
  const Title = isDesktop ? SheetTitle : DrawerTitle;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-rule">
        <Search size={18} className="text-ink" />
        <Title className="font-semibold text-ink text-base m-0">
          Bias Radar
        </Title>
        {language !== 'English' && (
          <span className="text-xs text-ink-muted ml-1">({language})</span>
        )}
      </div>

      <div className="px-5 py-3 border-b border-rule bg-paper-dark">
        <p className="text-[13px] font-serif font-semibold text-ink line-clamp-2 leading-snug">
          {headline}
        </p>
        <p className="text-[11px] text-ink-muted mt-0.5">{sourceName}</p>
      </div>

      <div className="flex border-b border-rule" role="tablist">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            id={`bias-radar-tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`bias-radar-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'compare') setCompareKey(k => k + 1);
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-b-2 border-ink text-ink'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'compare' && (
          <div id="bias-radar-panel-compare" aria-labelledby="bias-radar-tab-compare" role="tabpanel">
            <BiasRadarCompare
              key={compareKey}
              currentArticle={currentArticle}
              searchTitle={headline}
              excludeSource={sourceName}
              language={language}
            />
          </div>
        )}
        {activeTab === 'decode' && (
          <div id="bias-radar-panel-decode" aria-labelledby="bias-radar-tab-decode" role="tabpanel">
            <BiasRadarDecode headline={headline} content={content} originalContent={originalContent} sections={sections} categoryName={categoryName} />
          </div>
        )}
        {activeTab === 'steelman' && (
          <div id="bias-radar-panel-steelman" aria-labelledby="bias-radar-tab-steelman" role="tabpanel">
            <BiasRadarSteelman headline={headline} content={content} language={language} />
          </div>
        )}
        {activeTab === 'rabbit-hole' && (
          <div id="bias-radar-panel-rabbit-hole" aria-labelledby="bias-radar-tab-rabbit-hole" role="tabpanel">
            <BiasRadarRabbitHole headline={headline} content={content} language={language} />
          </div>
        )}
      </div>
    </div>
  );
}
