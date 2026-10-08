import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { CanAction, TenantSwitcher } from '@/features/auth';
import { useBrand } from '@/shared/hooks';
import {
  Alert,
  Button,
  Card,
  LanguageSwitcher,
  PageShell,
  Stack,
  ThemeToggle,
  buttonVariants,
} from '@/shared/ui';

export function HomePage() {
  const { t } = useTranslation('auth');
  const brand = useBrand();
  const location = useLocation();
  const accessDenied = (location.state as { accessDenied?: boolean } | null)?.accessDenied === true;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  /**
   * A router `Link` that looks like a button takes the Button's own class string
   * rather than a copy of it, so the two can never drift (rule 11, section E6).
   */
  const linkClass = buttonVariants({ isFullWidth: true });

  return (
    <PageShell width="form" isCentered className="relative text-center">
      <div className="absolute right-6 top-6 flex items-center gap-3">
        <TenantSwitcher />
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <Card className="p-8">
        {brand.thumbnailUrl ? (
          <img
            src={brand.thumbnailUrl}
            alt={brand.name}
            width={160}
            height={96}
            className="rounded-surface mx-auto mb-4 h-24 w-auto object-contain"
          />
        ) : null}
        {accessDenied ? <Alert className="mb-4 text-left">{t('home.accessDenied')}</Alert> : null}
        <h1 className="text-foreground text-title font-bold">{brand.name}</h1>
        <p className="text-muted-foreground text-body mt-2">{brand.slogan}</p>

        {isAuthenticated && user ? (
          <Stack gap="snug" className="bg-primary-subtle rounded-surface mt-6 p-4 text-left">
            <p className="text-foreground text-body">{user.fullName}</p>
            <p className="text-foreground text-body">{user.email}</p>
            <p className="text-foreground text-body font-bold">
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
            <Button variant="destructive" isFullWidth onClick={clearAuth}>
              {t('home.signOut')}
            </Button>
          </Stack>
        ) : (
          <div className="mt-6">
            <Link to="/login" className={linkClass}>
              {t('form.submit')}
            </Link>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
