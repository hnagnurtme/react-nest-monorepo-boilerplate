import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { TENANTS_ENDPOINT, tenantsKeys } from '@/features/tenants/api/use-tenants';
import type { CreateTenantBody, Tenant } from '@/features/tenants/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export function useCreateTenant(): UseMutationResult<Tenant, ApiError, CreateTenantBody> {
  const queryClient = useQueryClient();

  return useMutation<Tenant, ApiError, CreateTenantBody>({
    mutationFn: (body) =>
      rawRequest<Tenant>(TENANTS_ENDPOINT, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tenantsKeys.all });
    },
  });
}
