import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';

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
 */
export function SelectTenantPage() {
  const { t } = useTranslation('auth');
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const { tenants, activeTenantId, switchTenant } = useActiveTenant();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (activeTenantId !== null) return <Navigate to={from} replace />;

  return (
    <PageShell width="form" isCentered>
      <Card className="p-8">
        <h1 className="text-foreground text-title font-bold">{t('selectTenant.title')}</h1>
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
            {tenants.map((tenant) => (
              <Button
                key={tenant.id}
                variant="secondary"
                isFullWidth
                onClick={() => {
                  switchTenant(tenant.id);
                }}
              >
                {tenant.name}
              </Button>
            ))}
          </Stack>
        )}
      </Card>
    </PageShell>
  );
}
