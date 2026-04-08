import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from 'focus-trap-react';
import { Search } from 'lucide-react';
import BiasRadarCompare from './BiasRadarCompare';
import BiasRadarDecode from './BiasRadarDecode';
import BiasRadarSteelman from './BiasRadarSteelman';
import type { SourceArticle } from '../../../types/lens';
import type { ParsedSection } from '../../../components/SummaryView';

interface BiasRadarPanelProps {
  headline: string;
  content: string;
  originalContent?: string;
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

const DISMISS_THRESHOLD = 120;

export default function BiasRadarPanel({
  headline,
  content,
  originalContent,
  currentArticle,
  sourceName,
  language = 'English',
  onClose,
  initialTab = 'compare',
  sections = [],
  categoryName = '',
}: BiasRadarPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [compareKey, setCompareKey] = useState(0);
  const [dragY, setDragY] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const touchState = useRef({ active: false, startY: 0 });

  useEffect(() => {
    const panel = panelRef.current;
    const handle = handleRef.current;
    if (!panel || !handle) return;

    function onTouchStart(e: TouchEvent) {
      touchState.current = {
        active: true,
        startY: e.touches[0].clientY,
      };
    }

    function onTouchMove(e: TouchEvent) {
      if (!panel) return;
      const state = touchState.current;
      if (!state.active) return;

      const diff = e.touches[0].clientY - state.startY;
      if (diff < 0) {
        setDragY(null);
        return;
      }

      e.preventDefault();
      setDragY(diff);
    }

    function onTouchEnd() {
      touchState.current.active = false;
      setDragY((prev) => {
        if (prev !== null && prev > DISMISS_THRESHOLD) {
          onClose();
        }
        return null;
      });
    }

    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove', onTouchMove, { passive: false });
    handle.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      handle.removeEventListener('touchstart', onTouchStart);
      handle.removeEventListener('touchmove', onTouchMove);
      handle.removeEventListener('touchend', onTouchEnd);
    };
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const panelTransform = dragY !== null ? `translateY(${dragY}px)` : undefined;
  const panelOpacity = dragY !== null ? Math.max(0, 1 - dragY / 400) : undefined;
  const backdropOpacity = dragY !== null ? Math.max(0, 0.3 - dragY / 1000) : undefined;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
        style={backdropOpacity !== undefined ? { opacity: backdropOpacity } : undefined}
      />

      <FocusTrap
        focusTrapOptions={{
          allowOutsideClick: true,
          returnFocusOnDeactivate: true,
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Bias Radar"
          className={`fixed z-50 bg-paper shadow-2xl flex flex-col border-rule panel-slide-in
            inset-0 rounded-t-2xl border-t
            md:inset-y-0 md:right-0 md:left-auto md:rounded-none
            md:w-full md:max-w-[560px] md:border-l md:border-t-0
          `}
          style={{
            transform: panelTransform,
            opacity: panelOpacity,
            transition: dragY !== null ? 'none' : undefined,
          }}
        >
          <div ref={handleRef} className="md:hidden flex justify-center pt-3 pb-1 cursor-grab">
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
{/* Desktop-only close via Escape key; mobile dismisses with swipe-down */}
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
              <div
                id="bias-radar-panel-compare"
                aria-labelledby="bias-radar-tab-compare"
                role="tabpanel"
              >
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
              <div
                id="bias-radar-panel-decode"
                aria-labelledby="bias-radar-tab-decode"
                role="tabpanel"
              >
                <BiasRadarDecode headline={headline} content={content} originalContent={originalContent} sections={sections} categoryName={categoryName} />
              </div>
            )}
            {activeTab === 'steelman' && (
              <div
                id="bias-radar-panel-steelman"
                aria-labelledby="bias-radar-tab-steelman"
                role="tabpanel"
              >
                <BiasRadarSteelman headline={headline} content={content} language={language} />
              </div>
            )}
          </div>
        </div>
      </FocusTrap>
    </>,
    document.body
  );
}
