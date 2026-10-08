import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { IconButton, LanguageSwitcher, ThemeToggle } from '@/shared/ui';

import { allLeaves } from './nav';
import { UserMenu } from './user-menu';

export interface HeaderProps {
  onOpenSidebar: () => void;
}

/**
 * The app bar: where you are on the left, who you are and how things look on
 * the right. Each page used to place the language and theme controls itself,
 * which is how two pages ended up with a different set of them.
 *
 * The tenant is not here. It used to be a select in this row, which put a
 * destructive action — moving the whole tab to another tenant's data, throwing
 * away every cached query — one stray click away from the theme toggle. It now
 * sits in the account menu, where the rest of the session-wide actions are.
 */
export function Header({ onOpenSidebar }: HeaderProps) {
  const { t } = useTranslation('nav');
  const location = useLocation();

  const current = allLeaves().find((leaf) => leaf.path === location.pathname);

  return (
    <header className="border-border bg-card sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3">
      <IconButton
        variant="ghost"
        size="sm"
        className="lg:hidden"
        onClick={onOpenSidebar}
        label={t('sidebar.open')}
        icon={<Menu className="size-5" aria-hidden="true" />}
      />

      <h1 className="text-foreground text-heading min-w-0 flex-1 truncate font-bold">
        {current === undefined ? '' : t(current.labelKey)}
      </h1>

      <LanguageSwitcher />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
