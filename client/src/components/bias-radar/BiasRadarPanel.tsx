import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import BiasRadarCompare from './BiasRadarCompare';
import BiasRadarDecode from './BiasRadarDecode';
import type { SourceArticle } from '../../types/lens';

interface BiasRadarPanelProps {
  articleId: string;
  headline: string;
  content: string;
  currentArticle: SourceArticle;
  onClose: () => void;
}

type Tab = 'compare' | 'decode';

export default function BiasRadarPanel({
  articleId,
  headline,
  content,
  currentArticle,
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

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-[420px] bg-paper shadow-2xl flex flex-col z-50 border-l border-rule">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-ink" />
            <span className="font-semibold text-ink">Bias Radar</span>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-rule">
          {(['compare', 'decode'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-ink text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab === 'compare' ? 'Compare Coverage' : 'Decode Article'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'compare' ? (
            <BiasRadarCompare articleId={articleId} currentArticle={currentArticle} />
          ) : (
            <BiasRadarDecode headline={headline} content={content} />
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
