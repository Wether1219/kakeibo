import { useState } from 'react';
import { Theme, applyTheme, getInitialTheme } from '../theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = (next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return { theme, setTheme, toggleTheme };
}
