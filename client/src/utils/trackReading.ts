interface ArticleView {
  url: string;
  source: string;
  title?: string;
}

export function trackArticleOpen(article: ArticleView): void {
  const today = new Date().toISOString().slice(0, 10);
  const key = `diet_tracking_${today}`;
  
  try {
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(existing)) {
      localStorage.setItem(key, JSON.stringify([article]));
      return;
    }
    
    const alreadyTracked = existing.some((a: ArticleView) => a.url === article.url);
    if (!alreadyTracked) {
      const updated = [...existing, article];
      localStorage.setItem(key, JSON.stringify(updated));
    }
  } catch {
    localStorage.setItem(key, JSON.stringify([article]));
  }
}

export function cleanupOldData(): void {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  for (let i = 31; i < 365; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const key = `diet_tracking_${dateStr}`;
    localStorage.removeItem(key);
  }
}

export function getWeeklyReadingStats(): { total: number; sources: string[] } {
  const stats = { total: 0, sources: [] as string[] };
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const key = `diet_tracking_${dateStr}`;
    
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const articles = JSON.parse(stored);
        stats.total += Array.isArray(articles) ? articles.length : 0;
      }
    } catch {
      // ignore
    }
  }
  
  return stats;
}