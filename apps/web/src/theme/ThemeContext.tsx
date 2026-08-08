import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type Theme = 'light';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/* V1 is intentionally light-only. Keeping the provider makes a future theme a safe additive change. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('dark');
  }, []);

  const setTheme = () => {
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('dark');
  };

  return <ThemeContext.Provider value={{ theme: 'light', effectiveTheme: 'light', setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
