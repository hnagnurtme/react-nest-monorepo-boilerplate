import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { safeRedirect, useActiveTenant } from '@/features/auth';
import { TenantMap, TenantPickerList, useMyTenants } from '@/features/tenants';
import { Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/shared/ui';

/**
 * The platform account's home until it has picked a tenant to look at.
 *
 * A platform account belongs to no tenant, so a tenant-scoped page has no
 * single tenant to report on — the first question is always which one. Picking
 * one puts the whole tab inside that tenant: the choice goes into
 * `?tenant=<slug>` and the `x-tenant-id` header, and the API runs the request
 * under that tenant's RLS policies.
 *
 * It is the chooser's map and cards as page content inside the app shell, not
 * the standalone `/select-tenant` screen: nothing is blocked here, the sidebar
 * and the platform pages still work, and the account can come back and change
 * its mind from the sidebar.
 */
export function TenantLauncher() {
  const { t } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
  const location = useLocation();
  const { activeTenantId, switchTenant } = useActiveTenant();

  const myTenants = useMyTenants();
  /* A platform account has no memberships, so `GET /tenants/mine` is the list. */
  const tenants = myTenants.data ?? [];
  const hasMap = tenants.some((tenant) => tenant.detail?.provinceCode != null);

  /*
    Where the account was going when the guard sent it here, if anywhere. A
    tenant-scoped page it opened from a link is the destination; otherwise it
    stays on this page, which is now that tenant's dashboard.
  */
  // Sanitised, not read raw: it ends up in `navigate`, and `//evil.com` is an
  // absolute URL to a browser. `/` when nothing sent the account here.
  const from = safeRedirect(location.state);

  /*
    The tenant the tab still remembers is marked on the map and in the list, so
    a sign-in that reopens the chooser says which tenant it would carry on in
    rather than making that a guess.
  */
  const choose = (tenantId: string): void => {
    /*
      One navigation, carrying both the tenant and the destination: calling
      `navigate` after a plain switch drops the tenant parameter the switch just
      wrote. `replace`, so Back does not land on the chooser.

      The destination is always named, `/` included: staying put would keep
      `?change=1`, which is what reopened the chooser, and the page would ask
      the same question again with the answer already given.
    */
    switchTenant(tenantId, { to: from, isReplace: true });
  };

  return (
    /*
      The page fills the shell and never scrolls: the map is bound by height, so
      a page-level scrollbar is the one thing that takes the country off screen.
      The list scrolls inside its own column instead.
    */
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        No `title`: the app bar already names the page, and a second level-one
        heading would give the document two.
      */}
      <PageHeader subtitle={t('launcher.subtitle')} />

      {myTenants.isError ? (
        <ErrorState
          title={t('launcher.error')}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void myTenants.refetch();
              }}
            >
              {tCommon('actions.retry')}
            </Button>
          }
        />
      ) : myTenants.isPending ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : tenants.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Building2 className="size-8" />}
            title={t('launcher.emptyTitle')}
            description={t('launcher.emptyDescription')}
          />
        </Card>
      ) : (
        <div
          className={
            hasMap
              ? 'grid min-h-0 flex-1 gap-6 lg:grid-cols-[2fr_3fr]'
              : '-m-1 min-h-0 flex-1 overflow-y-auto p-1'
          }
        >
          {/*
            The map is orientation, the cards are the choice, so the choice gets
            the larger half. It is hidden below `lg`, where two columns do not
            fit and the cards alone answer the question.

            The SVG paints its own sea edge to edge, so the slot carries no
            surface of its own: a panel behind it only showed as a grey margin
            wherever the map's aspect ratio did not fill the column.

            Without an address on file there is nothing for the map to place, so
            it is left out entirely and the cards take the whole width.
          */}
          {hasMap ? (
            <div className="hidden h-full min-h-0 lg:block">
              <TenantMap tenants={tenants} activeTenantId={activeTenantId} onSelect={choose} />
            </div>
          ) : null}

          {/*
            `p-1` with a matching negative margin: the scroll box clips at its
            own edge, so the selected card's ring lost a pixel on every side
            without the padding, and the padding alone would inset the grid.
          */}
          <div className="-m-1 min-h-0 min-w-0 overflow-y-auto p-1">
            <TenantPickerList tenants={tenants} activeTenantId={activeTenantId} onSelect={choose} />
          </div>
        </div>
      )}
    </div>
  );
}
