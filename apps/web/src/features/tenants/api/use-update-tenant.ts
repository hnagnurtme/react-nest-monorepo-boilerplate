import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { TENANTS_ENDPOINT, tenantsKeys } from '@/features/tenants/api/use-tenants';
import type { Tenant, UpdateTenantBody } from '@/features/tenants/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export interface UpdateTenantVariables {
  id: string;
  body: UpdateTenantBody;
}

export function useUpdateTenant(): UseMutationResult<Tenant, ApiError, UpdateTenantVariables> {
  const queryClient = useQueryClient();

  return useMutation<Tenant, ApiError, UpdateTenantVariables>({
    mutationFn: ({ id, body }) =>
      rawRequest<Tenant>(`${TENANTS_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tenantsKeys.all });
    },
  });
}
