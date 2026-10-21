import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { TENANT_DIRECTORY_ENDPOINTS } from '@/entities/tenant/endpoints';
import type { DirectoryTenant } from '@/entities/tenant/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export const myTenantsKeys = { all: ['tenants', 'mine'] as const };

/**
 * Every tenant the account may act in, with the logo and address the picker
 * draws. A platform account belongs to none and gets them all.
 *
 * Reachable before a tenant is chosen: the route carries `@NoTenantContext` and
 * `@PlatformWide` on the API side, so this is the one tenant query that needs
 * no `x-tenant-id` header and that a platform account reads platform-wide even
 * while it is acting inside one tenant.
 *
 * `staleTime` is generous — a picker that refetches while someone is reading it
 * gains nothing — and this is also the list `useActiveTenant` resolves a
 * platform account's choice against, so it is deliberately one shared query.
 */
export function useMyTenants(
  options: { enabled?: boolean } = {},
): UseQueryResult<DirectoryTenant[], ApiError> {
  return useQuery<DirectoryTenant[], ApiError>({
    queryKey: myTenantsKeys.all,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    queryFn: () => rawRequest<DirectoryTenant[]>(TENANT_DIRECTORY_ENDPOINTS.MINE),
  });
}
