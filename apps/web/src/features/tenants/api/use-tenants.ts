import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { TENANT_ENDPOINTS } from '@/features/tenants/endpoints';
import type { Tenant, TenantsPageData } from '@/features/tenants/types';
import { rawPagedRequest, type ApiError } from '@/lib/http/client';

export const tenantsKeys = {
  all: ['tenants'] as const,
  list: (page: number, limit: number) => ['tenants', 'list', page, limit] as const,
};

export function useTenants(
  page: number,
  limit: number,
  options: { enabled?: boolean } = {},
): UseQueryResult<TenantsPageData, ApiError> {
  return useQuery<TenantsPageData, ApiError>({
    queryKey: tenantsKeys.list(page, limit),
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const response = await rawPagedRequest<Tenant>(TENANT_ENDPOINTS.TENANTS, {
        params: { page, limit },
      });
      return { items: response.data, meta: response.meta };
    },
  });
}
