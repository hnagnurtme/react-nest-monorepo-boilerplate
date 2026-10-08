import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/entities/session';
import { useLogout } from '@/features/auth';
import { Button } from '@/shared/ui';

/**
 * The signed-in account, and the two things it can do to its own session.
 *
 * Signing out goes through the API rather than only clearing the store: the
 * refresh token is a row in `sessions`, so a local-only sign-out leaves a
 * usable session behind.
 */
export function UserMenu() {
  const { t } = useTranslation('nav');
  const user = useAuthStore((state) => state.user);
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
        <span className="max-w-form hidden truncate sm:inline">{user.email}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </Button>

      {isOpen ? (
        <div
          role="menu"
          aria-label={t('account.menu')}
          className="border-border bg-card rounded-overlay shadow-floating w-form absolute right-0 z-30 mt-2 border p-2"
        >
          <div className="px-3 py-2">
            <p className="text-foreground text-body truncate font-semibold">{user.fullName}</p>
            <p className="text-muted-foreground text-label truncate">{user.email}</p>
          </div>
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
