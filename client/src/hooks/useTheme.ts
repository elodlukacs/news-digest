import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';

const THEMES = ['classic', 'broadsheet', 'evening', 'morning'] as const;
export type Theme = (typeof THEMES)[number];
export { THEMES };

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    return stored && THEMES.includes(stored as Theme) ? (stored as Theme) : 'classic';
  });
  const syncedFromServer = useRef(false);

  // Sync DOM + localStorage on theme change
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    // Only PUT to server after initial server sync is complete
    if (syncedFromServer.current) {
      fetch(`${API_BASE}/settings/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: theme }),
      }).catch(() => {});
    }
  }, [theme]);

  // Fetch server-side theme on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/settings`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        syncedFromServer.current = true;
        if (data?.theme && THEMES.includes(data.theme)) {
          setThemeState(data.theme as Theme);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) syncedFromServer.current = true;
      });
    return () => controller.abort();
  }, []);

  return { theme, setTheme: setThemeState, themes: THEMES };
}
