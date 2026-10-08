import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuthStore, type TenantMembership } from '@/entities/session';

/**
 * The tenant lives in the URL, so a link carries the tenant it was taken from
 * instead of silently showing the reader's own. `sessionStorage` is only the
 * default for a URL that does not name one.
 */
export const TENANT_PARAM = 'tenant';

export interface ActiveTenant {
  /** Every tenant the account may act in. Empty for a platform account. */
  tenants: TenantMembership[];
  /** The membership the URL resolved to, `null` while the choice is missing. */
  activeTenant: TenantMembership | null;
  activeTenantId: string | null;
  /** True once a tenant account has to choose before anything else will load. */
  isChoicePending: boolean;
  /** The URL named a tenant this account does not belong to — a shared link. */
  isUnknownTenant: boolean;
  switchTenant: (tenantId: string) => void;
}

/**
 * The tenant this tab acts in, read from `?tenant=<slug>`.
 *
 * A slug the account does not hold resolves to nothing rather than falling back
 * to the remembered tenant: a link saying Acme must never render Globex's rows.
 *
 * Switching throws away every cached query: the server state belongs to the old
 * tenant, and showing it under the new one would be wrong, not merely stale.
 */
export function useActiveTenant(): ActiveTenant {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const storedTenantId = useAuthStore((state) => state.activeTenantId);
  const setActiveTenant = useAuthStore((state) => state.setActiveTenant);

  const tenants = useMemo(() => user?.tenants ?? [], [user]);
  const isPlatform = user?.scope === 'platform';
  const urlSlug = searchParams.get(TENANT_PARAM);

  const fromUrl = urlSlug === null ? undefined : tenants.find((t) => t.slug === urlSlug);
  const remembered = tenants.find((t) => t.id === storedTenantId);
  // A named-but-unknown slug stays unresolved; only an absent one falls back.
  const resolved = isPlatform ? undefined : urlSlug === null ? remembered : fromUrl;
  const activeTenantId = resolved?.id ?? null;

  // The URL is the source of truth, so everything else follows it: the store
  // (which feeds the `x-tenant-id` header) and the URL's own missing parameter.
  useEffect(() => {
    if (activeTenantId !== storedTenantId) setActiveTenant(activeTenantId);
  }, [activeTenantId, storedTenantId, setActiveTenant]);

  useEffect(() => {
    if (isPlatform) {
      // A platform request carries no tenant; a leftover parameter would lie.
      if (urlSlug === null) return;
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete(TENANT_PARAM);
          return next;
        },
        { replace: true },
      );
      return;
    }
    if (urlSlug !== null || resolved === undefined) return;
    // Writing the remembered tenant back makes the address shareable without a
    // new history entry — the user did not navigate anywhere.
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(TENANT_PARAM, resolved.slug);
        return next;
      },
      { replace: true },
    );
  }, [isPlatform, urlSlug, resolved, setSearchParams]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      if (tenantId === activeTenantId) return;
      const target = tenants.find((t) => t.id === tenantId);
      if (target === undefined) return;
      setActiveTenant(tenantId);
      queryClient.clear();
      // A push, not a replace: moving tenant is a navigation, and Back should undo it.
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set(TENANT_PARAM, target.slug);
        return next;
      });
    },
    [activeTenantId, tenants, setActiveTenant, queryClient, setSearchParams],
  );

  return {
    tenants,
    activeTenant: resolved ?? null,
    activeTenantId,
    isChoicePending: user !== null && !isPlatform && resolved === undefined,
    isUnknownTenant: urlSlug !== null && fromUrl === undefined && !isPlatform,
    switchTenant,
  };
}
