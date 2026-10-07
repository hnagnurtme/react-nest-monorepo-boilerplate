import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  ThemeContext,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '@/shared/hooks/use-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Browser storage can throw (private mode, blocked site data), so every access is guarded. */
function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function writeStoredPreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A viewer with storage disabled keeps the choice for this page load only.
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Owns the `dark` class on <html>. Keeping it here (and not in CSS media queries)
 * lets an explicit choice beat the OS preference, which `prefers-color-scheme`
 * alone cannot express.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      setSystemResolved(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  const theme: ResolvedTheme = preference === 'system' ? systemResolved : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeStoredPreference(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((previous) => {
      const resolved = previous === 'system' ? systemTheme() : previous;
      const next: ThemePreference = resolved === 'dark' ? 'light' : 'dark';
      writeStoredPreference(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggleTheme }),
    [preference, theme, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
