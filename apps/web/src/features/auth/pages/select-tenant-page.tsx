import { Building2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { useActiveTenant } from '@/features/auth/hooks/use-active-tenant';
import { Button, Card, EmptyState, PageShell, Stack } from '@/shared/ui';

/**
 * Which tenant to work in. An account can belong to several, and the API refuses
 * to guess, so nothing loads until the choice is made.
 *
 * A single membership is still shown rather than auto-selected on this page:
 * the redirect in `RouteGuard` only sends people here when a choice is actually
 * missing, and `useInitAuthSession` picks the obvious one on the way in.
 *
 * `?change=1` is how the account menu reopens the page on purpose. Without it
 * the guard clause below would bounce a deliberate visit straight back, since a
 * tenant is already chosen — which is the normal case, not an error. The flag
 * lives in the query string rather than in router state so that reloading the
 * page one is looking at does not change what it does.
 */
export function SelectTenantPage() {
  const { t } = useTranslation('auth');
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = useAuthStore((state) => state.status);
  const { tenants, activeTenantId, switchTenant } = useActiveTenant();

  const isChanging = searchParams.get('change') === '1';
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (activeTenantId !== null && !isChanging) return <Navigate to={from} replace />;

  /*
   * `switchTenant` only rewrites the current URL's `tenant` parameter, which on
   * this page would leave the chooser on screen. Leaving is this page's job, and
   * `replace` keeps the chooser out of the history so Back does not land on it.
   */
  const choose = (tenantId: string): void => {
    switchTenant(tenantId);
    if (isChanging) void navigate(from, { replace: true });
  };

  return (
    <PageShell width="form" isCentered>
      <Card className="p-8">
        <h1 className="text-foreground text-title font-bold">
          {isChanging ? t('selectTenant.changeTitle') : t('selectTenant.title')}
        </h1>
        <p className="text-muted-foreground text-body mt-2">{t('selectTenant.subtitle')}</p>

        {tenants.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Building2 className="size-8" />}
              title={t('selectTenant.emptyTitle')}
              description={t('selectTenant.emptyDescription')}
            />
          </div>
        ) : (
          <Stack gap="snug" className="mt-6">
            {tenants.map((tenant) => {
              const isActive = tenant.id === activeTenantId;

              return (
                <Button
                  key={tenant.id}
                  variant={isActive ? 'primary' : 'secondary'}
                  isFullWidth
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    choose(tenant.id);
                  }}
                >
                  {isActive ? <Check className="size-4" aria-hidden="true" /> : null}
                  {tenant.name}
                </Button>
              );
            })}
          </Stack>
        )}
      </Card>
    </PageShell>
  );
}
