import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { CanAction } from '@/features/auth';
import { useBrand } from '@/shared/hooks';

export function HomePage() {
  const { t } = useTranslation('auth');
  const brand = useBrand();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const linkClass =
    'bg-primary text-primary-foreground hover:bg-primary-hover inline-flex w-full justify-center rounded-xl py-3 text-sm font-semibold shadow-sm';

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="border-border bg-card max-w-md rounded-2xl border p-8 shadow-sm">
        {brand.thumbnailUrl ? (
          <img
            src={brand.thumbnailUrl}
            alt={brand.name}
            className="mx-auto mb-4 h-24 w-auto rounded-xl object-contain"
          />
        ) : null}
        <h1 className="text-foreground text-2xl font-bold">{brand.name}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{brand.slogan}</p>

        {isAuthenticated && user ? (
          <div className="bg-primary-subtle mt-6 space-y-2 rounded-xl p-4 text-left text-xs">
            <p className="text-foreground">{user.fullName}</p>
            <p className="text-foreground">{user.email}</p>
            <p className="text-foreground font-bold">{user.role}</p>
            <Link to="/users" className={linkClass}>
              {t('home.users')}
            </Link>
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
      </div>
    </div>
  );
}
