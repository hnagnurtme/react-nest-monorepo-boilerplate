import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuthStore, type TenantMembership } from '@/entities/session';
import { useMyTenants } from '@/entities/tenant';

/**
 * The tenant lives in the URL, so a link carries the tenant it was taken from
 * instead of silently showing the reader's own. `sessionStorage` is only the
 * default for a URL that does not name one.
 */
export const TENANT_PARAM = 'tenant';

/**
 * The page `switchTenant` was asked to leave for, until the router is there.
 *
 * Module scope rather than a ref, because this hook runs in every component
 * that needs the tenant — the route guard, the app bar, the page itself — and
 * each of those copies would otherwise keep its own. The effect below backfills
 * `?tenant=` onto the page it is looking at and runs on the store update that
 * precedes the navigation, so a copy that did not know about the pending
 * navigation wrote the parameter onto the old pathname, which replaced the
 * navigation with a stay: choosing a tenant on `/select-tenant` landed back on
 * `/select-tenant`.
 */
let pendingPathname: string | null = null;

/**
 * The backfill this module has already asked for, as `pathname\u0000slug`.
 *
 * The same reason as {@link pendingPathname}: every copy of this hook sees the
 * missing parameter in the same render, so each of them wrote it, and twenty
 * identical replacements went through the router for one page.
 */
let lastBackfill: string | null = null;

export interface ActiveTenant {
  /** Every tenant the account may act in — all of them for a platform account. */
  tenants: TenantMembership[];
  /** The membership the URL resolved to, `null` while the choice is missing. */
  activeTenant: TenantMembership | null;
  activeTenantId: string | null;
  /** True once the account has to choose before anything tenant-scoped will load. */
  isChoicePending: boolean;
  /**
   * True while the candidates are still being read, so the choice is neither
   * made nor missing yet. A platform account's tenants come from a request, and
   * a guard that treats "not loaded" as "not chosen" bounces it to the chooser
   * on every reload.
   */
  isResolving: boolean;
  /** The URL named a tenant this account may not act in — a shared link. */
  isUnknownTenant: boolean;
  /**
   * Move this tab to another tenant. `to` sends the tab to that path in the
   * same navigation instead of rewriting the current URL — two navigations in
   * one handler race, and the loser is the tenant parameter.
   */
  switchTenant: (tenantId: string, options?: { to: string; isReplace?: boolean }) => void;
}

/**
 * The tenant this tab acts in, read from `?tenant=<slug>`.
 *
 * A slug the account may not act in resolves to nothing rather than falling
 * back to the remembered tenant: a link saying Acme must never render Globex's
 * rows.
 *
 * Who the candidates are depends on the scope. A tenant account chooses among
 * its memberships, which `GET /auth/me` already carries. A platform account is
 * a member of nothing and may act in any tenant, so its candidates are the
 * tenant directory (`GET /tenants/mine`, which answers platform-wide) — one
 * request, shared with the picker and the sidebar through the query cache.
 *
 * Switching throws away every cached query: the server state belongs to the old
 * tenant, and showing it under the new one would be wrong, not merely stale.
 */
export function useActiveTenant(): ActiveTenant {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const storedTenantId = useAuthStore((state) => state.activeTenantId);
  const setActiveTenant = useAuthStore((state) => state.setActiveTenant);

  const isPlatform = user?.scope === 'platform';
  const directory = useMyTenants({ enabled: isPlatform });

  const tenants = useMemo<TenantMembership[]>(() => {
    if (!isPlatform) return user?.tenants ?? [];
    return (directory.data ?? []).map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    }));
  }, [isPlatform, user, directory.data]);

  const urlSlug = searchParams.get(TENANT_PARAM);
  const isResolving = isPlatform && directory.data === undefined && !directory.isError;

  const fromUrl = urlSlug === null ? undefined : tenants.find((t) => t.slug === urlSlug);
  const remembered = tenants.find((t) => t.id === storedTenantId);
  // A named-but-unknown slug stays unresolved; only an absent one falls back.
  const resolved = urlSlug === null ? remembered : fromUrl;
  const activeTenantId = resolved?.id ?? null;

  // The URL is the source of truth, so everything else follows it: the store
  // (which feeds the `x-tenant-id` header) and the URL's own missing parameter.
  useEffect(() => {
    // Not while the candidates are in flight: the remembered choice would be
    // cleared for the one render before the directory answers, and clearing it
    // sends the tab back to the chooser.
    if (isResolving) return;
    if (activeTenantId !== storedTenantId) setActiveTenant(activeTenantId);
  }, [isResolving, activeTenantId, storedTenantId, resolved, setActiveTenant]);

  useEffect(() => {
    if (pendingPathname !== null) {
      if (location.pathname !== pendingPathname) return;
      pendingPathname = null;
    }
    if (urlSlug !== null || resolved === undefined) return;

    const backfill = `${location.pathname}\u0000${resolved.slug}`;
    if (lastBackfill === backfill) return;
    lastBackfill = backfill;

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
  }, [urlSlug, resolved, location.pathname, setSearchParams]);

  const switchTenant = useCallback(
    (tenantId: string, options?: { to: string; isReplace?: boolean }) => {
      const target = tenants.find((t) => t.id === tenantId);
      if (target === undefined) return;
      if (tenantId !== activeTenantId) {
        setActiveTenant(tenantId);
        queryClient.clear();
      }
      /*
       * One navigation, always. A caller that also wants to leave the page has
       * to say so here rather than call `navigate` after this: the second
       * navigation drops the first one's `tenant` parameter, and the effect
       * above then reads the stale URL back over the store, so the tab lands on
       * the tenant it was asked to leave.
       */
      if (options !== undefined) {
        // The destination may carry a query of its own, so the tenant is
        // merged into it rather than appended after it.
        const [pathname = options.to, existing] = options.to.split('?');
        const search = new URLSearchParams(existing);
        search.set(TENANT_PARAM, target.slug);
        pendingPathname = pathname;
        void navigate(`${pathname}?${search.toString()}`, {
          replace: options.isReplace ?? false,
        });
        return;
      }
      // A push, not a replace: moving tenant is a navigation, and Back should undo it.
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set(TENANT_PARAM, target.slug);
        return next;
      });
    },
    [activeTenantId, tenants, setActiveTenant, queryClient, navigate, setSearchParams],
  );

  return {
    tenants,
    activeTenant: resolved ?? null,
    activeTenantId,
    isChoicePending: user !== null && !isResolving && resolved === undefined,
    isResolving,
    isUnknownTenant: !isResolving && urlSlug !== null && fromUrl === undefined,
    switchTenant,
  };
}
