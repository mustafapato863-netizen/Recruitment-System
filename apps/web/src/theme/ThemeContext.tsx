import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
  hasPersistedThemePreference: boolean;
  hasPersistedMotionPreference: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'recruitflow.theme';
const REDUCED_MOTION_STORAGE_KEY = 'recruitflow.reduced-motion';
const LEGACY_THEME_STORAGE_KEY = 'rf-theme';

function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark';
}

function hasPersistedThemePreference() {
  if (typeof window === 'undefined') return false;
  try {
    return isTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
      || isTheme(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
  } catch {
    return false;
  }
}

function hasPersistedMotionPreference() {
  if (typeof window === 'undefined') return false;
  try {
    const value = window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    return value === 'true' || value === 'false';
  } catch {
    return false;
  }
}

function readInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const bootstrappedTheme = document.documentElement.dataset.theme;
    if (isTheme(bootstrappedTheme)) return bootstrappedTheme;
  }

  if (typeof window !== 'undefined') {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isTheme(storedTheme)) return storedTheme;

      // The static v2 reference used this key. Accept it once so existing
      // preview preferences survive the migration to the React app.
      const legacyTheme = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
      if (isTheme(legacyTheme)) return legacyTheme;
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }
  }

  return 'light';
}

function readInitialReducedMotion(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const storedMotion = window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
      if (storedMotion === 'true' || storedMotion === 'false') return storedMotion === 'true';
    } catch {
      // Fall back to the device preference when storage is unavailable.
    }

    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  return false;
}

function applyTheme(theme: Theme, reducedMotion: boolean) {
  if (typeof document === 'undefined') return;

  // Temporarily disable CSS transitions during theme class switch to prevent
  // the browser compositor from freezing the screen while interpolating all DOM elements.
  let disableStyle = document.getElementById('rf-disable-theme-transitions') as HTMLStyleElement | null;
  if (!disableStyle && document.head) {
    disableStyle = document.createElement('style');
    disableStyle.id = 'rf-disable-theme-transitions';
    disableStyle.textContent = `
      *, *::before, *::after {
        -webkit-transition: none !important;
        -moz-transition: none !important;
        -o-transition: none !important;
        -ms-transition: none !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(disableStyle);
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.reducedMotion = String(reducedMotion);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;

  // Force reflow so the new color values apply instantaneously in the current frame
  void document.documentElement.offsetHeight;

  // Re-enable transitions on the next frame so normal micro-interactions and hover states work smoothly
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById('rf-disable-theme-transitions');
      if (el?.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);
  const [reducedMotion, setReducedMotionState] = useState(readInitialReducedMotion);
  const [hasStoredTheme] = useState(hasPersistedThemePreference);
  const [hasStoredMotion] = useState(hasPersistedMotionPreference);

  useEffect(() => {
    applyTheme(theme, reducedMotion);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(reducedMotion));
    } catch {
      // Theme remains active for the current page even when persistence fails.
    }
  }, [reducedMotion, theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && isTheme(event.newValue)) {
        applyTheme(event.newValue, reducedMotion);
        setThemeState(event.newValue);
      }
      if (event.key === REDUCED_MOTION_STORAGE_KEY && (event.newValue === 'true' || event.newValue === 'false')) {
        setReducedMotionState(event.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [reducedMotion]);

  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme, reducedMotion);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Storage can be unavailable in private browsing
    }
    setThemeState(nextTheme);
  }, [reducedMotion]);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const nextTheme = current === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme, reducedMotion);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // Storage can be unavailable in private browsing
      }
      return nextTheme;
    });
  }, [reducedMotion]);

  const setReducedMotion = useCallback((enabled: boolean) => {
    setReducedMotionState(enabled);
  }, []);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    effectiveTheme: theme,
    setTheme,
    toggleTheme,
    reducedMotion,
    setReducedMotion,
    hasPersistedThemePreference: hasStoredTheme,
    hasPersistedMotionPreference: hasStoredMotion,
  }), [hasStoredMotion, hasStoredTheme, reducedMotion, setReducedMotion, setTheme, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
