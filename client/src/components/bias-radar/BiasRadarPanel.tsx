import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from 'focus-trap-react';
import { Search, X } from 'lucide-react';
import BiasRadarCompare from './BiasRadarCompare';
import BiasRadarDecode from './BiasRadarDecode';
import BiasRadarTimeline from './BiasRadarTimeline';
import BiasRadarSteelman from './BiasRadarSteelman';
import DietReport from './DietReport';
import type { SourceArticle } from '../../types/lens';

interface BiasRadarPanelProps {
  headline: string;
  content: string;
  currentArticle: SourceArticle;
  sourceName: string;
  language?: string;
  onClose: () => void;
}

type Tab = 'compare' | 'decode' | 'steelman' | 'timeline' | 'diet';

const TAB_LABELS: Record<Tab, string> = {
  compare: 'Compare',
  decode: 'Decode',
  steelman: 'Challenge Me',
  timeline: 'Timeline',
  diet: 'Diet Report',
};

const TAB_ORDER: Tab[] = ['compare', 'decode', 'steelman', 'timeline', 'diet'];

export default function BiasRadarPanel({
  headline,
  content,
  currentArticle,
  sourceName,
  language = 'English',
  onClose,
}: BiasRadarPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('compare');

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
          className="fixed inset-y-0 right-0 w-full max-w-[560px] bg-paper shadow-2xl flex flex-col z-50 border-l border-rule panel-slide-in"
        >
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

          <div className="flex border-b border-rule overflow-x-auto" role="tablist">
            {TAB_ORDER.map((tab) => (
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
              id={`bias-radar-panel-compare`}
              aria-labelledby={`bias-radar-tab-compare`}
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
              id={`bias-radar-panel-decode`}
              aria-labelledby={`bias-radar-tab-decode`}
              role="tabpanel"
              style={{ display: activeTab === 'decode' ? 'contents' : 'none' }}
            >
              <BiasRadarDecode headline={headline} content={content} language={language} />
            </div>
            <div
              id={`bias-radar-panel-steelman`}
              aria-labelledby={`bias-radar-tab-steelman`}
              role="tabpanel"
              style={{ display: activeTab === 'steelman' ? 'contents' : 'none' }}
            >
              <BiasRadarSteelman headline={headline} content={content} language={language} />
            </div>
            <div
              id={`bias-radar-panel-timeline`}
              aria-labelledby={`bias-radar-tab-timeline`}
              role="tabpanel"
              style={{ display: activeTab === 'timeline' ? 'contents' : 'none' }}
            >
              <BiasRadarTimeline articleId={currentArticle.id} />
            </div>
            <div
              id={`bias-radar-panel-diet`}
              aria-labelledby={`bias-radar-tab-diet`}
              role="tabpanel"
              style={{ display: activeTab === 'diet' ? 'contents' : 'none' }}
            >
              <DietReport />
            </div>
          </div>
        </div>
      </FocusTrap>
    </>,
    document.body
  );
}
