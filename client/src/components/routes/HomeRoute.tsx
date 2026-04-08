import { useOutletContext } from 'react-router-dom';
import { NewspaperHome } from '../NewspaperHome';
import { useHomepage } from '../../hooks/useApi';
import { useWidgets } from '../../hooks/useWidgets';
import type { AppOutletContext } from '../../types/routing';

export function HomeRoute() {
  const ctx = useOutletContext<AppOutletContext>();
  const { briefs: homepageBriefs, loading: homepageLoading } = useHomepage();
  const { weather, crypto, rates, headlines, hackerNews } = useWidgets();

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12">
      <NewspaperHome
        briefs={homepageBriefs}
        loading={homepageLoading}
        onSelectCategory={ctx.onSelectCategory}
        weather={weather}
        crypto={crypto}
        rates={rates}
        headlines={headlines}
        hackerNews={hackerNews}
        categoryNames={ctx.categories.map(c => c.name)}
      />
    </div>
  );
}
