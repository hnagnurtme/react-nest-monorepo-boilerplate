import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { useActiveTenant } from '@/features/auth';
import { TenantLauncher } from '@/features/home/components/tenant-launcher';
import { useBrand } from '@/shared/hooks';
import { Alert, PageShell } from '@/shared/ui';

/**
 * The brand page — and, for a platform account that has not chosen a tenant
 * yet, the tenant chooser.
 *
 * A platform account belongs to no tenant, so there is no standalone screen to
 * send it to: the chooser is this page's content, inside the app shell, where
 * the sidebar and the platform pages keep working. `?change=1` reopens it on
 * purpose, which is what the account menu links to; the flag lives in the query
 * string so reloading the page one is looking at does not change what it does.
 */
export function HomePage() {
  const { t } = useTranslation('auth');
  const brand = useBrand();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const { activeTenantId } = useActiveTenant();
  const accessDenied = (location.state as { accessDenied?: boolean } | null)?.accessDenied === true;

  const isPlatform = user?.scope === 'platform';
  const isChoosing = isPlatform && (activeTenantId === null || searchParams.get('change') === '1');

  if (isChoosing) {
    return (
      <PageShell width="full" isFullHeight>
        {accessDenied ? <Alert>{t('home.accessDenied')}</Alert> : null}
        <TenantLauncher />
      </PageShell>
    );
  }

  return (
    <PageShell width="full" isCentered className="text-center">
      {accessDenied ? (
        <Alert className="max-w-form mx-auto text-left">{t('home.accessDenied')}</Alert>
      ) : null}

      {brand.thumbnailUrl ? (
        <img
          src={brand.thumbnailUrl}
          alt={brand.name}
          width={320}
          height={192}
          className="rounded-surface mx-auto h-48 w-auto object-contain"
        />
      ) : null}
      <h1 className="text-foreground text-display font-bold">{brand.name}</h1>
      <p className="text-muted-foreground text-body">{brand.slogan}</p>
    </PageShell>
  );
}
