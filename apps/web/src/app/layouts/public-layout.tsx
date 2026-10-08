import { Outlet } from 'react-router-dom';

import { LanguageSwitcher, ThemeToggle } from '@/shared/ui';

/**
 * Login and the invitation screens. No sidebar and no account menu: there is no
 * session yet, so there is nothing to navigate or sign out of. Language and
 * theme stay — both are needed before signing in.
 */
export function PublicLayout() {
  return (
    <div className="bg-background relative min-h-screen">
      <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      {/* A grid slot, so a page's `min-h-full` has a definite height to fill. */}
      <div className="grid min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
