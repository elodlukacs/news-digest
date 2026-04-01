import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from 'focus-trap-react';
import { Search, X } from 'lucide-react';
import BiasRadarCompare from './BiasRadarCompare';
import BiasRadarDecode from './BiasRadarDecode';
import BiasRadarSteelman from './BiasRadarSteelman';
import type { SourceArticle } from '../../../types/lens';
import type { ParsedSection } from '../../../components/SummaryView';

interface BiasRadarPanelProps {
  headline: string;
  content: string;
  currentArticle: SourceArticle;
  sourceName: string;
  language?: string;
  onClose: () => void;
  initialTab?: Tab;
  sections?: ParsedSection[];
  categoryName?: string;
}

type Tab = 'compare' | 'decode' | 'steelman';

const TAB_LABELS: Record<Tab, string> = {
  compare: 'Compare',
  decode: 'Decode',
  steelman: 'Steelman',
};

export default function BiasRadarPanel({
  headline,
  content,
  currentArticle,
  sourceName,
  language = 'English',
  onClose,
  initialTab = 'compare',
  sections = [],
  categoryName = '',
}: BiasRadarPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />

      <FocusTrap
        focusTrapOptions={{
          allowOutsideClick: true,
          returnFocusOnDeactivate: true,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bias Radar"
          className={`fixed z-50 bg-paper shadow-2xl flex flex-col border-rule panel-slide-in
            inset-x-0 bottom-0 rounded-t-2xl border-t max-h-[50dvh]
            md:inset-y-0 md:right-0 md:left-auto md:rounded-none
            md:w-full md:max-w-[560px] md:border-l md:border-t-0 md:max-h-full
          `}
        >
          <div className="md:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-rule" />
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-ink" />
              <span className="font-semibold text-ink">Bias Radar</span>
              {language !== 'English' && (
                <span className="text-xs text-ink-muted ml-1">({language})</span>
              )}
            </div>
            <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
              <X size={18} />
            </button>
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
                onClick={() => setActiveTab(tab)}
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
            <div
              id="bias-radar-panel-compare"
              aria-labelledby="bias-radar-tab-compare"
              role="tabpanel"
              style={{ display: activeTab === 'compare' ? 'contents' : 'none' }}
            >
              <BiasRadarCompare
                currentArticle={currentArticle}
                searchTitle={headline}
                excludeSource={sourceName}
                language={language}
              />
            </div>
            <div
              id="bias-radar-panel-decode"
              aria-labelledby="bias-radar-tab-decode"
              role="tabpanel"
              style={{ display: activeTab === 'decode' ? 'contents' : 'none' }}
            >
              <BiasRadarDecode headline={headline} content={content} sections={sections} categoryName={categoryName} />
            </div>
            <div
              id="bias-radar-panel-steelman"
              aria-labelledby="bias-radar-tab-steelman"
              role="tabpanel"
              style={{ display: activeTab === 'steelman' ? 'contents' : 'none' }}
            >
              <BiasRadarSteelman headline={headline} content={content} language={language} />
            </div>
          </div>
        </div>
      </FocusTrap>
    </>,
    document.body
  );
}
