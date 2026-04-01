import { useOutletContext } from 'react-router-dom';
import { NewspaperHome } from '../NewspaperHome';
import { useHomepage } from '../../hooks/useApi';
import type { AppOutletContext } from '../../types/routing';

export function HomeRoute() {
  const ctx = useOutletContext<AppOutletContext>();
  const { briefs: homepageBriefs, loading: homepageLoading } = useHomepage();

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12">
      <NewspaperHome
        briefs={homepageBriefs}
        loading={homepageLoading}
        onSelectCategory={ctx.onSelectCategory}
        weather={ctx.weather}
        crypto={ctx.crypto}
        rates={ctx.rates}
        headlines={ctx.headlines}
        hackerNews={ctx.hackerNews}
      />
    </div>
  );
}
