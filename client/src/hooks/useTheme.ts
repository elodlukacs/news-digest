import { useState, useEffect } from 'react';
import { API_BASE } from '../config';

const THEMES = ['classic', 'broadsheet', 'evening', 'morning'] as const;
export type Theme = (typeof THEMES)[number];
export { THEMES };

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'classic';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    fetch(`${API_BASE}/settings/theme`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: theme }),
    }).catch(() => {});
  }, [theme]);

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data.theme && THEMES.includes(data.theme)) {
          setThemeState(data.theme as Theme);
        }
      })
      .catch(() => {});
  }, []);

  return { theme, setTheme: setThemeState, themes: THEMES };
}
