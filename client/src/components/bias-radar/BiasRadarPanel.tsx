import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import BiasRadarCompare from './BiasRadarCompare';
import BiasRadarDecode from './BiasRadarDecode';
import BiasRadarTimeline from './BiasRadarTimeline';
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

type Tab = 'compare' | 'decode' | 'timeline' | 'diet';

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
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-paper shadow-2xl flex flex-col z-50 border-l border-rule">
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

        <div className="flex border-b border-rule">
          {(['compare', 'decode', 'timeline', 'diet'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-ink text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab === 'compare' ? 'Compare Coverage' : tab === 'decode' ? 'Decode Article' : tab === 'timeline' ? 'Timeline' : tab === 'diet' ? 'Diet Report' : 'Timeline'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'compare' && (
            <BiasRadarCompare
              currentArticle={currentArticle}
              searchTitle={headline}
              excludeSource={sourceName}
              language={language}
            />
          )}
          {activeTab === 'decode' && (
            <BiasRadarDecode headline={headline} content={content} />
          )}
          {activeTab === 'timeline' && (
            <BiasRadarTimeline articleId={currentArticle.id} />
          )}
          {activeTab === 'diet' && (
            <DietReport />
          )}
        </div>
      </div>
    </>,
    document.body
  );
}