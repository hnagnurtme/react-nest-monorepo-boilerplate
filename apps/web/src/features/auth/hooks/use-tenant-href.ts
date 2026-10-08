import { useCallback } from 'react';

import { useActiveTenant, TENANT_PARAM } from './use-active-tenant';

/**
 * Builds an in-app path that keeps the active tenant.
 *
 * A plain `<Link to="/users">` drops the query string, which would move the tab
 * to the remembered tenant mid-navigation. Every internal link goes through
 * this instead.
 */
export function useTenantHref(): (path: string) => string {
  const { activeTenant } = useActiveTenant();
  const slug = activeTenant?.slug ?? null;

  return useCallback(
    (path: string) => {
      if (slug === null) return path;
      const [pathname = path, search] = path.split('?');
      const params = new URLSearchParams(search);
      params.set(TENANT_PARAM, slug);
      return `${pathname}?${params.toString()}`;
    },
    [slug],
  );
}
