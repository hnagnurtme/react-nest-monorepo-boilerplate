import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/shared/hooks';

/** One-click light/dark switch; the choice beats the OS preference and persists. */
export function ThemeToggle() {
  const { t } = useTranslation('common');
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors"
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
