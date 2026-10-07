import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { Tenant, TenantsPageData } from '@/features/tenants/types';
import { rawPagedRequest, type ApiError } from '@/lib/http/client';

export const TENANTS_ENDPOINT = '/api/v1/tenants';

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
      const response = await rawPagedRequest<Tenant>(TENANTS_ENDPOINT, {
        params: { page, limit },
      });
      return { items: response.data, meta: response.meta };
    },
  });
}
