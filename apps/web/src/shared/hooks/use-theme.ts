import { createContext, useContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'app.theme';

export interface ThemeContextValue {
  /** What the user picked; `system` follows the OS. */
  preference: ThemePreference;
  /** What is actually painted right now. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Flips between light and dark, resolving `system` first. */
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
