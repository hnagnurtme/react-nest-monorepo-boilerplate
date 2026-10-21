import { Building2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { useActiveTenant } from '@/features/auth/hooks/use-active-tenant';
import { safeRedirect } from '@/features/auth/hooks/use-login-form';
import { TenantMap, TenantPickerList, useMyTenants } from '@/features/tenants';
import { Card, EmptyState, PageLoader, PageShell } from '@/shared/ui';

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
 *
 * The list comes from `GET /tenants/mine` rather than from the session's
 * memberships: the session knows the names, and this page also wants the logo
 * and the address. The memberships are still what decides whether a choice is
 * pending, so a slow or failed request degrades to the plain list rather than
 * locking the account out of its own tenants.
 */
export function SelectTenantPage() {
  const { t } = useTranslation('auth');
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const status = useAuthStore((state) => state.status);
  const { tenants, activeTenantId, isResolving, switchTenant } = useActiveTenant();

  const isChanging = searchParams.get('change') === '1';
  /*
   * Set the moment a tenant is picked, and it keeps the redirect below from
   * firing on the render that follows: that redirect goes to the destination
   * without a tenant in it, which replaces the navigation `switchTenant` just
   * started and strips the choice back out of the URL.
   */
  const [isLeaving, setIsLeaving] = useState(false);
  // Sanitised, not read raw: the destination ends up in `navigate`, and
  // `//evil.com` is an absolute URL to a browser.
  const from = safeRedirect(location.state);

  const myTenants = useMyTenants({ enabled: status === 'authenticated' });

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  // A platform account's candidates come from a request; an empty list would
  // otherwise read as "you have no tenants" for as long as it is in flight.
  if (isResolving) return <PageLoader />;
  if (isLeaving) return <PageLoader />;
  if (activeTenantId !== null && !isChanging) return <Navigate to={from} replace />;

  /*
   * `switchTenant` without a destination only rewrites the current URL's
   * `tenant` parameter, which on this page would leave the chooser on screen.
   * Leaving is this page's job, so the destination goes into the same
   * navigation; `replace` keeps the chooser out of the history so Back does not
   * land on it.
   */
  const choose = (tenantId: string): void => {
    setIsLeaving(true);
    switchTenant(tenantId, { to: from, isReplace: true });
  };

  /*
   * The memberships decide which rows exist; the request only decorates them.
   *
   * Driving the list off `tenants` rather than off the response keeps the two
   * in step: a platform account has no memberships but `GET /tenants/mine`
   * answers with every tenant, and rendering those here would offer choices
   * `switchTenant` would then refuse. It also means a slow or failed request
   * degrades to the plain list instead of an empty page.
   */
  const detailById = new Map((myTenants.data ?? []).map((tenant) => [tenant.id, tenant.detail]));
  const rows = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    isActive: true,
    createdAt: '',
    detail: detailById.get(tenant.id) ?? null,
  }));

  const hasMap = rows.some((tenant) => tenant.detail?.provinceCode != null);

  const heading = (
    <div>
      <h1 className="text-foreground text-title font-bold">
        {isChanging ? t('selectTenant.changeTitle') : t('selectTenant.title')}
      </h1>
      <p className="text-muted-foreground text-body mt-2">{t('selectTenant.subtitle')}</p>
    </div>
  );

  if (tenants.length === 0) {
    return (
      <PageShell width="form" isCentered>
        <Card className="p-8">
          {heading}
          <div className="mt-6">
            <EmptyState
              icon={<Building2 className="size-8" />}
              title={t('selectTenant.emptyTitle')}
              description={t('selectTenant.emptyDescription')}
            />
          </div>
        </Card>
      </PageShell>
    );
  }

  /*
    Without an address on file there is nothing for the map to place, so the
    page falls back to the plain centred card it was before.
  */
  if (!hasMap) {
    return (
      <PageShell width="form" isCentered>
        <Card className="p-8">
          {heading}
          <div className="mt-6">
            <TenantPickerList tenants={rows} activeTenantId={activeTenantId} onSelect={choose} />
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell width="full" isFullHeight>
      {/*
        Two columns, map first: 40% of the width for the country, 60% for the
        cards. The map is the orientation, the cards are the choice, so the
        choice gets the larger half.

        The card fills the viewport exactly and the title sits in the right
        column rather than above both: the map is bound by height, so every
        row of chrome above it costs the country real size.
      */}
      <Card className="h-full min-h-0 p-6">
        {/*
          `minmax(0,1fr)` on the one column a phone gets. The implicit track is
          `auto`, sized to its widest unbreakable child — a tenant's full
          address is one — so the card grew wider than the screen, its right
          edge went under the page's `overflow-x-hidden`, and the `truncate`
          inside `TypeCard` never engaged because its box had been widened to
          fit the address.
        */}
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[2fr_3fr]">
          {/*
            No surface under the map: the SVG paints its own sea to the edge,
            and a panel behind it only showed as a grey margin wherever the
            map's aspect ratio did not fill the column.
          */}
          <div className="hidden h-full min-h-0 lg:block">
            <TenantMap tenants={rows} activeTenantId={activeTenantId} onSelect={choose} />
          </div>

          <div className="flex min-h-0 min-w-0 flex-col">
            {heading}

            {/*
              The list scrolls inside its own column rather than the page: the
              map beside it is only useful while it is on screen, and a
              page-level scrollbar pushes the country out of view.

              `p-1` with a matching negative margin: the scroll box clips at its
              own edge, so the selected card's ring lost a pixel on every side
              without the padding, and the padding alone would inset the grid.
            */}
            <div className="-m-1 mt-3 min-h-0 flex-1 overflow-y-auto p-1">
              <TenantPickerList tenants={rows} activeTenantId={activeTenantId} onSelect={choose} />
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
