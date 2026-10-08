import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/shared/hooks';

import { IconButton } from './icon-button';

/** One-click light/dark switch; the choice beats the OS preference and persists. */
export function ThemeToggle() {
  const { t } = useTranslation('common');
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <IconButton
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      label={isDark ? t('theme.toLight') : t('theme.toDark')}
      icon={
        isDark ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )
      }
    />
  );
}
