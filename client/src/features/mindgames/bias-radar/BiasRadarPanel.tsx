import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from 'focus-trap-react';
import { Search, X, ChevronDown } from 'lucide-react';
import BiasRadarCompare from './BiasRadarCompare';
import BiasRadarDecode from './BiasRadarDecode';
import BiasRadarTimeline from './BiasRadarTimeline';
import BiasRadarSteelman from './BiasRadarSteelman';
import DietReport from './DietReport';
import type { SourceArticle } from '../../../types/lens';

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
  steelman: 'Steelman',
  timeline: 'Timeline',
  diet: 'Diet Report',
};

const PRIMARY_TABS: Tab[] = ['compare', 'decode', 'steelman'];
const SECONDARY_TABS: Tab[] = ['timeline', 'diet'];

export default function BiasRadarPanel({
  headline,
  content,
  currentArticle,
  sourceName,
  language = 'English',
  onClose,
}: BiasRadarPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('compare');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSecondaryActive = SECONDARY_TABS.includes(activeTab);

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
            inset-x-0 bottom-0 rounded-t-2xl border-t max-h-[90dvh]
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
            {PRIMARY_TABS.map((tab) => (
              <button
                key={tab}
                id={`bias-radar-tab-${tab}`}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`bias-radar-panel-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => { setActiveTab(tab); setMoreOpen(false); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-b-2 border-ink text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}

            <div className="relative" ref={moreRef}>
              <button
                role="tab"
                aria-selected={isSecondaryActive}
                onClick={() => setMoreOpen(!moreOpen)}
                className={`flex items-center gap-1 py-3 px-4 text-sm font-medium transition-colors whitespace-nowrap ${
                  isSecondaryActive
                    ? 'border-b-2 border-ink text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {isSecondaryActive ? TAB_LABELS[activeTab] : 'More'}
                <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 bg-paper border border-rule rounded-lg shadow-lg z-10 min-w-[140px]">
                  {SECONDARY_TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setMoreOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        activeTab === tab
                          ? 'text-ink font-medium bg-paper-dark'
                          : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
                      }`}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
              <BiasRadarDecode headline={headline} content={content} language={language} />
            </div>
            <div
              id="bias-radar-panel-steelman"
              aria-labelledby="bias-radar-tab-steelman"
              role="tabpanel"
              style={{ display: activeTab === 'steelman' ? 'contents' : 'none' }}
            >
              <BiasRadarSteelman headline={headline} content={content} language={language} />
            </div>
            <div
              id="bias-radar-panel-timeline"
              aria-labelledby="bias-radar-tab-timeline"
              role="tabpanel"
              style={{ display: activeTab === 'timeline' ? 'contents' : 'none' }}
            >
              <BiasRadarTimeline articleId={currentArticle.id} />
            </div>
            <div
              id="bias-radar-panel-diet"
              aria-labelledby="bias-radar-tab-diet"
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
