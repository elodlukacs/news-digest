import { Outlet } from 'react-router-dom';
import { CognitiveTabNav } from './CognitiveTabNav';

export function CognitiveDashboard() {
  return (
    <div className="max-w-[1600px] mx-auto px-3 md:px-4 pb-12 view-fade">
      <div className="pt-3 md:pt-6">
        <CognitiveTabNav />
      </div>

      <div className="min-h-[500px]">
        <Outlet />
      </div>
    </div>
  );
}
