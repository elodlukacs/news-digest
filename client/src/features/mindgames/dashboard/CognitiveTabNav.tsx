import { useLocation, useNavigate } from 'react-router-dom';
import { Shield, Target, Search, Microscope, BookOpen, Zap } from 'lucide-react';
import type { CognitiveTab } from './types';

const TABS: { id: CognitiveTab; path: string; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { id: 'overview', path: '/mindgames', label: 'Overview', shortLabel: 'Home', icon: <Shield size={16} /> },
  { id: 'training', path: '/mindgames/training', label: 'Training', shortLabel: 'Train', icon: <Target size={16} /> },
  { id: 'analysis', path: '/mindgames/analysis', label: 'Analysis', shortLabel: 'Analyze', icon: <Search size={16} /> },
  { id: 'reflection', path: '/mindgames/reflection', label: 'Reflection', shortLabel: 'Reflect', icon: <Microscope size={16} /> },
  { id: 'reference', path: '/mindgames/reference', label: 'Reference', shortLabel: 'Library', icon: <BookOpen size={16} /> },
  { id: 'quiz', path: '/mindgames/quiz', label: 'Daily Quiz', shortLabel: 'Quiz', icon: <Zap size={16} /> },
];

function getActiveTab(pathname: string): CognitiveTab {
  if (pathname === '/mindgames') return 'overview';
  const match = pathname.match(/^\/mindgames\/(\w+)/);
  if (match && TABS.some((t) => t.id === match[1])) return match[1] as CognitiveTab;
  return 'overview';
}

export function CognitiveTabNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTab(location.pathname);

  return (
    <>
      <div role="tablist" className="grid grid-cols-3 gap-1.5 p-1 bg-paper-dark rounded-xl border border-rule shadow-sm md:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => navigate(tab.path)}
            className={`flex items-center justify-center gap-1.5 px-2 py-3 text-[11px] font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-masthead text-white shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-paper'
            }`}
          >
            {tab.icon}
            <span>{tab.shortLabel}</span>
          </button>
        ))}
      </div>

      <div role="tablist" className="hidden md:flex md:justify-center md:mx-auto">
        <div className="inline-flex items-center gap-1 p-1 bg-paper-dark rounded-xl border border-rule shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-masthead text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink hover:bg-paper'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
