import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Target, Scissors, Microscope, BookOpen, Zap } from 'lucide-react';
import type React from 'react';
import type { CognitiveTab } from './types';

const TABS: { id: CognitiveTab; path: string; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { id: 'overview', path: '/mindgames', label: 'Today', shortLabel: 'Today', icon: <Home size={18} /> },
  { id: 'training', path: '/mindgames/training', label: 'Spot It', shortLabel: 'Spot It', icon: <Target size={18} /> },
  { id: 'analysis', path: '/mindgames/analysis', label: 'Dissect', shortLabel: 'Dissect', icon: <Scissors size={18} /> },
  { id: 'reflection', path: '/mindgames/reflection', label: 'Think Harder', shortLabel: 'Think', icon: <Microscope size={18} /> },
  { id: 'reference', path: '/mindgames/reference', label: 'Playbook', shortLabel: 'Playbook', icon: <BookOpen size={18} /> },
  { id: 'quiz', path: '/mindgames/quiz', label: 'Daily Challenge', shortLabel: 'Challenge', icon: <Zap size={18} /> },
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
      <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-paper border-t border-rule safe-area-pb">
        <div className="flex items-stretch h-16">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer active:bg-paper-dark ${
                activeTab === tab.id ? 'text-ink' : 'text-ink-muted'
              }`}
            >
              {tab.icon}
              <span>{tab.shortLabel}</span>
              {activeTab === tab.id && (
                <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-ink" />
              )}
            </button>
          ))}
        </div>
      </nav>

      <div role="tablist" className="hidden md:flex md:justify-center md:mx-auto">
        <div className="inline-flex items-center gap-1 p-1.5 bg-paper-dark rounded-xl border border-rule">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-paper text-ink shadow-sm border border-rule'
                  : 'text-ink-muted hover:text-ink hover:bg-paper/50'
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
