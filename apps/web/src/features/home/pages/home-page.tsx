import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { CanAction } from '@/features/auth';
import { useBrand } from '@/shared/hooks';
import { Card, LanguageSwitcher, ThemeToggle } from '@/shared/ui';

export function HomePage() {
  const { t } = useTranslation('auth');
  const brand = useBrand();
  const location = useLocation();
  const accessDenied = (location.state as { accessDenied?: boolean } | null)?.accessDenied === true;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const linkClass =
    'bg-primary text-primary-foreground hover:bg-primary-hover inline-flex w-full justify-center rounded-xl py-3 text-sm font-semibold shadow-sm';

  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="absolute right-6 top-6 flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <Card className="max-w-md p-8 shadow-sm">
        {brand.thumbnailUrl ? (
          <img
            src={brand.thumbnailUrl}
            alt={brand.name}
            className="mx-auto mb-4 h-24 w-auto rounded-xl object-contain"
          />
        ) : null}
        {accessDenied ? (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-xs"
          >
            {t('home.accessDenied')}
          </p>
        ) : null}
        <h1 className="text-foreground text-2xl font-bold">{brand.name}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{brand.slogan}</p>

        {isAuthenticated && user ? (
          <div className="bg-primary-subtle mt-6 space-y-2 rounded-xl p-4 text-left text-xs">
            <p className="text-foreground">{user.fullName}</p>
            <p className="text-foreground">{user.email}</p>
            <p className="text-foreground font-bold">
              {user.roles.map((role) => role.name).join(', ')}
            </p>
            <CanAction I="read" a="User">
              <Link to="/users" className={linkClass}>
                {t('home.users')}
              </Link>
            </CanAction>
            <CanAction I="read" a="Role">
              <Link to="/roles" className={linkClass}>
                {t('home.roles')}
              </Link>
            </CanAction>
            <CanAction I="create" a="Tenant">
              <Link to="/tenants" className={linkClass}>
                {t('home.tenants')}
              </Link>
            </CanAction>
            <button
              type="button"
              onClick={clearAuth}
              className="bg-destructive text-destructive-foreground w-full cursor-pointer rounded-lg py-2 text-xs font-semibold hover:opacity-90"
            >
              {t('home.signOut')}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <Link to="/login" className={linkClass}>
              {t('form.submit')}
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
