import { useOutletContext } from 'react-router-dom';
import { JobsPage } from '../JobsPage';
import { useJobs } from '../../hooks/useApi';
import type { AppOutletContext } from '../../types/routing';

export function JobsRoute() {
  const ctx = useOutletContext<AppOutletContext>();
  const { fetchJobs, ...jobsHook } = useJobs();

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12 view-fade">
      <JobsPage {...jobsHook} fetchJobs={fetchJobs} selectedLlm={ctx.selectedLlm} />
    </div>
  );
}
