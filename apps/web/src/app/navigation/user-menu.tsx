import { ArrowLeftRight, ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { useActiveTenant, useLogout } from '@/features/auth';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/shared/ui';

/**
 * The signed-in account and what it can do to its own session: change the tenant
 * it is working in, and sign out.
 *
 * Signing out goes through the API rather than only clearing the store: the
 * refresh token is a row in `sessions`, so a local-only sign-out leaves a
 * usable session behind.
 *
 * Switching tenant is a link to the chooser rather than a select in this menu.
 * It discards every cached query, so it deserves a page that names the tenants
 * and the consequence, not a control that changes the whole tab on hover-click.
 */
export function UserMenu() {
  const { t } = useTranslation('nav');
  const { t: tAuth } = useTranslation('auth');
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const { tenants, activeTenant } = useActiveTenant();
  const logout = useLogout();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: globalThis.MouseEvent): void => {
      if (!(event.target instanceof Node)) return;
      if (containerRef.current?.contains(event.target) === true) return;
      setIsOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (user === null) return null;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('account.menu')}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
      >
        <UserRound className="size-4" aria-hidden="true" />
        {/*
          `max-w-form` is the width of a sign-in form (26rem), so a long address
          stretched this trigger to 416px and pushed the rest of the app bar
          around. The email is an identifier here, not the label — 10rem is
          enough to recognise it, and the menu below prints it in full.
        */}
        <span className="hidden max-w-40 truncate sm:inline">{user.email}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </Button>

      {isOpen ? (
        <div
          role="menu"
          aria-label={t('account.menu')}
          className="border-border bg-card rounded-overlay shadow-floating absolute right-0 z-30 mt-2 w-64 border p-2"
        >
          <div className="px-3 py-2">
            <p className="text-foreground text-body truncate font-semibold">{user.fullName}</p>
            <p className="text-muted-foreground text-label truncate">{user.email}</p>
            {activeTenant === null ? null : (
              // With the switcher gone from the app bar, this is the only place
              // that says which tenant the tab is acting in.
              <p className="text-muted-foreground text-label mt-1 truncate">
                {`${tAuth('selectTenant.current')}: ${activeTenant.name}`}
              </p>
            )}
          </div>
          {tenants.length < 2 ? null : (
            <Link
              role="menuitem"
              to="/select-tenant?change=1"
              state={{ from: { pathname: location.pathname } }}
              onClick={() => {
                setIsOpen(false);
              }}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm', isFullWidth: true }),
                'justify-start',
              )}
            >
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              {t('account.switchTenant')}
            </Link>
          )}
          <Button
            role="menuitem"
            variant="ghost"
            size="sm"
            isFullWidth
            className="justify-start"
            isLoading={logout.isPending}
            onClick={() => {
              logout.mutate();
            }}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {t('account.signOut')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
