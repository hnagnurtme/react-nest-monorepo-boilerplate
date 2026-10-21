import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { TENANT_ENDPOINTS } from '@/features/tenants/endpoints';
import type { Tenant } from '@/features/tenants/types';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

export const tenantKeys = {
  detail: (id: string) => ['tenants', 'detail', id] as const,
};

/**
 * One tenant by id.
 *
 * The list page opens its detail panel from the URL, so the tenant named there
 * may sit on a page of the list that was never loaded — a link from the home
 * chooser, or a reload on page one. Reading it on its own keeps the panel from
 * depending on which page of the table happens to be in the cache.
 */
export function useTenant(id: string | null): UseQueryResult<Tenant, ApiError> {
  return useQuery<Tenant, ApiError>({
    // `id ?? ''` only shapes the key; the query never runs while `id` is null.
    queryKey: tenantKeys.detail(id ?? ''),
    enabled: id !== null,
    queryFn: () => rawRequest<Tenant>(apiPath(TENANT_ENDPOINTS.TENANT, { id: id ?? '' })),
  });
}
